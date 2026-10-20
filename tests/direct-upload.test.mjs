import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const userId = '10000000-0000-4000-8000-000000000001';
const entityId = '20000000-0000-4000-8000-000000000001';
const fileId = '30000000-0000-4000-8000-000000000001';
const prefix = `${userId}/${entityId}/`;
const pdf = (size = 20) => new File(['%PDF-1.4\n', new Uint8Array(size - 9)], 'proof.pdf', { type: 'application/pdf' });
function load(path, imports = {}) {
  const exports = {};
  const url = new URL(`../${path}`, import.meta.url);
  vm.runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, File, FormData, Response, URL, Date, crypto: { randomUUID },
    require(id) {
      if (id in imports) return imports[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`, imports);
      if (id === './options') return load('src/app/missions/add/options.ts', imports);
      if (id === 'node:crypto') return { randomUUID };
      throw Error(`Unexpected import: ${id}`);
    } });
  return exports;
}
const { readUpload } = load('src/lib/uploads/read-upload.ts');

test('direct-upload reader rejects foreign paths, URLs and traversal before downloading', async () => {
  let downloads = 0;
  const storage = { download() { downloads++; throw Error('must not download'); } };
  for (const value of [null, `${entityId}/${entityId}/${fileId}.pdf`,
    `${prefix}../${fileId}.pdf`, `${prefix}nested/${fileId}.pdf`,
    `https://example.com/${prefix}${fileId}.pdf`, `${prefix}anything.pdf`]) {
    assert.equal(await readUpload(value, storage, prefix, 5_000_000), null);
  }
  assert.equal(downloads, 0);
});

test('reader uses actual downloaded size/type and preserves legacy multipart files', async () => {
  const path = `${prefix}${fileId}.pdf`;
  for (const data of [pdf(5_000_001), new Blob([], { type: 'application/pdf' }),
    new Blob(['%PDF-1.4'], { type: 'text/html' })]) {
    assert.equal(await readUpload(path, { download: async () => ({ data }) }, prefix, 5_000_000), null);
  }
  assert.equal(await readUpload(path, { download: async () => ({ error: {} }) }, prefix, 5_000_000), null);
  const file = pdf();
  const legacy = await readUpload(file, {}, prefix, 5_000_000);
  assert.equal(legacy.file, file); assert.equal(legacy.path, null);
});

function harness(options = {}) {
  const objects = new Map(); const writes = []; const removed = []; const downloads = [];
  let uploadCount = 0; let responseBody; let requestBytes = 0;
  const storage = {
    async upload(path, file, settings) {
      assert.equal(settings.upsert, false);
      uploadCount++;
      if (options.failUpload === uploadCount) return { error: {} };
      assert.ok(!objects.has(path)); objects.set(path, file); return { error: null };
    },
    async download(path) {
      downloads.push(path); return objects.has(path) ? { data: objects.get(path) } : { error: {} };
    },
    async remove(paths) { removed.push(...paths); paths.forEach(path => objects.delete(path)); return { error: null }; },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: userId } } }) },
    storage: { from: () => storage },
    from(table) {
      let changes;
      const query = {
        select() { return query; }, eq() { return query; }, is() { return query; },
        insert(value) { changes = value; return query; }, update(value) { changes = value; return query; },
        async maybeSingle() {
          if (changes) {
            writes.push({ table, changes });
            return options.saveError ? { error: { code: '23505' } } : { data: { user_id: userId,
              mission_submission_id: changes.mission_submission_id,
              achievement_claim_id: changes.achievement_claim_id, result_submission_id: entityId } };
          }
          if (table === 'profiles') return { data: { role_app: 'STUDENT',
            status_akun: options.suspended ? 'SUSPENDED' : 'ACTIVE', primary_class_id: 1, foto_profil_path: null } };
          if (table === 'squads') return { data: { ketua_id: userId, status_squad: 'FINALIZED', mission_id: entityId } };
          if (table === 'squad_members') return { data: { role_squad: options.notLeader ? 'ANGGOTA' : 'KETUA' } };
          if (table === 'xp_rules') return { data: { legacy_xp: 50, verified_xp: 100 } };
          return { data: options.existing ?? null };
        },
      };
      return query;
    },
  };
  const imports = {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/client': { createClient: () => client },
    'next/cache': { revalidatePath() {} },
  };
  const browser = load('src/lib/uploads/submit-with-uploads.ts', imports);
  // Re-evaluate only this module with a request boundary capturing its payload.
  const source = readFileSync(new URL('../src/lib/uploads/submit-with-uploads.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText,
    { exports: browser, File, FormData, crypto: { randomUUID }, require: id => imports[id],
      async fetch(url, { body }) {
        for (const value of body.values()) assert.equal(typeof value, 'string', 'file bytes leaked to Next request');
        const request = new Request(`https://nexus.example${url}`, { method: 'POST', body,
          headers: { host: 'nexus.example', origin: 'https://nexus.example' } });
        requestBytes = (await request.clone().arrayBuffer()).byteLength;
        if (options.networkError) throw Error('connection lost after possible commit');
        if (options.httpStatus) return new Response('{}', { status: options.httpStatus });
        const route = url === '/api/profile/avatar' ? 'src/app/api/profile/avatar/route.ts'
          : url === '/api/achievement-claims' ? 'src/app/api/achievement-claims/route.ts'
          : url.startsWith('/api/squads/') ? 'src/app/api/squads/[squadId]/result/route.ts'
          : 'src/app/api/missions/submissions/route.ts';
        const response = await load(route, imports).POST(request, { params: Promise.resolve({ squadId: entityId }) });
        responseBody = await response.clone().json(); return response;
      } });
  return { ...browser, objects, writes, removed, downloads, storage,
    response: () => responseBody, requestBytes: () => requestBytes };
}

function fields(values) {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}
const cases = [
  ['/api/profile/avatar', 'avatars', ['avatar'], () => fields({
    avatar: new File([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), new Uint8Array(5_000_000)], 'a.png', { type: 'image/png' }),
  })],
  ['/api/achievement-claims', 'achievement-certificates', ['sertifikat'], () => fields({
    nama_kompetisi: 'QA', penyelenggara: 'QA', achievement_date: '2026-01-01',
    submitted_tier_id: '1', hasil_kompetisi: 'PARTICIPANT', sertifikat: pdf(5_000_000),
  })],
  [`/api/squads/${entityId}/result`, 'mission-result-certificates', ['sertifikat', 'dokumen_pendukung'],
    () => fields({ hasil_kompetisi: 'PARTICIPANT', submitted_tier_id: '1',
      sertifikat: pdf(5_000_000), dokumen_pendukung: pdf(5_000_000) })],
  ['/api/missions/submissions', 'mission-documents', ['dokumen'], () => fields({
    nama_lomba: 'QA', penyelenggara: 'QA', link_resmi: 'https://example.com', deskripsi_singkat: 'QA',
    tahun_lomba: '2026', deadline_pendaftaran: new Date(Date.now() + 86400000).toISOString(),
    deadline_lomba: new Date(Date.now() + 172800000).toISOString(), min_anggota_tim: '2', max_anggota_tim: '3',
    kategori_penyelenggara: 'UNIVERSITAS_LOKAL_INTERNAL', kategori_lomba: 'TECHNOLOGY',
    cakupan_peserta: 'INTERNAL', mode_lomba: 'ONLINE', biaya_pendaftaran: 'GRATIS', dokumen: pdf(10_485_760),
  })],
];
for (const [url, bucket, names, form] of cases) {
  test(`${bucket}: large browser upload reaches actual route as small metadata and saves once`, async () => {
    const s = harness();
    const response = await s.submitWithUploads(url, form(), bucket, names, entityId);
    assert.equal(response.status, 200, JSON.stringify(s.response()));
    assert.equal(s.response().success, true); assert.equal(s.writes.length, 1);
    assert.ok(s.requestBytes() < 10_000); assert.equal(s.downloads.length, names.length);
    assert.equal(s.removed.length, 0);
  });
}

test('partial upload failure cleans up before any application write', async () => {
  const s = harness({ failUpload: 2 }); const [url, bucket, names, form] = cases[2];
  await assert.rejects(s.submitWithUploads(url, form(), bucket, names, entityId));
  assert.equal(s.objects.size, 0); assert.equal(s.removed.length, 1); assert.equal(s.writes.length, 0);
});
test('network/5xx uncertainty retains files; explicit 4xx cleans unused uploads', async () => {
  for (const options of [{ networkError: true }, { httpStatus: 503 }, { httpStatus: 403 }]) {
    const s = harness(options); const [url, bucket, names, form] = cases[1];
    try { await s.submitWithUploads(url, form(), bucket, names, entityId); } catch { /* Expected network failure. */ }
    assert.equal(s.removed.length, options.httpStatus === 403 ? 1 : 0);
  }
});
test('stored forged signatures, suspended callers and non-leaders cannot save', async () => {
  for (const options of [{ suspended: true }, { notLeader: true }, { forged: true }]) {
    const s = harness(options); const [url, bucket, names, form] = cases[2];
    const data = form();
    if (options.forged) data.set('sertifikat', new File(['<script>fake</script>'], 'fake.pdf', { type: 'application/pdf' }));
    const response = await s.submitWithUploads(url, data, bucket, names, entityId);
    assert.ok([400, 403].includes(response.status)); assert.equal(s.writes.length, 0);
  }
});

test('rejected submissions accept fresh evidence and clean only the previous file after saving', async () => {
  for (const index of [1, 2, 3]) {
    const [url, bucket, names, form] = cases[index];
    const oldPath = `${prefix}${fileId}.pdf`;
    const s = harness({ existing: { achievement_claim_id: entityId, mission_submission_id: entityId,
      result_submission_id: entityId, submitted_by: userId, user_id: userId,
      status_review: 'REJECTED', status_validation: 'REJECTED', dokumen_path: oldPath,
      sertifikat_path: oldPath, dokumen_pendukung_path: null } });
    s.objects.set(oldPath, pdf());
    const data = form();
    if (index === 1) data.set('claim_id', entityId);
    if (index === 3) data.set('submission_id', entityId);
    const response = await s.submitWithUploads(url, data, bucket, names, entityId);
    assert.equal(response.status, 200, JSON.stringify(s.response()));
    assert.equal(s.writes[0].changes.status_validation ?? s.writes[0].changes.status_review, 'PENDING');
    assert.deepEqual(s.removed, [oldPath]);
    assert.equal(s.objects.size, names.length);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(url) {
  const exports = {};
  const source = readFileSync(url, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { exports, URL, Date, require(id) {
    if (id !== './options') throw Error(`Unexpected import: ${id}`);
    return load(new URL('options.ts', url));
  } });
  return exports;
}
const mission = load(new URL('../src/app/missions/add/validation.ts', import.meta.url));
const evidence = load(new URL('../src/app/squads/[squadId]/result/file-validation.ts', import.meta.url));
const samples = [
  ['application/pdf', 'pdf', Buffer.from('%PDF-1.4\n')],
  ['image/png', 'png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ['image/jpeg', 'jpg', Buffer.from([255, 216, 255, 224])],
];

test('Mission/evidence validators accept supported MIME with matching signatures', async () => {
  for (const validate of [mission.validateDocument, evidence.validateEvidence]) {
    for (const [type, extension, bytes] of samples) {
      const result = await validate(new File([bytes], 'untrusted-name.html', { type }));
      assert.equal(result.extension, extension); assert.equal(result.contentType, type);
    }
  }
});
test('empty, truncated, unsupported and mismatched files are rejected', async () => {
  const files = [new File([], 'empty.pdf', { type: 'application/pdf' }),
    new File(['%PDF'], 'broken.pdf', { type: 'application/pdf' }),
    new File(['<script>example</script>'], 'fake.png', { type: 'image/png' }),
    new File([samples[0][2]], 'wrong.png', { type: 'image/png' }),
    new File([samples[1][2]], 'wrong.pdf', { type: 'application/pdf' }),
    new File([samples[1][2]], 'unsupported.webp', { type: 'image/webp' }),
    new File([samples[0][2]], 'unknown.pdf')];
  for (const validate of [mission.validateDocument, evidence.validateEvidence]) {
    for (const file of files) assert.equal(await validate(file), null);
  }
});
test('exact size limits pass and one byte over fails before reading payload', async () => {
  for (const [validate, max] of [[mission.validateDocument, 10_485_760], [evidence.validateEvidence, 5_000_000]]) {
    let reads = 0;
    const file = { size: max, type: 'application/pdf', slice() {
      reads++; return new Blob([samples[0][2]]);
    } };
    assert.equal((await validate(file)).extension, 'pdf');
    reads = 0; file.size++;
    assert.equal(await validate(file), null); assert.equal(reads, 0);
  }
});

function form() {
  const data = new FormData();
  for (const [name, value] of Object.entries({ nama_lomba: 'QA validation', penyelenggara: 'QA',
    link_resmi: 'https://example.com', deskripsi_singkat: 'QA', tahun_lomba: '2026',
    deadline_pendaftaran: new Date(Date.now() + 86400000).toISOString(),
    deadline_lomba: new Date(Date.now() + 172800000).toISOString(),
    min_anggota_tim: '2', max_anggota_tim: '3', kategori_penyelenggara: 'UNIVERSITAS_LOKAL_INTERNAL',
    kategori_lomba: 'TECHNOLOGY', cakupan_peserta: 'INTERNAL', mode_lomba: 'ONLINE', biaya_pendaftaran: 'GRATIS' })) {
    data.set(name, value);
  }
  return data;
}
test('duplicate documents and deadline errors are assigned to their own fields', () => {
  assert.ok(mission.validateFields(form()).fields);
  const duplicate = form(); duplicate.append('dokumen', new Blob(['a'])); duplicate.append('dokumen', new Blob(['b']));
  assert.ok(mission.validateFields(duplicate).errors.dokumen);
  const expired = form(); expired.set('deadline_pendaftaran', new Date(Date.now() - 86400000).toISOString());
  assert.ok(mission.validateFields(expired).errors.deadline_pendaftaran);
  const order = form(); order.set('deadline_lomba', new Date(Date.now() + 10000).toISOString());
  assert.ok(mission.validateFields(order).errors.deadline_lomba);
});

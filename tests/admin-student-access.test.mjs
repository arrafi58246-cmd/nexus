import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const id = '10000000-0000-4000-8000-000000000001';
const peer = '20000000-0000-4000-8000-000000000002';
function load(path, imports = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { exports, Response, Request, File, URL, process, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === 'next/link') return { default: 'a' };
    if (name === 'next/image') return { default: 'img' };
    if (name.startsWith('@/') || name.startsWith('./') || name.startsWith('../')) return { default: () => null };
    return require(name);
  } }); return exports;
}
const nav = { redirect: to => { throw Error('redirect:' + to); }, notFound: () => { throw Error('404'); } };
const routes = ['missions', 'missions/[missionId]', 'missions/add', 'missions/submissions', 'leaderboard',
  'my-squad', 'squads/[squadId]', 'squads/[squadId]/result', 'squads/[squadId]/endorsements',
  'profile', 'profile/edit', 'profile/claims', 'profile/badges', 'profile/missions', 'profile/seasons',
  'profile/[userId]', 'notifications', 'onboarding'];
function fixture(profile, { anonymous = false, profileError = null, rpcError = null } = {}) {
  const reads = [], writes = [], invalidations = [];
  const client = { auth: { getUser: async () => ({ data: { user: anonymous ? null : { id } }, error: null }) },
    from(table) { reads.push(table); const q = {
      select(columns) { if (table === 'profiles') assert.match(columns, /role_app/); return q; },
      eq: () => q, maybeSingle: async () => ({ data: table === 'profiles' ? profile : { mission_id: peer }, error: profileError }),
    }; return q; },
    rpc: async (name, args) => { writes.push({ name, args }); return { data: id, error: rpcError }; },
  };
  return { client, reads, writes, invalidations, imports: { 'next/navigation': nav,
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/lib/supabase/server': { createClient: async () => client } } };
}
for (const role of ['ADMIN', 'STUDENT']) {
  test(role === 'ADMIN' ? 'all 18 student routes redirect admins before querying any student data, even without onboarding'
    : 'all 18 student routes continue for active students', async () => {
    for (const route of routes) {
      const f = fixture({ role_app: role, status_akun: 'ACTIVE', primary_class_id: role === 'ADMIN' ? null : 1 });
      // Stop student rendering at its first data query: proves the role guard permits the existing flow.
      if (role === 'STUDENT') {
        const original = f.client.from;
        f.client.from = table => { if (table !== 'profiles') throw Error('student-data'); return original(table); };
      }
      for (const [path, method] of [['@/lib/mission-history', 'loadMissionHistory'], ['@/lib/season-history', 'loadSeasonHistory']]) {
        f.imports[path] = { [method]: () => { throw Error('student-data'); } };
      }
      const Page = load('app/' + route + '/page.tsx', f.imports).default;
      const run = () => Page({ params: Promise.resolve({ userId: peer, missionId: peer, squadId: peer }), searchParams: Promise.resolve({}) });
      if (role === 'ADMIN') {
        await assert.rejects(run(), /redirect:\/admin/, route);
        assert.deepEqual(f.reads, ['profiles'], route);
      } else if (route === 'onboarding') await assert.rejects(run(), /redirect:\/$/, route);
      else {
        try { assert.ok(await run(), route); }
        catch (error) { assert.match(error.message, /student-data/, route); }
      }
    }
  });
}
test('admin shell links stay within admin workspace; account identity is not a student profile link', async () => {
  const Layout = load('app/admin/layout.tsx', { '@/lib/auth/admin': { requireAdmin: async () => ({
    supabase: {}, admin: { nama_lengkap: 'QA Admin', foto_profil_path: null },
  }) } }).default;
  const html = require('react-dom/server').renderToStaticMarkup(await Layout({ children: 'QA content' }));
  assert.match(html, /QA Admin/); assert.match(html, /QA content/);
  assert.doesNotMatch(html, /href="\/(?:profile|missions|my-squad|leaderboard|notifications)/);
});
function submit(f) { return load('app/missions/[missionId]/mission-actions/submit-squad-application.ts', {
  ...f.imports, './shared': { UUID_PATTERN: /^[0-9a-f-]{36}$/i },
}).submitSquadApplication; }
test('Join API and Server Action deny admin/missing/suspended/incomplete profiles before reading a Squad or calling RPC', async () => {
  for (const [profile, code] of [[{ role_app: 'ADMIN', status_akun: 'ACTIVE', primary_class_id: 1 }, 'STUDENT_REQUIRED'],
    [null, 'STUDENT_REQUIRED'], [{ role_app: 'STUDENT', status_akun: 'SUSPENDED', primary_class_id: 1 }, 'ACCOUNT_INACTIVE'],
    [{ role_app: 'STUDENT', status_akun: 'ACTIVE', primary_class_id: null }, 'ONBOARDING_REQUIRED']]) {
    const f = fixture(profile), action = submit(f);
    const result = await action(id); assert.equal(result.code, code);
    assert.deepEqual(f.reads, ['profiles']); assert.deepEqual(f.writes, []); assert.deepEqual(f.invalidations, []);
    const POST = load('app/api/squad-applications/submit/route.ts', {
      '@/app/missions/[missionId]/actions': { submitSquadApplication: action },
    }).POST;
    const response = await POST(new Request('https://nexus.test/api/squad-applications/submit', {
      method: 'POST', headers: { origin: 'https://nexus.test', 'content-type': 'application/json' }, body: JSON.stringify({ squadId: id }),
    }));
    assert.equal(response.status, 403); assert.equal((await response.json()).code, code);
    assert.deepEqual(f.writes, []);
  }
});
test('Join fails closed for Auth/profile errors and remains successful for an onboarded active student', async () => {
  for (const options of [{ anonymous: true }, { profileError: {} }]) {
    const f = fixture(null, options), result = await submit(f)(id);
    assert.equal(result.code, options.anonymous ? 'AUTH_REQUIRED' : 'DATABASE_ERROR'); assert.deepEqual(f.writes, []);
  }
  const f = fixture({ role_app: 'STUDENT', status_akun: 'ACTIVE', primary_class_id: 1 });
  const result = await submit(f)(id); assert.equal(result.success, true); assert.equal(result.applicationId, id);
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].name, 'submit_squad_application');
  assert.equal(f.writes[0].args.p_squad_id, id); assert.deepEqual(f.invalidations, ['/missions/' + peer]);
});
test('Create Squad and onboarding actions reject admin before any writes', async () => {
  const f = fixture({ role_app: 'ADMIN', status_akun: 'ACTIVE', primary_class_id: 1 });
  const create = load('app/missions/[missionId]/mission-actions/create-squad.ts', {
    ...f.imports, './shared': { UUID_PATTERN: /^[0-9a-f-]{36}$/i },
  }).createSquad;
  const result = await create({ missionId: id, namaSquad: 'QA', deskripsiSquad: 'QA description', kapasitasAnggota: 3,
    requirements: [{ primaryClassId: 1, slots: 2 }] });
  assert.equal(result.code, 'ACCOUNT_NOT_ELIGIBLE'); assert.deepEqual(f.reads, ['profiles']);
  const onboarding = load('app/onboarding/actions.ts', f.imports).completeOnboarding;
  assert.equal((await onboarding(1, [])).success, false); assert.deepEqual(f.writes, []);
});

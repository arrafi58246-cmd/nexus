import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021,
  } }).outputText;
  vm.runInNewContext(compiled, { exports, require: id => {
    if (Object.hasOwn(imports, id)) return imports[id];
    if (id === 'next/link') return { default: 'a' };
    if (id.startsWith('@/') || id.startsWith('./')) return {};
    return require(id);
  } });
  return exports;
}
const navigation = {
  redirect: to => { throw Error(`redirect:${to}`); },
  notFound: () => { throw Error('notFound'); },
};

test('admin guard rejects anonymous, missing, suspended, student and failed Auth/profile reads', async () => {
  for (const options of [{ anonymous: true }, { authError: {} }, { profile: null },
    { profile: { role_app: 'STUDENT', status_akun: 'ACTIVE' } },
    { profile: { role_app: 'ADMIN', status_akun: 'SUSPENDED' } }, { profileError: {} }]) {
    const reads = [];
    const profile = Object.hasOwn(options, 'profile') ? options.profile : { role_app: 'ADMIN', status_akun: 'ACTIVE' };
    const client = { auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: 'caller' } }, error: options.authError }) },
      from(table) { reads.push(table); const query = {
        select: () => query, eq: (key, value) => { assert.equal(key, 'user_id'); assert.equal(value, 'caller'); return query; },
        maybeSingle: async () => ({ data: profile, error: options.profileError }),
      }; return query; } };
    const { requireAdmin } = load('lib/auth/admin.ts', { 'server-only': {},
      react: { cache: fn => fn }, 'next/navigation': navigation,
      '@/lib/supabase/server': { createClient: async () => client } });
    await assert.rejects(requireAdmin(), options.anonymous || options.authError ? /redirect:\/login/ : /notFound/);
    assert.deepEqual(reads, options.anonymous || options.authError ? [] : ['profiles']);
  }
});

test('active admin receives the same session-scoped client after the server profile check', async () => {
  const admin = { nama_lengkap: 'QA Admin', role_app: 'ADMIN', status_akun: 'ACTIVE' };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: admin, error: null }) };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'caller' } } }) }, from: () => query };
  const { requireAdmin } = load('lib/auth/admin.ts', { 'server-only': {}, react: { cache: fn => fn },
    'next/navigation': navigation, '@/lib/supabase/server': { createClient: async () => client } });
  const result = await requireAdmin();
  assert.equal(result.supabase, client); assert.equal(result.admin, admin);
});

test('every admin page checks authorization before accessing its data, including direct detail URLs', async () => {
  for (const path of ['app/admin/page.tsx', 'app/admin/guide/page.tsx',
    'app/admin/missions/page.tsx', 'app/admin/results/page.tsx', 'app/admin/achievements/page.tsx',
    'app/admin/missions/[submissionId]/page.tsx', 'app/admin/results/[resultId]/page.tsx',
    'app/admin/achievements/[claimId]/page.tsx']) {
    const Page = load(path, { 'next/navigation': navigation,
      '@/lib/auth/admin': { requireAdmin: async () => { throw Error('denied'); } } }).default;
    const id = '00000000-0000-4000-8000-000000000001';
    await assert.rejects(Page({ params: Promise.resolve({ submissionId: id, resultId: id, claimId: id }) }), /denied/, path);
  }
});

async function dashboard(responses) {
  const calls = [];
  const client = { from(table) { const call = { table }; calls.push(call); const query = {
    select: (columns, options) => { Object.assign(call, { columns, options }); return query; },
    eq: (column, value) => { Object.assign(call, { column, value }); return Promise.resolve(responses[table]); },
  }; return query; } };
  const Page = load('app/admin/page.tsx', { '@/lib/auth/admin': { requireAdmin: async () => ({ supabase: client }) } }).default;
  return { html: require('react-dom/server').renderToStaticMarkup(await Page()), calls };
}

test('dashboard counts all pending rows rather than the 50-row review page and preserves true zero', async () => {
  const { html, calls } = await dashboard({ mission_submissions: { count: 70, error: null },
    mission_result_submissions: { count: 1, error: null }, achievement_claims: { count: 0, error: null } });
  assert.match(html, /<strong>71<\/strong>/); assert.match(html, /Tidak ada antrean/);
  for (const call of calls) {
    assert.equal(call.options.count, 'exact'); assert.equal(call.options.head, true); assert.equal(call.value, 'PENDING');
  }
  for (const href of ['/admin/missions', '/admin/results', '/admin/achievements', '/admin/guide']) {
    assert.ok(html.includes(`href="${href}"`));
  }
});

test('failed counts remain unavailable and cannot claim a zero or complete total', async () => {
  const { html } = await dashboard({ mission_submissions: { count: null, error: { message: 'private database error' } },
    mission_result_submissions: { count: 2, error: null }, achievement_claims: { count: 0, error: null } });
  assert.match(html, /<strong>—<\/strong>/); assert.match(html, /role="alert"/);
  assert.match(html, /Belum tersedia/); assert.doesNotMatch(html, /private database error|Semua antrean sudah ditinjau/);
});

test('admin navigation marks only the current queue on deep links and only overview on its root', () => {
  for (const [pathname, target] of [['/admin/results/fixture', '/admin/results'], ['/admin', '/admin'],
    ['/admin/guide', '/admin/guide']]) {
    const Nav = load('components/admin/AdminNavigation.tsx', { 'next/navigation': { usePathname: () => pathname } }).default;
    const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(Nav));
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.ok(html.includes(`href="${target}" aria-current="page"`));
  }
});

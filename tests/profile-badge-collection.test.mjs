import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url), React = require('react');
const render = element => require('react-dom/server').renderToStaticMarkup(element);
const userId = '10000000-0000-4000-8000-000000000001';
const badgeId = '20000000-0000-4000-8000-000000000002';
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => imports[name] ?? require(name) });
  return exports;
}
const badges = load('lib/badges.ts');
const { loadBadgeCollection } = load('lib/badge-collection.ts', { './badges': badges });
const Link = ({ href, children }) => React.createElement('a', { href }, children);
const Collection = load('components/profile/ProfileBadgeCollection.tsx', {
  'next/link': { default: Link },
  './BadgePill': load('components/profile/BadgePill.tsx', {
    'next/link': { default: Link }, '@/lib/badges': badges,
    'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
  }),
  '@/app/profile/badges/EquipBadgeButton': { default: ({ userBadgeId }) =>
    React.createElement('button', { 'data-badge-id': userBadgeId }, 'Pasang di profil') },
}).default;
const row = { user_badge_id: badgeId, reward_context: 'LEADERBOARD', scope_type: 'FAKULTAS',
  rank_position: 2, population_total: 1250, is_equipped: false, awarded_at: '2026-10-19T20:00:00Z',
  badge_definitions: { badge_name: 'Runner-up' }, fakultas: [{ nama_fakultas: 'Fakultas Teknik' }],
  program_studi: null, seasons: { nama_season: 'Season QA' } };
function collectionFixture(result = { data: [row], count: 1, error: null }) {
  const calls = [];
  const q = { select(fields, options) { calls.push(['select', options.count]); return q; },
    eq(key, value) { calls.push(['eq', key, value]); return q; },
    order(key, options) { calls.push(['order', key, options.ascending]); return q; },
    limit(value) { calls.push(['limit', value]); return Promise.resolve(result); } };
  return { calls, run: () => loadBadgeCollection({ from(table) {
    assert.equal(table, 'user_badges'); return q;
  } }, userId) };
}

test('collection is bounded, owner-filtered, equipped-first and maps relation objects/arrays', async () => {
  const f = collectionFixture(), result = await f.run();
  assert.deepEqual(f.calls, [['select', 'exact'], ['eq', 'user_id', userId],
    ['order', 'is_equipped', false], ['order', 'awarded_at', false],
    ['order', 'user_badge_id', true], ['limit', 12]]);
  assert.equal(result.count, 1); assert.equal(result.items[0].badge.label, 'Fakultas Teknik No. 2');
  assert.match(result.items[0].badge.detail, /1\.250 peserta/);
  assert.equal(result.items[0].season, 'Season QA');
  const rank = await collectionFixture({ data: [{ ...row, scope_type: null, rank_position: null,
    reward_context: 'CAREER', badge_definitions: [{ badge_name: 'Gold' }], seasons: [] }], count: 1, error: null }).run();
  assert.equal(rank.items[0].badge.tier, 'gold'); assert.equal(rank.items[0].context, 'Career Rank-Up');
  assert.equal(rank.items[0].season, null);
});

test('collection failure or incomplete relation never pretends to be an empty collection', async () => {
  for (const response of [{ data: null, count: null, error: {} }, { data: [], count: null, error: null },
    { data: [{ ...row, badge_definitions: null }], count: 1, error: null }]) {
    assert.equal(await collectionFixture(response).run(), null);
  }
  const empty = await collectionFixture({ data: [], count: 0, error: null }).run();
  assert.equal(empty.count, 0); assert.equal(empty.items.length, 0);
  assert.match(render(React.createElement(Collection, { collection: empty })), /Belum ada badge di koleksimu/);
  const failed = render(React.createElement(Collection, { collection: null }));
  assert.match(failed, /role="alert"/); assert.doesNotMatch(failed, /Belum ada badge di koleksimu/);
});

test('cards show earned badges, context and exact equip IDs, retaining access to the full collection', async () => {
  const collection = await collectionFixture().run();
  collection.items.push({ ...collection.items[0], id: 'equipped', equipped: true,
    badge: badges.describeBadge({ badgeName: 'Gold', scopeType: null, rankPosition: null, populationTotal: null }) });
  collection.count = 13;
  const html = render(React.createElement(Collection, { collection }));
  for (const text of ['Fakultas Teknik No. 2', '1.250 peserta', 'Season QA', 'Terpasang', '13 badge dimiliki',
    'Lihat semua 13 badge', 'href="/profile/badges"', `data-badge-id="${badgeId}"`]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /data-badge-id="equipped"|Sang Pemimpin|Kolektor Kemenangan/);
});

async function renderPage(path, profileOverride = {}, authenticated = true) {
  const owners = [], queries = [];
  const rows = { profiles: { nama_lengkap: 'QA', role_app: 'STUDENT', status_akun: 'ACTIVE',
    primary_class_id: 1, program_studi_id: 1, tahun_masuk: 2024, ...profileOverride },
  primary_classes: [], skills: [], user_skills: [], career_xp_totals: { career_xp: 0 },
  program_studi: { nama_program_studi: 'QA', fakultas_id: 1 }, fakultas: { nama_fakultas: 'Teknik' },
  seasons: null, rank_rules: [{ rank_name: 'Bronze', min_xp: 0, max_xp: 299 }], user_badges: null };
  const client = { auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null } }) },
    from(table) { queries.push(table); assert.ok(Object.hasOwn(rows, table), table);
      const result = { data: rows[table], error: null };
      const q = { select: () => q, eq: () => q, order: () => q, maybeSingle: async () => result,
        then: resolve => Promise.resolve(result).then(resolve) }; return q; } };
  const page = load(path, new Proxy({
    'next/navigation': { redirect: to => { throw Error('REDIRECT:' + to); } },
    'next/link': { default: Link }, '@/lib/badges': badges,
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/badge-collection': { loadBadgeCollection: async (db, id) => {
      assert.equal(db, client); owners.push(id); return collectionFixture().run();
    } },
    '@/lib/endorsements': { loadEndorsementSummary: async () => ({}) },
    '@/lib/season-history': { loadSeasonHistory: async () => ({ items: [], count: 0 }) },
    '@/lib/mission-history': { loadMissionHistory: async () => ({ items: [], count: 0 }) },
    '@/components/profile/ProfileBadgeCollection': { default: Collection },
  }, { get(target, name) { return target[name] ?? (name.startsWith('@/components/') || name.startsWith('./')
    ? { default: () => null } : undefined); } })).default;
  return { run: async () => render(await page()), owners, queries };
}

test('Profile and Edit Profile expose the authenticated owner collection, after account guards', async () => {
  for (const path of ['app/profile/page.tsx', 'app/profile/edit/page.tsx']) {
    const f = await renderPage(path), html = await f.run();
    assert.match(html, /Badge Chest/); assert.match(html, /Fakultas Teknik No. 2/);
    assert.deepEqual(f.owners, [userId]);
    for (const [override, auth, redirect] of [[{}, false, '/login'], [{ role_app: 'ADMIN' }, true, '/admin'],
      [{ primary_class_id: null }, true, '/onboarding']]) {
      const blocked = await renderPage(path, override, auth);
      await assert.rejects(blocked.run, new RegExp('REDIRECT:' + redirect)); assert.equal(blocked.owners.length, 0);
    }
    const inactive = await renderPage(path, { status_akun: 'SUSPENDED' });
    assert.doesNotMatch(await inactive.run(), /Badge Chest/); assert.equal(inactive.owners.length, 0);
  }
});

function actionFixture(overrides = {}) {
  const profile = { role_app: 'STUDENT', status_akun: 'ACTIVE', primary_class_id: 1, ...overrides.profile };
  const calls = [], invalidations = [], filters = [];
  const { equipBadge } = load('app/profile/badges/actions.ts', {
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/lib/supabase/server': { createClient: async () => {
      calls.push('client'); return {
        auth: { getUser: async () => ({ data: { user: overrides.anonymous ? null : { id: userId } } }) },
        from(table) { calls.push(table); const q = { select: () => q,
          eq(key, value) { filters.push([table, key, value]); return q; },
          maybeSingle: async () => ({ data: table === 'profiles' ? profile
            : overrides.foreign ? null : { user_badge_id: badgeId, is_equipped: !!overrides.equipped } }) }; return q; },
        rpc: async (name, args) => { calls.push([name, args.p_user_badge_id]); return { error: overrides.rpcError ?? null }; },
      };
    } },
  });
  return { calls, invalidations, filters, run: (id = badgeId) => equipBadge(id) };
}

test('equip action enforces ownership/account access before RPC and refreshes all three profile surfaces', async () => {
  for (const overrides of [{ anonymous: true }, { foreign: true }, { profile: { role_app: 'ADMIN' } },
    { profile: { status_akun: 'SUSPENDED' } }, { profile: { primary_class_id: null } }]) {
    const f = actionFixture(overrides); assert.equal((await f.run()).success, false);
    assert.equal(f.calls.some(Array.isArray), false); assert.equal(f.invalidations.length, 0);
  }
  const invalid = actionFixture(); assert.equal((await invalid.run('bad-id')).success, false);
  assert.equal(invalid.calls.length, 0);
  const own = actionFixture(); assert.equal((await own.run()).success, true);
  assert.deepEqual(own.filters, [['profiles', 'user_id', userId], ['user_badges', 'user_id', userId],
    ['user_badges', 'user_badge_id', badgeId]]);
  assert.deepEqual(own.calls.at(-1), ['equip_badge', badgeId]);
  assert.deepEqual(own.invalidations, ['/profile/badges', '/profile', '/profile/edit']);
  const already = actionFixture({ equipped: true }); assert.equal((await already.run()).success, true);
  assert.equal(already.calls.some(Array.isArray), false);
  const failed = actionFixture({ rpcError: {} }); assert.equal((await failed.run()).success, false);
  assert.equal(failed.invalidations.length, 0);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url), React = require('react');
const render = element => require('react-dom/server').renderToStaticMarkup(element);
const viewer = '10000000-0000-4000-8000-000000000001';
const peer = '20000000-0000-4000-8000-000000000002';
const mission = '30000000-0000-4000-8000-000000000003';
const Link = ({ href, children, className }) => React.createElement('a', { href, className }, children);
const Image = ({ src, alt, width, height }) => React.createElement('img', { src, alt, width, height });
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => imports[name] ?? require(name) });
  return exports;
}
const badges = load('lib/badges.ts');
const { loadPeerReputation } = load('lib/peer-reputation.ts', {
  './badges': badges, './rank-progress': load('lib/rank-progress.ts'),
});
function fixture(overrides = {}, errors = []) {
  const rows = {
    career_xp_totals: { career_xp: 1250 },
    rank_rules: [{ rank_name: 'Bronze', min_xp: 0, max_xp: 299 },
      { rank_name: 'Gold', min_xp: 1000, max_xp: 2499 }],
    user_badges: { badge_definitions: { badge_name: 'Contender' }, scope_type: 'PROGRAM_STUDI',
      rank_position: 54, population_total: 1200, program_studi: [{ nama_program_studi: 'Bisnis Digital' }] },
    history: [
      { history_id: 'public-1', source: 'SQUAD', name: 'Kompetisi <QA>', organizer: 'UNESA',
        squad_name: 'QA Squad', result: 'JUARA_1', earned_at: '2026-10-20', xp: 300, mission_id: mission },
      { history_id: 'public-2', source: 'EXTERNAL', name: 'Prestasi luar Squad', organizer: 'QA',
        squad_name: null, result: 'FINALIST', earned_at: '2026-10-19', xp: 100, mission_id: null },
    ], ...overrides,
  }, calls = [];
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'get_peer_verified_mission_history');
    assert.equal(args.p_user_id, peer);
    calls.push({ table: 'history', filters: [['user_id', args.p_user_id]] });
    return { data: errors.includes('history') ? null : rows.history, error: errors.includes('history') ? {} : null };
  }, from(table) {
    assert.ok(Object.hasOwn(rows, table), `Private or unexpected query: ${table}`);
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const result = { data: errors.includes(table) ? null : rows[table], error: errors.includes(table) ? {} : null };
    const q = { select(fields) { call.fields = fields; return q; },
      eq(key, value) { call.filters.push([key, value]); return q; },
      order(key, options) { call.orders.push([key, options.ascending]); return q; },
      limit(value) { call.limit = value; return q; },
      maybeSingle: async () => result, then: resolve => Promise.resolve(result).then(resolve) };
    return q;
  } };
  return { calls, run: () => loadPeerReputation(client, peer) };
}

test('peer reputation reads only the requested user, one equipped badge and three newest public results', async () => {
  const f = fixture(), result = await f.run();
  assert.equal(result.xp, 1250); assert.equal(result.rankName, 'Gold'); assert.equal(result.rankIcon, '/ranks/gold.png');
  assert.equal(result.badge.label, 'Bisnis Digital No. 54'); assert.match(result.badge.detail, /1\.200 peserta/);
  assert.equal(result.history[0].source, 'SQUAD'); assert.equal(result.history[1].squadName, null);
  for (const call of f.calls.filter(c => c.table !== 'rank_rules')) assert.deepEqual(call.filters[0], ['user_id', peer]);
  assert.deepEqual(f.calls.find(c => c.table === 'user_badges').filters, [['user_id', peer], ['is_equipped', true]]);
  assert.equal(f.calls.filter(c => c.table === 'history').length, 1);
});

test('new users keep genuine zero XP while unavailable data never becomes zero or an empty history', async () => {
  const empty = await fixture({ career_xp_totals: { career_xp: 0 }, user_badges: null,
    history: [] }).run();
  assert.equal(empty.xp, 0); assert.equal(empty.rankName, 'Bronze'); assert.equal(empty.badge, null);
  assert.equal(empty.badgeFailed, false); assert.equal(empty.history.length, 0);
  const failed = await fixture({}, ['career_xp_totals', 'user_badges', 'history']).run();
  assert.equal(failed.xp, null); assert.equal(failed.rankName, null); assert.equal(failed.badgeFailed, true);
  assert.equal(failed.history, null);
  assert.equal((await fixture({}, ['rank_rules']).run()).xp, 1250);
  for (const invalid of [null, { career_xp: null }, { career_xp: NaN }, { career_xp: -1 }]) {
    assert.equal((await fixture({ career_xp_totals: invalid }).run()).xp, null);
  }
  const arrayBadge = await fixture({ user_badges: { badge_definitions: [{ badge_name: 'Gold' }] } }).run();
  assert.equal(arrayBadge.badge.label, 'Gold'); assert.equal(arrayBadge.badge.tier, 'gold');
});

async function page(reputation) {
  const client = { auth: { getUser: async () => ({ data: { user: { id: viewer } }, error: null }) },
    from(table) { const q = { select() { return q; }, eq() { return q; },
      maybeSingle: async () => ({ data: table === 'profiles'
        ? { nama_lengkap: 'Viewer', role_app: 'STUDENT', status_akun: 'ACTIVE' }
        : table === 'public_profiles' ? { nama_lengkap: 'Calon anggota', bio: 'Bio QA', primary_class_id: 1, program_studi_id: 1, tahun_masuk: 2024 }
          : { nama_class: 'Creative', nama_program_studi: 'Bisnis Digital', fakultas_id: 1, nama_fakultas: 'FEB' }, error: null }),
      then: resolve => Promise.resolve({ data: [{ skills: { nama_skill: 'Figma' } }], error: null }).then(resolve) }; return q; } };
  const image = { 'next/image': { default: Image } }, link = { 'next/link': { default: Link } };
  const fields = ['communication', 'contribution', 'teamwork', 'responsibility'].map(k => [k, k]);
  const Page = load('app/profile/[userId]/page.tsx', {
    ...image, ...link, 'next/navigation': { redirect: to => { throw Error(to); }, notFound: () => { throw Error('404'); } },
    '@/components/layout/Navbar': { default: () => null },
    '@/components/profile/BadgePill': load('components/profile/BadgePill.tsx', { ...image, ...link, '@/lib/badges': badges }),
    '@/components/profile/PeerCareerSummary': load('components/profile/PeerCareerSummary.tsx', image),
    '@/components/profile/MissionHistoryList': load('components/profile/MissionHistoryList.tsx', link),
    '@/components/profile/ProfileHero': load('components/profile/ProfileHero.tsx', image),
    '@/components/profile/EndorsementPanel': load('components/profile/EndorsementPanel.tsx'),
    '@/components/profile/XpProgressCard': load('components/profile/XpProgressCard.tsx', {
      '@/lib/rank-progress': load('lib/rank-progress.ts'),
    }),
    '@/components/profile/RankSwitcherCard': load('components/profile/RankSwitcherCard.tsx', {
      ...image, '@/lib/badges': badges, '@/lib/rank-progress': load('lib/rank-progress.ts'),
    }),
    '@/lib/badges': badges,
    '@/lib/peer-reputation': { loadPeerReputation: async () => reputation },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/endorsements': { loadSharedCompletedSquads: async () => [], loadEndorsementSummary: async () => ({
      count: 2, averages: Object.fromEntries(fields.map(([k]) => [k, 4.5])),
    }) }, './EndorsementForm': { default: () => { throw Error('Pending applicants cannot be rated'); } },
  }).default;
  return render(await Page({ params: Promise.resolve({ userId: peer }), searchParams: Promise.resolve({ mission }) }));
}

test('public profile renders rank, badge context, verified results and endorsement count with no owner-only controls', async () => {
  const html = await page(await fixture().run());
  for (const text of ['Gold', '1.250 XP', 'Career XP', 'Bisnis Digital No. 54', '1.200 peserta', 'Figma',
    'Kompetisi &lt;QA&gt;', 'Juara 1', 'Prestasi di luar Squad NEXUS', 'Berdasarkan 2 Endorsement', '4.5']) assert.ok(html.includes(text), text);
  assert.ok(html.includes(`href="/missions/${mission}"`));
  assert.doesNotMatch(html, /Edit Profil|Klaim Achievement|Lihat Selengkapnya|\/profile\/missions|sertifikat|NIM/);
});

test('profile empty and error messages remain distinct for XP, badge and verified history', async () => {
  const empty = await page(await fixture({ career_xp_totals: { career_xp: 0 }, user_badges: null,
    history: [] }).run());
  assert.match(empty, /Bronze/); assert.match(empty, /0 XP/);
  assert.match(empty, /Belum ada Badge terpasang/); assert.match(empty, /Belum ada hasil atau prestasi terverifikasi/);
  const failed = await page(await fixture({}, ['career_xp_totals', 'user_badges', 'history']).run());
  assert.match(failed, /Career XP belum dapat dimuat/); assert.match(failed, /Badge terpasang belum dapat dimuat/);
  assert.match(failed, /Riwayat Mission belum dapat dimuat/);
  assert.doesNotMatch(failed, /0 Career XP|Belum ada Badge terpasang|Belum ada hasil atau prestasi terverifikasi/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url), React = require('react');
const render = element => require('react-dom/server').renderToStaticMarkup(element);
const Link = ({ href, children }) => React.createElement('a', { href }, children);
const id = '10000000-0000-4000-8000-000000000001';
const peer = '20000000-0000-4000-8000-000000000002';
const squadId = '30000000-0000-4000-8000-000000000003';
const otherId = '40000000-0000-4000-8000-000000000004';
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] ?? require(name) });
  return exports;
}
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walk(child, fn)); return; }
  fn(node); walk(node.props?.children, fn);
}
function setup(options = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id } }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const rows = table === 'finalized_squad_members' ? options.empty ? [] : [
        ...options.leftBefore ? [] : [{ user_id: id, status_member: options.former ? 'LEFT' : 'ACTIVE' }],
        { user_id: peer, status_member: 'ACTIVE' }, { user_id: peer, status_member: 'LEFT' }]
        : table === 'endorsements' ? options.rated ? [{ to_user_id: peer }] : []
        : [{ user_id: peer, nama_lengkap: 'Rekan <QA>' }];
      const q = {
        select(fields) { call.fields = fields; return q; },
        eq(key, value) { call.filters.push([key, value]); return q; }, limit() { return q; },
        in(key, values) { call.filters.push([key, Array.from(values)]); return q; },
        maybeSingle: async () => ({ data: table === 'profiles'
          ? { nama_lengkap: 'QA', role_app: options.admin ? 'ADMIN' : 'STUDENT',
              status_akun: options.suspended ? 'SUSPENDED' : 'ACTIVE', primary_class_id: options.onboarding ? null : 1 }
          : table === 'squad_members' ? options.outsider ? null : { squad_id: squadId }
          : table === 'mission_result_submissions' ? { status_validation: 'APPROVED',
              hasil_kompetisi: 'JUARA_1', approved_hasil_kompetisi: 'PARTICIPANT',
              xp_transactions: options.former ? [] : [{ xp_amount: 230 }] }
          : { nama_squad: 'QA Squad', status_squad: options.status ?? 'MISSION_COMPLETED',
              mission_id: otherId, completed_at: options.expired ? '2020-01-01T00:00:00Z' : new Date().toISOString() },
          error: options.error === table ? {} : null }),
        then: resolve => Promise.resolve({ data: options.error === table ? null : rows,
          error: options.error === table ? {} : null }).then(resolve),
      };
      return q;
    },
  };
  const Page = load('../src/app/squads/[squadId]/endorsements/page.tsx', {
    'next/link': { default: Link },
    'next/navigation': { redirect: to => { throw Error('redirect:' + to); }, notFound: () => { throw Error('404'); } },
    '@/components/layout/Navbar': { default: () => null },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/endorsement-window': load('../src/lib/endorsement-window.ts'),
    '../result/types': load('../src/app/squads/[squadId]/result/types.ts'),
  }).default;
  return { calls, run: (routeId = squadId) => Page({ params: Promise.resolve({ squadId: routeId }) }) };
}

test('completed history exposes a roster link for active and former members, with prefetch disabled', () => {
  const Card = load('../src/app/my-squad/SquadCard.tsx', {
    'next/link': { default: Link }, './formatters': load('../src/app/my-squad/formatters.ts'),
  }).default;
  for (const status of ['MISSION_COMPLETED', 'DISBANDED', 'FINALIZED', 'FULL']) {
    for (const membershipStatus of ['ACTIVE', 'LEFT']) {
      const element = Card({ variant: 'history', historyDetailsLoadFailed: false, item: {
        squadId, missionId: 'mission', squadName: 'QA', missionName: 'QA', organizer: 'QA',
        squadStatus: status, membershipStatus, role: 'ANGGOTA', scope: 'INTERNAL', mode: 'ONLINE', cost: 'GRATIS',
        capacity: 2, activeMemberCount: 2, joinedAt: '2026-10-01', historyDate: '2026-10-14', earnedXp: 0,
      } });
      const links = []; walk(element, node => { if (node.props?.href?.endsWith('/endorsements')) links.push(node.props); });
      assert.equal(links.length, status === 'MISSION_COMPLETED' ? 1 : 0);
      if (links.length) assert.equal(links[0].prefetch, false);
      if (status === 'MISSION_COMPLETED') {
        const html = render(element);
        assert.match(html, />Detail Squad</); assert.match(html, />Lihat Mission</);
        assert.doesNotMatch(html, /Lihat Hasil Mission|>Nilai rekan</);
        assert.equal((html.match(/<a /g) ?? []).length, 2);
      }
    }
  }
});
test('roster route denies invalid IDs, anonymous/admin/suspended/nonmember and unfinished Squads', async () => {
  const invalid = setup(); await assert.rejects(invalid.run('bad'), /404/); assert.equal(invalid.calls.length, 0);
  for (const options of [{ anonymous: true }, { admin: true }, { suspended: true }, { outsider: true },
    { status: 'FINALIZED' }, { status: 'DISBANDED' }]) {
    const s = setup(options); await assert.rejects(s.run(), options.admin ? /redirect:\/admin/ : /404|redirect:\/login/);
    assert.ok(!s.calls.some(c => c.table === 'endorsements' || c.table === 'public_profiles'));
  }
  await assert.rejects(setup({ onboarding: true }).run(), /redirect:\/onboarding/);
});
test('finalized roster uses one bulk public-name query, shows self without a rating link and preserves Squad context', async () => {
  const s = setup(), element = await s.run(), html = render(element);
  assert.match(html, /Rekan &lt;QA&gt;/);
  assert.match(html, /QA \(Kamu\)/); assert.match(html, /Anggota saat finalisasi/);
  assert.doesNotMatch(html, new RegExp('/profile/' + id));
  assert.equal(s.calls.filter(c => c.table === 'finalized_squad_members').length, 1);
  assert.match(html, new RegExp('/profile/' + peer + '\\?squad=' + squadId));
  const names = s.calls.filter(c => c.table === 'public_profiles'); assert.equal(names.length, 1);
  assert.equal(names[0].fields, 'user_id,nama_lengkap');
  assert.deepEqual(names[0].filters, [['user_id', [peer]]]);
  assert.ok(s.calls.find(c => c.table === 'squad_members').filters.some(([key, value]) => key === 'user_id' && value === id));
  const rated = s.calls.find(c => c.table === 'endorsements');
  assert.deepEqual(rated.filters, [['squad_id', squadId], ['from_user_id', id]]);
  walk(element, node => { if (node.props?.href?.startsWith('/profile/')) assert.equal(node.props.prefetch, false); });
});
test('roster distinguishes already rated, expired, empty and failed reads', async () => {
  assert.match(render(await setup({ rated: true }).run()), /Sudah dinilai/);
  const expired = render(await setup({ expired: true }).run());
  assert.match(expired, /Penilaian sudah ditutup/); assert.match(expired, />Lihat profil</);
  const empty = setup({ empty: true }); assert.match(render(await empty.run()), /Data anggota saat finalisasi belum tersedia/);
  assert.ok(!empty.calls.some(c => c.table === 'public_profiles'));
  const failed = render(await setup({ error: 'public_profiles' }).run());
  assert.match(failed, /role="alert"/); assert.doesNotMatch(failed, /Data anggota saat finalisasi belum tersedia/);
});

test('a member who left before finalization retains history but cannot see rating buttons', async () => {
  const html = render(await setup({ leftBefore: true, former: true }).run());
  assert.match(html, /Kamu bukan anggota saat finalisasi/); assert.match(html, />Lihat profil</);
  assert.doesNotMatch(html, />Nilai rekan</); assert.doesNotMatch(html, /QA \(Kamu\)/);
  assert.doesNotMatch(html, /Lihat pengajuan hasil/);
  const failed = render(await setup({ error: 'finalized_squad_members' }).run());
  assert.match(failed, /role="alert"/); assert.doesNotMatch(failed, />Nilai rekan</);
});

test('Detail Squad shows the approved result and owner-scoped XP; former members retain history without private result-page access', async () => {
  const s = setup(), html = render(await s.run());
  assert.match(html, /<h1[^>]*>Detail Squad/);
  assert.match(html, /Hasil Squad: Participant/); assert.match(html, /XP kamu: \+230 XP/);
  assert.match(html, /Lihat pengajuan hasil/);
  const result = s.calls.find(c => c.table === 'mission_result_submissions');
  assert.ok(result.fields.includes('xp_transactions(xp_amount)'));
  assert.deepEqual(result.filters, [['squad_id', squadId], ['xp_transactions.user_id', id]]);
  const former = render(await setup({ former: true }).run());
  assert.match(former, /Hasil Squad: Participant/); assert.match(former, /XP kamu: Tidak tercatat/);
  assert.doesNotMatch(former, /Lihat pengajuan hasil/); assert.match(former, /Rekan &lt;QA&gt;/);
  const failed = render(await setup({ error: 'mission_result_submissions' }).run());
  assert.match(failed, /Ringkasan hasil belum dapat dimuat/); assert.match(failed, /Rekan &lt;QA&gt;/);
  assert.doesNotMatch(failed, /XP kamu: \+230/);
});

test('profile context uses only an eligible shared Squad and keeps the return link; other parameters do not authorize access', async () => {
  const Form = () => null, Navbar = () => null;
  const shared = [{ squadId, name: 'Selected Squad' }, { squadId: otherId, name: 'Another Squad' }];
  const client = { auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
    from(table) { const q = { select() { return q; }, eq() { return q; }, order() { return q; },
      then: resolve => Promise.resolve({ data: [], error: null }).then(resolve),
      maybeSingle: async () => ({ data: table === 'profiles'
        ? { nama_lengkap: 'QA', role_app: 'STUDENT', status_akun: 'ACTIVE' }
        : table === 'public_profiles' ? { nama_lengkap: 'Peer', primary_class_id: null, program_studi_id: 1 }
          : { nama_program_studi: 'QA', fakultas_id: 1, nama_fakultas: 'QA' }, error: null }) }; return q; } };
  const Page = load('../src/app/profile/[userId]/page.tsx', {
    'next/link': { default: Link }, 'next/image': { default: () => null },
    'next/navigation': { redirect: to => { throw Error(to); }, notFound: () => { throw Error('404'); } },
    '@/components/layout/Navbar': { default: Navbar }, '@/components/profile/EndorsementSummary': { default: () => null },
    '@/components/profile/BadgePill': { default: () => null }, '@/components/profile/ProfileHero': { default: () => null },
    '@/components/profile/EndorsementPanel': { default: () => null }, '@/components/profile/XpProgressCard': { default: () => null },
    '@/components/profile/RankSwitcherCard': { default: () => null }, '@/lib/badges': load('../src/lib/badges.ts'),
    '@/components/profile/MissionHistoryList': { default: () => null },
    '@/components/profile/PeerCareerSummary': { default: () => null },
    '@/lib/peer-reputation': { loadPeerReputation: async () => ({ xp: null, rankName: null, rules: [], badge: null, badgeFailed: false, history: [] }) },
    '@/lib/supabase/server': { createClient: async () => client }, './EndorsementForm': { default: Form },
    '@/lib/endorsements': { loadEndorsementSummary: async () => ({}), loadSharedCompletedSquads: async () => shared },
  }).default;
  for (const value of [squadId, 'https://example.com', id, [squadId], undefined]) {
    const element = await Page({ params: Promise.resolve({ userId: peer }), searchParams: Promise.resolve({ squad: value }) });
    let form, nav; const links = [];
    walk(element, node => { if (node.type === Form) form = node.props;
      if (node.type === Navbar) nav = node.props; if (node.props?.href) links.push(node.props.href); });
    assert.equal(form.squads.length, value === squadId ? 1 : 2);
    assert.equal(nav.activeItem, value === squadId ? 'my-squad' : 'leaderboard');
    assert.ok(links.includes(value === squadId ? '/squads/' + squadId + '/endorsements' : '/leaderboard'));
  }
});

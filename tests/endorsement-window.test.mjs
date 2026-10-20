import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => imports[id] ?? require(id), ...globals });
  return exports;
}
const start = Date.parse('2026-10-01T12:00:00Z'), end = start + 336 * 3600_000;
class Clock extends Date { static now() { return start + 3600_000; } }
const window = load('../src/lib/endorsement-window.ts', {}, { Date: Clock });
const lib = load('../src/lib/endorsements.ts', { './endorsement-window': window });
const id = '10000000-0000-4000-8000-000000000001';
const peer = '20000000-0000-4000-8000-000000000002';
const scores = { communication: 4, contribution: 4, teamwork: 4, responsibility: 4 };

test('window opens at completion, closes exactly at 336 hours, and rejects missing/future/invalid time', () => {
  for (const [at, open] of [[start - 1, false], [start, true], [end - 1, true], [end, false], [end + 1, false]]) {
    assert.equal(window.endorsementWindow('2026-10-01T19:00:00+07:00', at).windowOpen, open);
  }
  assert.equal(window.endorsementWindow('2026-10-01T12:00:00Z').closesAt, '2026-10-15T12:00:00.000Z');
  for (const invalid of [null, '', 'bad']) assert.equal(window.endorsementWindow(invalid).windowOpen, false);
});

test('shared Squad loader reads finalized participants without dropping expired ratings or post-finalization removals', async () => {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const data = table === 'finalized_squad_members' ? [{ squad_id: id }]
      : table === 'squads' ? [{ squad_id: id, nama_squad: 'Old Squad', completed_at: '2026-09-01T00:00:00Z' }]
        : [{ squad_id: id }];
    const q = { select(fields) { call.fields = fields; return q; },
      eq(k, v) { call.filters.push([k, v]); return q; }, in() { return q; },
      then(resolve) { return Promise.resolve({ data, error: null }).then(resolve); } };
    return q;
  } };
  const result = await lib.loadSharedCompletedSquads(client, id, peer);
  assert.equal(calls.length, 4);
  assert.equal(calls.filter(c => c.table === 'finalized_squad_members').length, 2);
  assert.ok(calls.find(c => c.table === 'squads').fields.includes('completed_at'));
  assert.ok(!calls.some(c => c.filters.some(([key]) => key === 'status_member')));
  assert.equal(result[0].alreadyRated, true); assert.equal(result[0].windowOpen, false);
  assert.equal(result[0].closesAt, '2026-09-15T00:00:00.000Z');
});

function setup(completedAt, insertError = null, members = [{ user_id: id }, { user_id: peer }]) {
  const calls = [], refreshed = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
    from(table) {
      const q = { select() { return q; }, eq() { return q; }, in() { return q; },
        maybeSingle: async () => ({ data: table === 'profiles'
          ? { role_app: 'STUDENT', status_akun: 'ACTIVE', primary_class_id: 1 }
          : { status_squad: 'MISSION_COMPLETED', completed_at: completedAt }, error: null }),
        then: resolve => Promise.resolve({ data: table === 'finalized_squad_members' ? members : [], error: null }).then(resolve),
        insert: async row => { calls.push(row); return { error: insertError }; } };
      return q;
    },
  };
  const action = load('../src/app/profile/[userId]/actions.ts', {
    'next/cache': { revalidatePath: path => refreshed.push(path) },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/endorsements': lib, '@/lib/endorsement-window': window,
  }).submitEndorsement;
  return { action, calls, refreshed };
}
test('action rejects a nonparticipant sender or recipient before INSERT', async () => {
  for (const members of [[], [{ user_id: id }], [{ user_id: peer }]]) {
    const s = setup('2026-10-01T12:00:00Z', null, members);
    const result = await s.action(peer, id, scores);
    assert.equal(result.success, false); assert.match(result.message, /saat finalisasi/);
    assert.equal(s.calls.length, 0); assert.equal(s.refreshed.length, 0);
  }
});
test('shared Squad loader excludes a pair when either user was absent at finalization', async () => {
  for (const absent of [id, peer]) {
    const calls = [];
    const client = { from(table) {
      const call = { table }; calls.push(call);
      const q = { select() { return q; }, eq(key, value) { call[key] = value; return q; }, in() { return q; },
        then(resolve) { return Promise.resolve({ data: table === 'finalized_squad_members'
          ? call.user_id === absent ? [] : [{ squad_id: id }]
          : table === 'squads' ? [{ squad_id: id, nama_squad: 'QA', completed_at: new Date(start).toISOString() }] : [],
          error: null }).then(resolve); } }; return q;
    } };
    assert.equal((await lib.loadSharedCompletedSquads(client, id, peer)).length, 0);
    assert.equal(calls.length, absent === id ? 1 : 4);
  }
});
test('expired/missing/future completion is rejected before INSERT and cannot report success', async () => {
  for (const at of ['2026-09-01T00:00:00Z', null, '2026-10-02T00:00:00Z']) {
    const s = setup(at), result = await s.action(peer, id, scores);
    assert.equal(result.success, false); assert.equal(result.windowClosed, true);
    assert.equal(s.calls.length, 0); assert.equal(s.refreshed.length, 0);
  }
});
test('open window sends caller-owned rating; expiry during INSERT returns a safe closure response', async () => {
  const s = setup('2026-10-01T12:00:00Z');
  assert.equal((await s.action(peer, id, scores)).success, true);
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].from_user_id, id);
  assert.equal(s.refreshed.length, 3);
  assert.ok(s.refreshed.includes(`/squads/${id}/endorsements`));
  const raced = setup('2026-10-01T12:00:00Z', { code: 'P0001', message: 'Endorsement window is closed' });
  const result = await raced.action(peer, id, scores);
  assert.equal(result.success, false); assert.equal(result.windowClosed, true);
  assert.equal(raced.refreshed.length, 0); assert.doesNotMatch(result.message, /P0001/);
});
test('duplicate rating stays rejected within the open window', async () => {
  const s = setup('2026-10-01T12:00:00Z', { code: '23505' });
  assert.match((await s.action(peer, id, scores)).message, /sudah menilai/);
  assert.equal(s.refreshed.length, 0);
});
test('form renders a WIB deadline, closes expired choices and preserves already-rated status', () => {
  const Form = load('../src/app/profile/[userId]/EndorsementForm.tsx', {
    'next/navigation': { useRouter: () => ({ refresh() {} }) }, '@/lib/endorsements': lib, './actions': {},
  }).default;
  const React = require('react'), render = squads => require('react-dom/server').renderToStaticMarkup(
    React.createElement(Form, { targetUserId: peer, squads }));
  const base = { squadId: id, name: 'Squad', alreadyRated: false,
    closesAt: '2026-10-15T12:00:00Z', windowOpen: true };
  assert.match(render([base]), /Batas penilaian:.*15 Oktober 2026.*19\.00.*WIB/);
  const closed = render([{ ...base, windowOpen: false }]);
  assert.match(closed, /Penilaian ditutup: Squad/); assert.doesNotMatch(closed, /<form/);
  const rated = render([{ ...base, windowOpen: false, alreadyRated: true }]);
  assert.match(rated, /Sudah dinilai: Squad/); assert.doesNotMatch(rated, /<form|Penilaian ditutup:/);
});

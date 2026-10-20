import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Real Server Action with API-shaped responses. Does not replace DB or browser QA.
const source = readFileSync(new URL('../src/app/squads/[squadId]/actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const actorId = '10000000-0000-4000-8000-000000000001';
const targetId = '10000000-0000-4000-8000-000000000002';
const squadId = '20000000-0000-4000-8000-000000000001';
const missionId = '30000000-0000-4000-8000-000000000001';
function setup(overrides = {}) {
  const calls = [], paths = [], queries = [];
  let clients = 0;
  const rows = {
    profiles: { status_akun: 'ACTIVE', role_app: 'STUDENT' },
    squads: { ketua_id: actorId, status_squad: 'FULL', mission_id: missionId },
    ...overrides.rows,
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: overrides.loggedOut ? null : { id: actorId } }, error: null }) },
    from(table) {
      queries.push(table);
      const builder = { select() { return builder; }, eq() { return builder; },
        maybeSingle: async () => ({ data: rows[table], error: null }) };
      return builder;
    },
    async rpc(name, args) { calls.push({ name, args }); return { error: overrides.rpcError ?? null }; },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(id) {
    if (id === 'next/cache') return { revalidatePath: p => paths.push(p) };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; return client; } };
    throw Error(`Unexpected import ${id}`);
  } });
  return { run: exports.transferSquadLeadership, calls, paths, queries, clients: () => clients };
}
test('rejects malformed IDs before authentication/network work', async () => {
  for (const args of [[null, targetId], [squadId, {}], ['bad', targetId]]) {
    const s = setup(); assert.equal((await s.run(...args)).success, false); assert.equal(s.clients(), 0);
  }
});
test('logged-out, suspended and admin actors cannot transfer', async () => {
  for (const options of [{ loggedOut: true }, { rows: { profiles: { status_akun: 'SUSPENDED', role_app: 'STUDENT' } } },
    { rows: { profiles: { status_akun: 'ACTIVE', role_app: 'ADMIN' } } }]) {
    const s = setup(options); assert.equal((await s.run(squadId, targetId)).success, false); assert.equal(s.calls.length, 0);
  }
});
test('self, nonleader and finalized transfers do not call RPC', async () => {
  const own = setup(); assert.equal((await own.run(squadId, actorId)).success, false); assert.equal(own.calls.length, 0);
  for (const squad of [{ ketua_id: targetId, status_squad: 'FULL' }, { ketua_id: actorId, status_squad: 'FINALIZED' },
    { ketua_id: actorId, status_squad: 'MISSION_COMPLETED' }, null]) {
    const s = setup({ rows: { squads: squad } });
    assert.equal((await s.run(squadId, targetId)).success, false); assert.equal(s.calls.length, 0);
  }
});
test('successful transfer sends exact RPC parameters and refreshes affected pages', async () => {
  const s = setup(); assert.equal((await s.run(squadId, targetId)).success, true);
  assert.equal(s.calls[0].name, 'transfer_squad_leadership');
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0].args)), { p_squad_id: squadId, p_new_leader_id: targetId });
  assert.deepEqual(s.paths, [`/squads/${squadId}`, '/my-squad', `/missions/${missionId}`, '/']);
});
test('database race rejection reports failure without success refresh or internal details', async () => {
  for (const message of ['The successor must be an active Student member', 'SQL internal detail secret']) {
    const s = setup({ rpcError: { code: '22023', message } }); const result = await s.run(squadId, targetId);
    assert.equal(result.success, false); assert.doesNotMatch(result.message, /SQL internal|secret/);
    assert.equal(s.calls.length, 1); assert.equal(s.paths.length, 0);
  }
});

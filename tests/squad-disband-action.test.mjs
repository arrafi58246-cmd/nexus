import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Real Server Action with API-shaped responses. Does not replace DB or browser QA.
const source = readFileSync(new URL('../src/app/squads/[squadId]/disband-actions.ts', import.meta.url), 'utf8');
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
    profiles: { status_akun: 'ACTIVE', role_app: 'STUDENT', primary_class_id: 1 },
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
  return { run: exports.disbandSoloSquad, calls, paths, queries, clients: () => clients };
}
test('disband rejects malformed IDs without network work',async()=>{
 for(const id of [null,{},'bad']){const s=setup();assert.equal((await s.run(id)).success,false);assert.equal(s.clients(),0);}
});
test('disband rejects logged-out, admin, suspended and incomplete profiles',async()=>{
 for(const options of [{loggedOut:true},{rows:{profiles:{role_app:'ADMIN',status_akun:'ACTIVE',primary_class_id:1}}},
 {rows:{profiles:{role_app:'STUDENT',status_akun:'SUSPENDED',primary_class_id:1}}},
 {rows:{profiles:{role_app:'STUDENT',status_akun:'ACTIVE',primary_class_id:null}}}]){
 const s=setup(options);assert.equal((await s.run(squadId)).success,false);assert.equal(s.calls.length,0);}
});
test('disband rejects nonleader and finalized/completed squads',async()=>{
 for(const squad of [{ketua_id:targetId,status_squad:'FULL'},...['FINALIZED','MISSION_COMPLETED'].map(status_squad=>({ketua_id:actorId,status_squad})),null]){
 const s=setup({rows:{squads:squad}});assert.equal((await s.run(squadId)).success,false);assert.equal(s.calls.length,0);}
});
test('disband succeeds through exact RPC and refreshes relevant pages',async()=>{
 const s=setup();assert.equal((await s.run(squadId)).success,true);assert.equal(s.calls[0].name,'disband_solo_squad');
 assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0].args)),{p_squad_id:squadId});
 assert.deepEqual(s.paths,['/my-squad','/','/missions','/notifications',`/missions/${missionId}`,`/squads/${squadId}`]);
});
test('disband races fail safely without success revalidation or raw SQL details',async()=>{
 for(const error of [{code:'40001',message:'Recruitment changed'},
 {code:'22023',message:'Only a solo active leader can disband'},{code:'XX000',message:'SQL internal secret'}]){
 const s=setup({rpcError:error});const result=await s.run(squadId);assert.equal(result.success,false);
 assert.doesNotMatch(result.message,/SQL internal|secret/);assert.equal(s.paths.length,0);}
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const squadId = '30000000-0000-4000-8000-000000000003';
function setup(former = false) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from(table) {
      calls.push(table);
      const data = table === 'profiles' ? { nama_lengkap: 'QA', primary_class_id: 1, status_akun: 'ACTIVE' }
        : table === 'squad_members' ? former ? null : { squad_member_id: 'member' }
          : table === 'squads' ? { squad_id: squadId, status_squad: 'MISSION_COMPLETED' }
            : assert.fail('Completed navigation must not read ' + table);
      const q = { select() { return q; }, eq() { return q; }, limit() { return q; },
        maybeSingle: async () => ({ data, error: null }) };
      return q;
    },
    rpc() { assert.fail('Completed navigation must not fetch active Room members'); },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/app/squads/[squadId]/page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name === 'next/navigation'
    ? { redirect: to => { throw Error('redirect:' + to); }, notFound: () => { throw Error('404'); } }
    : name === '@/lib/supabase/server' ? { createClient: async () => client }
      : name.startsWith('./') || name === '@/components/layout/Navbar' || name === 'next/link'
        ? { default: () => null } : require(name) });
  return { calls, run: () => exports.default({ params: Promise.resolve({ squadId }) }) };
}
test('completed Room redirects to preserved Squad details before any chat/member RPC query', async () => {
  const s = setup();
  await assert.rejects(s.run(), new RegExp('redirect:/squads/' + squadId + '/endorsements'));
  assert.deepEqual(s.calls, ['profiles', 'squad_members', 'squads']);
});
test('former members still cannot open the active Room URL; history is accessed through its guarded route', async () => {
  const s = setup(true); await assert.rejects(s.run(), /404/);
  assert.deepEqual(s.calls, ['profiles', 'squad_members']);
});

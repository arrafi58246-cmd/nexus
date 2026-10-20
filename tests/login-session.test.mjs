import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/auth/login.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText, { exports });

function setup(options = {}) {
  const calls = [];
  const client = {
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: 'qa' } }, error: options.authError ?? null }),
      signOut: async ({ scope }) => { calls.push(scope); return { error: options.signOutError ?? null }; },
    },
    from() {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => {
        if (options.throwProfile) throw Error('private database detail');
        return { data: options.profile ?? null, error: options.profileError ?? null };
      } };
      return query;
    },
  };
  return { run: () => exports.loginWithProfile(client, 'qa@example.com', 'not-a-real-password'), calls };
}

test('profile errors, missing or suspended profiles never keep a successful login', async () => {
  for (const options of [{}, { profileError: {} }, { throwProfile: true },
    { profile: { status_akun: 'SUSPENDED', role_app: 'STUDENT' } },
    { profile: { status_akun: 'ACTIVE', role_app: 'UNKNOWN' } }]) {
    const s = setup(options); const result = await s.run();
    assert.equal(result.success, false); assert.deepEqual(s.calls, ['local']);
    assert.doesNotMatch(result.message, /private database detail/);
  }
});
test('valid roles route to the correct page without signing out', async () => {
  for (const [role, primaryClass, destination] of [['ADMIN', null, '/admin'],
    ['STUDENT', null, '/onboarding'], ['STUDENT', 1, '/']]) {
    const s = setup({ profile: { status_akun: 'ACTIVE', role_app: role, primary_class_id: primaryClass } });
    const result = await s.run(); assert.equal(result.success, true);
    assert.equal(result.destination, destination); assert.equal(s.calls.length, 0);
  }
});
test('wrong credentials and failed session cleanup cannot report success', async () => {
  const wrong = setup({ authError: {} }); assert.equal((await wrong.run()).success, false);
  assert.equal(wrong.calls.length, 0);
  const cleanup = setup({ signOutError: {} }); assert.equal((await cleanup.run()).success, false);
  assert.deepEqual(cleanup.calls, ['local']);
});

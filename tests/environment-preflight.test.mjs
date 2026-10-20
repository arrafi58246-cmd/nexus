import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectEnvironment } from '../scripts/qa/environment.mjs';

const fixture = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://qa.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_syntheticFixtureOnly',
};
const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`;

test('base URL/publishable and explicit testing declaration pass without displaying values', () => {
  assert.deepEqual(inspectEnvironment(fixture), { errors: [], warnings: [] });
  assert.equal(inspectEnvironment({ ...fixture, NEXUS_QA_ENVIRONMENT: 'staging' }, { testing: true }).errors.length, 0);
  assert.ok(inspectEnvironment(fixture, { testing: true }).errors.length);
  assert.ok(inspectEnvironment({ ...fixture, NEXUS_QA_ENVIRONMENT: 'production' }, { testing: true }).errors.length);
});

test('REST path, query, credential, non-HTTPS and missing env are rejected', () => {
  for (const url of ['https://qa.supabase.co/rest/v1/', 'https://qa.supabase.co/?key=x',
    'https://user:password@qa.supabase.co', 'http://qa.supabase.co', 'invalid']) {
    assert.ok(inspectEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_URL: url }).errors.length, url);
  }
  assert.ok(inspectEnvironment({}).errors.length);
  assert.equal(inspectEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).errors.length, 0);
});

test('service/secret public values are rejected and never echoed in diagnostics', () => {
  for (const key of ['-----', 'sb_secret_syntheticSecretOnly', jwt('service_role')]) {
    const result = inspectEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
    assert.ok(result.errors.length);
    assert.ok(!JSON.stringify(result).includes(key));
  }
  for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'fixture'],
    ['NEXT_PUBLIC_EXTRA_KEY', jwt('service_role')], ['NEXT_PUBLIC_EXTRA_KEY', 'sb_secret_syntheticOnly']]) {
    assert.ok(inspectEnvironment({ ...fixture, [name]: value }).errors.length);
  }
  const legacy = inspectEnvironment({ ...fixture, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('anon') });
  assert.equal(legacy.errors.length, 0);
  assert.equal(legacy.warnings.length, 1);
});

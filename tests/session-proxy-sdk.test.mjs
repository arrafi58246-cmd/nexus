import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/supabase/proxy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Real SDK and cookie protocol, isolated synthetic Auth service; no hosted account/database.
test('real SSR SDK refreshes an expired session once and persists the renewed cookie', { timeout: 15000 }, async () => {
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated',
    role: 'authenticated', email: 'qa@example.invalid', app_metadata: {}, user_metadata: {},
    identities: [], created_at: '2026-01-01T00:00:00Z' };
  const now = Math.floor(Date.now() / 1000);
  function token(exp) {
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', iat: now - 120, exp })).toString('base64url');
    const unsigned = `${head}.${body}`;
    return `${unsigned}.${createHmac('sha256', 'isolated-test-fixture-only').update(unsigned).digest('base64url')}`;
  }
  const freshToken = token(now + 3600);
  const requests = [];
  let fixtureError;
  const server = createServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`);
    try {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/auth/v1/token?grant_type=refresh_token' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        assert.equal(JSON.parse(body).refresh_token, 'expired-fixture-refresh');
        res.end(JSON.stringify({ access_token: freshToken, refresh_token: 'renewed-fixture-refresh',
          expires_in: 3600, token_type: 'bearer', user }));
      } else if (req.url === '/auth/v1/user') {
        assert.equal(req.headers.authorization, `Bearer ${freshToken}`);
        res.end(JSON.stringify(user));
      } else { throw Error(`Unexpected fixture request: ${req.method} ${req.url}`); }
    } catch (error) { fixtureError = error; res.statusCode = 500; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const exports = {};
    vm.runInNewContext(compiled, { exports, Headers, require, process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
    } } });
    const expired = { access_token: token(now - 60), refresh_token: 'expired-fixture-refresh',
      expires_in: 3600, expires_at: now - 60, token_type: 'bearer', user };
    const cookie = `base64-${Buffer.from(JSON.stringify(expired)).toString('base64url')}`;
    const request = new NextRequest('https://qa.invalid/profile', {
      headers: { cookie: `sb-127-auth-token=${cookie}` },
    });
    const response = await exports.updateSession(request);
    if (fixtureError) throw fixtureError;
    assert.equal(requests.filter((path) => path.startsWith('POST /auth/v1/token')).length, 1);
    assert.ok(requests.includes('GET /auth/v1/user'));
    const renewed = response.cookies.get('sb-127-auth-token');
    assert.ok(renewed && renewed.value !== cookie);
    const session = JSON.parse(Buffer.from(renewed.value.slice('base64-'.length), 'base64url').toString());
    assert.equal(session.access_token, freshToken);
    assert.equal(session.refresh_token, 'renewed-fixture-refresh');
    assert.equal(request.cookies.get(renewed.name).value, renewed.value);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('expires'), '0');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

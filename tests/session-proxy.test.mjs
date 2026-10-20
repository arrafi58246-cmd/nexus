import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const { unstable_doesMiddlewareMatch: doesProxyMatch } = require('next/experimental/testing/server');
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const source = compile('../src/lib/supabase/proxy.ts');

function loadProxy(onClaims) {
  const exports = {};
  vm.runInNewContext(source, { exports, Headers, process: { env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://qa.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'qa-public',
  } }, require(id) {
    if (id === 'next/server') return require(id);
    if (id === '@supabase/ssr') return { createServerClient(url, key, options) {
      assert.equal(url, 'https://qa.invalid');
      assert.equal(key, 'qa-public');
      return { auth: { getClaims: () => onClaims(options.cookies) } };
    } };
    throw Error(`Unexpected import: ${id}`);
  } });
  return exports.updateSession;
}

test('anonymous and unrelated cookies do not create an Auth request', async () => {
  const update = loadProxy(() => { throw Error('No refresh needed'); });
  for (const cookie of ['', 'theme=dark', 'sb-qa-auth-token-code-verifier=fixture']) {
    const result = await update(new NextRequest('https://qa.invalid/login', { headers: { cookie } }));
    assert.equal(result.headers.get('x-middleware-next'), '1');
    assert.equal(result.headers.get('set-cookie'), null);
  }
});

test('refreshed cookie chunks reach both Server Components and browser with cache headers intact', async () => {
  const request = new NextRequest('https://qa.invalid/profile', {
    headers: { cookie: 'sb-qa-auth-token.0=stale; sb-qa-auth-token.1=obsolete; theme=dark' },
  });
  const update = loadProxy(async (cookies) => {
    assert.ok(cookies.getAll().some(({ value }) => value === 'stale'));
    cookies.setAll([
      { name: 'sb-qa-auth-token.0', value: 'renewed', options: { path: '/', sameSite: 'lax', secure: true } },
      { name: 'sb-qa-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
    ], { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0', Expires: '0' });
    cookies.setAll([{ name: 'sb-qa-auth-token.2', value: 'new-chunk', options: { path: '/' } }], { Pragma: 'no-cache' });
    return { data: { claims: { sub: 'qa-user' } }, error: null };
  });
  const result = await update(request);
  assert.equal(request.cookies.get('sb-qa-auth-token.0').value, 'renewed');
  assert.equal(result.cookies.get('sb-qa-auth-token.0').value, 'renewed');
  assert.equal(result.cookies.get('sb-qa-auth-token.1').maxAge, 0);
  assert.equal(result.cookies.get('sb-qa-auth-token.2').value, 'new-chunk');
  assert.equal(result.cookies.get('sb-qa-auth-token.0').secure, true);
  assert.match(result.headers.get('x-middleware-request-cookie'), /sb-qa-auth-token.0=renewed/);
  assert.match(result.headers.get('x-middleware-request-cookie'), /theme=dark/);
  assert.match(result.headers.get('cache-control'), /no-store/);
  assert.equal(result.headers.get('expires'), '0');
  assert.equal(result.headers.get('pragma'), 'no-cache');
});

test('invalid session cleanup preserves expired cookies without inventing a redirect or role', async () => {
  const update = loadProxy(async (cookies) => {
    cookies.setAll([{ name: 'sb-qa-auth-token', value: '', options: { path: '/', maxAge: 0 } }], {});
    return { data: null, error: { message: 'invalid fixture' } };
  });
  const response = await update(new NextRequest('https://qa.invalid/api/profile/avatar', {
    headers: { cookie: 'sb-qa-auth-token=invalid' },
  }));
  assert.equal(response.cookies.get('sb-qa-auth-token').maxAge, 0);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.match(response.headers.get('cache-control'), /private/);
});

test('matcher includes authenticated pages and APIs while excluding static assets', () => {
  const exports = {};
  vm.runInNewContext(compile('../src/proxy.ts'), { exports, require: () => ({ updateSession() {} }) });
  for (const url of ['/', '/login', '/profile', '/admin/results', '/api/profile/avatar']) {
    assert.equal(doesProxyMatch({ config: exports.config, nextConfig: {}, url }), true, url);
  }
  for (const url of ['/_next/static/chunk.js', '/_next/image?url=qa', '/favicon.ico', '/nexus-logo.svg', '/font.woff2']) {
    assert.equal(doesProxyMatch({ config: exports.config, nextConfig: {}, url }), false, url);
  }
});

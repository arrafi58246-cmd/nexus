import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}, globals = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, ...globals, require: id => imports[id] ?? require(id) });
  return exports;
}
function action(createClient, paths) {
  return load('../src/lib/auth/logout-actions.ts', {
    '@/lib/supabase/server': { createClient }, 'next/cache': { revalidatePath: (...args) => paths.push(args) },
  }).logout;
}

test('logout never reports success or invalidates UI after Auth/network failure', async () => {
  for (const failure of ['response', 'network', 'client']) {
    const paths = [];
    const run = action(async () => {
      if (failure === 'client') throw Error('private configuration');
      return { auth: { signOut: async () => {
        if (failure === 'network') throw Error('private network detail');
        return { error: { message: 'private Auth detail' } };
      } } };
    }, paths);
    const result = await run();
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /private/);
    assert.deepEqual(paths, []);
  }
});

test('logout is idempotent for an empty session without requiring a profile or role', async () => {
  const paths = [], scopes = [];
  const run = action(async () => ({ auth: { signOut: async options => {
    scopes.push(options.scope); return { error: null };
  } } }), paths);
  assert.equal((await run()).success, true);
  assert.deepEqual(scopes, ['local']);
  assert.deepEqual(paths, [['/', 'layout']]);
});

test('both STUDENT and ADMIN navbar render an accessible logout button', async () => {
  const Button = load('../src/components/layout/LogoutButton.tsx', {
    '@/lib/auth/logout-actions': { logout: async () => ({ success: true }) },
  }).default;
  const Navbar = load('../src/components/layout/Navbar.tsx', {
    './LogoutButton': { default: Button }, 'next/link': { default: 'a' }, 'next/image': { default: 'img' },
    './NotificationBell': { default: () => null },
    '@/lib/notifications': { notificationNavSection: () => null },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: null } }) },
    }) },
  }).default;
  for (const isAdmin of [false, true]) {
    const html = require('react-dom/server').renderToStaticMarkup(
      await Navbar({ displayName: 'QA', activeItem: 'profile', isAdmin }));
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Keluar dari akun"/);
    assert.match(html, />Keluar<\/button>/);
    if (isAdmin) {
      assert.match(html, /href="\/admin"/);
      assert.doesNotMatch(html, /href="\/(?:profile|notifications|missions|leaderboard|my-squad)(?:\/|"|\?)/);
    } else {
      assert.match(html, /href="\/profile"/);
      assert.match(html, /href="\/missions"/);
    }
  }
});

// Real SSR SDK + project server cookie helper, using only synthetic local Auth.
test('logout revokes only the current session and deletes chunked SSR cookies', { timeout: 15000 }, async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url });
    res.writeHead(204).end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({
      sub: '00000000-0000-4000-8000-000000000001', exp: now + 3600,
    })).toString('base64url')}.fixture`;
    const encoded = `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: 'fixture',
      expires_at: now + 3600, token_type: 'bearer', user: { id: 'qa', user_metadata: { padding: 'x'.repeat(6000) } },
    })).toString('base64url')}`;
    const jar = new Map([['preference', 'keep']]);
    for (let n = 0; n * 3000 < encoded.length; n++) jar.set(`sb-127-auth-token.${n}`, encoded.slice(n * 3000, (n + 1) * 3000));
    const changes = [];
    const cookieStore = {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set(name, value, options) { changes.push({ name, value, options }); jar.set(name, value); },
    };
    const helper = load('../src/lib/supabase/server.ts', { 'next/headers': { cookies: async () => cookieStore } }, {
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key' } },
    });
    const paths = [];
    assert.equal((await action(helper.createClient, paths)()).success, true);
    assert.deepEqual(requests, [{ method: 'POST', path: '/auth/v1/logout?scope=local' }]);
    assert.ok(changes.length >= 2);
    assert.ok(changes.every(c => c.name.startsWith('sb-127-auth-token.') && c.value === '' && c.options.maxAge === 0));
    assert.equal(jar.get('preference'), 'keep');
    const client = await helper.createClient();
    assert.equal((await client.auth.getUser()).data.user, null);
    assert.equal((await action(helper.createClient, paths)()).success, true);
    assert.equal(requests.length, 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function keyRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role; }
  catch { return null; }
}

export function inspectEnvironment(env, { testing = false } = {}) {
  const errors = [];
  const warnings = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url) errors.push('NEXT_PUBLIC_SUPABASE_URL belum diisi.');
  else {
    try {
      const parsed = new URL(url);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if (!['http:', 'https:'].includes(parsed.protocol) || (!local && parsed.protocol !== 'https:') ||
          parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
        errors.push('Gunakan URL dasar project HTTPS; tanpa /rest/v1, path, query atau credential. HTTP hanya untuk localhost.');
      }
      if (parsed.hostname === 'PROJECT_REF.supabase.co'.toLowerCase()) errors.push('Ganti placeholder URL project.');
    } catch { errors.push('NEXT_PUBLIC_SUPABASE_URL bukan URL yang valid.'); }
  }
  if (!key) errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi.');
  else if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) { /* Supported public key shape. */ }
  else if (keyRole(key) === 'anon') warnings.push('Legacy anon terdeteksi; gunakan publishable key untuk konfigurasi baru.');
  else errors.push('Isi publishable key, bukan placeholder/service_role/secret key.');

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('NEXT_PUBLIC_') && value &&
        (/SERVICE_ROLE|SECRET/i.test(name) || value.startsWith('sb_secret_') || keyRole(value) === 'service_role')) {
      errors.push(`${name} berisi konfigurasi rahasia yang tidak boleh diekspos ke browser.`);
    }
  }
  if (testing && !['development', 'testing', 'staging'].includes(env.NEXUS_QA_ENVIRONMENT)) {
    errors.push('Untuk QA, deklarasikan NEXUS_QA_ENVIRONMENT=development/testing/staging sesuai environment sebenarnya.');
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const result = inspectEnvironment(process.env, { testing: process.argv.includes('--testing') });
  result.warnings.forEach((message) => console.log(`INFO: ${message}`));
  result.errors.forEach((message) => console.error(`FAIL: ${message}`));
  if (result.errors.length) process.exitCode = 1;
  else console.log('PASS: bentuk env valid; nilai key tidak ditampilkan. Koneksi, role, isolasi environment dan backup belum diuji.');
}

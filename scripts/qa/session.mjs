import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

export class QaError extends Error {}
export function check(error, message) { if (error) throw new QaError(message); }

async function credentials() {
  if (!process.stdin.isTTY) throw Error('Jalankan di terminal interaktif dengan akun testing development.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await prompt.question('Email STUDENT testing development: ')).trim();
  prompt.close();
  process.stdout.write('Password (disembunyikan): ');
  const password = await new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setRawMode(true); process.stdin.resume();
    const finish = () => {
      process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause();
      process.stdout.write('\n');
    };
    function onData(chunk) {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { finish(); reject(Error('Dibatalkan.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    process.stdin.on('data', onData);
  });
  return { email, password };
}

export async function openQaSession() {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new QaError('Isi URL/publishable key di .env.local terlebih dahulu.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.auth.signInWithPassword(await credentials());
    check(error, 'FAIL: login akun testing.');
    if (!data.user) throw new QaError('FAIL: login tidak menghasilkan user.');
    const verified = await client.auth.getUser();
    check(verified.error, 'FAIL: verifikasi sesi.');
    const profile = await client.from('profiles').select('role_app,status_akun,primary_class_id')
      .eq('user_id', data.user.id).maybeSingle();
    check(profile.error, 'FAIL: profil tidak dapat diperiksa.');
    if (!profile.data || profile.data.role_app !== 'STUDENT' || profile.data.status_akun !== 'ACTIVE'
        || profile.data.primary_class_id === null) throw new QaError('Gunakan STUDENT development ACTIVE yang selesai onboarding.');
    return { client, userId: data.user.id };
  } catch (error) {
    await closeQaSession(client);
    throw error;
  }
}

export async function closeQaSession(client) {
  try {
    const result = await client.auth.signOut({ scope: 'local' });
    check(result.error, 'FAIL: penutupan sesi testing.');
  } catch {
    throw new QaError('FAIL: penutupan sesi testing.');
  }
}

// Real Supabase Auth/Storage API test with a dedicated development STUDENT account.
// Temporarily changes the test avatar, restores it, and removes only test files.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw Error('Isi URL dan publishable key di .env.local terlebih dahulu.');

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

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=', 'base64');
let userId, path, originalPath;
let uploadAttempted = false, uploadConfirmed = false, profileWriteAttempted = false;
function check(error, message) { if (error) throw Error(message); }

async function main() {
  const { data, error } = await client.auth.signInWithPassword(await credentials());
  check(error, 'FAIL: login. Periksa akun/password testing.');
  userId = data.user?.id;
  if (!userId) throw Error('FAIL: login tidak menghasilkan user.');
  const verified = await client.auth.getUser();
  check(verified.error, 'FAIL: verifikasi sesi.');
  const profile = await client.from('profiles')
    .select('role_app,status_akun,primary_class_id,foto_profil_path').eq('user_id', userId).maybeSingle();
  check(profile.error, 'FAIL: profil tidak dapat dibaca.');
  if (!profile.data || profile.data.role_app !== 'STUDENT' || profile.data.status_akun !== 'ACTIVE'
      || profile.data.primary_class_id === null) throw Error('Gunakan akun STUDENT testing ACTIVE yang selesai onboarding.');
  originalPath = profile.data.foto_profil_path;
  console.log('PASS: login, sesi dan profil ACTIVE.');
  path = `${userId}/${randomUUID()}.png`;
  const bucket = client.storage.from('avatars');
  uploadAttempted = true;
  const upload = await bucket.upload(path, png, { contentType: 'image/png', upsert: false });
  check(upload.error, 'FAIL: upload avatar.');
  uploadConfirmed = true;
  const listed = await bucket.list(userId, { search: path.split('/')[1] });
  check(listed.error, 'FAIL: izin metadata avatar.');
  if (!listed.data.some(file => file.name === path.split('/')[1])) throw Error('FAIL: metadata file tes tersembunyi.');
  const response = await fetch(bucket.getPublicUrl(path).data.publicUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(png)) throw Error('FAIL: membaca gambar publik.');
  console.log('PASS: upload dan baca avatar publik.');
  profileWriteAttempted = true;
  let update = client.from('profiles').update({ foto_profil_path: path })
    .eq('user_id', userId).eq('status_akun', 'ACTIVE');
  update = originalPath === null ? update.is('foto_profil_path', null) : update.eq('foto_profil_path', originalPath);
  const saved = await update.select('user_id').maybeSingle();
  check(saved.error, 'FAIL: menyimpan foto profil.');
  if (!saved.data) throw Error('FAIL: profil berubah saat tes; perubahan dibatalkan.');
  console.log('PASS: simpan foto profil melalui API database.');
}

async function cleanup() {
  if (userId && path && profileWriteAttempted) {
    const restore = await client.from('profiles').update({ foto_profil_path: originalPath })
      .eq('user_id', userId).eq('foto_profil_path', path).select('user_id');
    check(restore.error, 'FAIL: pemulihan foto profil perlu diperiksa. File tes dipertahankan.');
    if (restore.data.length) console.log('PASS: foto awal dipulihkan.');
  }
  if (userId && path && uploadAttempted) {
    const current = await client.from('profiles').select('foto_profil_path').eq('user_id', userId).maybeSingle();
    check(current.error, 'FAIL: status profil belum dapat diperiksa; file tes dipertahankan.');
    if (!current.data || current.data.foto_profil_path === path) throw Error('FAIL: profil belum aman untuk cleanup; file tes dipertahankan.');
    const removed = await client.storage.from('avatars').remove([path]);
    check(removed.error, 'FAIL: cleanup file tes.');
    if (uploadConfirmed && !removed.data.some(file => file.name === path || file.name === path.split('/')[1])) {
      throw Error('FAIL: API tidak mengonfirmasi penghapusan file tes.');
    }
    const remaining = await client.storage.from('avatars').list(userId, { search: path.split('/')[1] });
    check(remaining.error, 'FAIL: verifikasi cleanup.');
    if (remaining.data.some(file => file.name === path.split('/')[1])) throw Error('FAIL: file tes belum terhapus.');
    console.log('PASS: file tes dibersihkan; profil tidak menunjuk file tes.');
  }
}

try { await main(); }
catch (error) { process.exitCode = 1; console.error(error.message); }
finally {
  try { await cleanup(); } catch (error) { process.exitCode = 1; console.error(error.message); }
  const signedOut = await client.auth.signOut({ scope: 'local' });
  if (signedOut.error) { process.exitCode = 1; console.error('FAIL: penutupan sesi testing.'); }
}

// Real Storage API checks; no Mission/claim/result records or XP are created.
import { randomUUID } from 'node:crypto';
import { openQaSession, closeQaSession, QaError, check } from './session.mjs';

const buckets = [['mission-documents', 10_485_760],
  ['achievement-certificates', 5_000_000], ['mission-result-certificates', 5_000_000]];
const runId = randomUUID();
const files = [];
let session;

function pdf() {
  let output = '%PDF-1.4\n';
  const offsets = [0];
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream'];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 5\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(output + `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

async function upload(bucket, payload, mime, extension) {
  const path = `${session.userId}/${runId}/${randomUUID()}.${extension}`;
  const file = { bucket, path, uploaded: false };
  files.push(file); // Track ambiguous failures as well as successful uploads.
  const result = await session.client.storage.from(bucket).upload(path, payload,
    { contentType: mime, upsert: false });
  file.uploaded = !result.error;
  return { file, error: result.error };
}

async function main() {
  session = await openQaSession();
  console.log('PASS: login akun testing ACTIVE.');
  const payload = pdf();
  for (const [bucket, limit] of buckets) {
    const storage = session.client.storage.from(bucket);
    const valid = await upload(bucket, payload, 'application/pdf', 'pdf');
    check(valid.error, `FAIL: upload ${bucket}.`);
    const signed = await storage.createSignedUrl(valid.file.path, 60);
    check(signed.error, `FAIL: signed URL ${bucket}.`);
    const response = await fetch(signed.data.signedUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(payload)) {
      throw new QaError(`FAIL: download privat ${bucket}.`);
    }
    const publicResponse = await fetch(storage.getPublicUrl(valid.file.path).data.publicUrl,
      { signal: AbortSignal.timeout(15000) });
    if (![400, 401, 403, 404].includes(publicResponse.status)) {
      throw new QaError(`FAIL: file ${bucket} belum terbukti privat.`);
    }
    await publicResponse.body?.cancel();
    console.log(`PASS: ${bucket} upload, signed download, dan akses publik ditolak.`);

    const invalid = await upload(bucket, Buffer.from('QA unsupported MIME'), 'text/html', 'html');
    if (!invalid.error || ![400, 415].includes(Number(invalid.error.statusCode))
        || !/mime|content.?type|not.*support/i.test(invalid.error.message)) {
      throw new QaError(`FAIL: penolakan MIME ${bucket} tidak sesuai.`);
    }
    console.log(`PASS: ${bucket} menolak tipe file terlarang.`);
    if (process.argv.includes('--size-limits')) {
      const large = Buffer.alloc(limit + 1); payload.copy(large);
      const rejected = await upload(bucket, large, 'application/pdf', 'pdf');
      if (!rejected.error || Number(rejected.error.statusCode) !== 413) {
        throw new QaError(`FAIL: batas ukuran ${bucket} tidak sesuai.`);
      }
      console.log(`PASS: ${bucket} menolak ${limit + 1} byte.`);
    }
  }
}

async function cleanup() {
  let failed = false;
  for (const file of files) {
    try {
      const storage = session.client.storage.from(file.bucket);
      const removed = await storage.remove([file.path]);
      check(removed.error, 'cleanup');
      if (file.uploaded && !removed.data.some(row => row.name === file.path)) throw new QaError('cleanup');
      const name = file.path.split('/').at(-1);
      const listed = await storage.list(`${session.userId}/${runId}`, { search: name });
      check(listed.error, 'cleanup');
      if (listed.data.some(row => row.name === name)) throw new QaError('cleanup');
    } catch { failed = true; }
  }
  if (failed) throw new QaError(`FAIL: cleanup belum lengkap. Periksa folder testing dengan run ID ${runId}.`);
  if (files.length) console.log('PASS: semua file tes dibersihkan.');
}

try { await main(); }
catch (error) { process.exitCode = 1; console.error(error instanceof QaError ? error.message : 'FAIL: koneksi/API belum dapat diperiksa.'); }
finally {
  try { await cleanup(); } catch (error) { process.exitCode = 1; console.error(error.message); }
  if (session) {
    try { await closeQaSession(session.client); }
    catch { process.exitCode = 1; console.error('FAIL: penutupan sesi testing.'); }
  }
}

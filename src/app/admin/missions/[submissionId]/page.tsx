import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";

import ReviewForm from "./ReviewForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminMissionDetailPage({ params }: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  if (!UUID.test(submissionId)) notFound();
  const { supabase } = await requireAdmin();
  const { data: submission, error } = await supabase.from("mission_submissions")
    .select("mission_submission_id,submitted_by,nama_lomba,penyelenggara,kategori_penyelenggara,link_resmi,deadline_pendaftaran,deadline_lomba,tahun_lomba,kategori_lomba,cakupan_peserta,mode_lomba,biaya_pendaftaran,min_anggota_tim,max_anggota_tim,deskripsi_singkat,dokumen_path,status_review,alasan_penolakan,final_tier_id,submitted_at")
    .eq("mission_submission_id", submissionId).maybeSingle();
  if (error || !submission) notFound();
  const [student, tiers, document] = await Promise.all([
    supabase.from("profiles").select("nama_lengkap")
      .eq("user_id", submission.submitted_by).maybeSingle(),
    supabase.from("mission_tiers").select("tier_id,kode_tier").order("tier_id"),
    supabase.storage.from("mission-documents")
      .createSignedUrl(submission.dokumen_path, 300),
  ]);
  const failed = student.error || tiers.error;
  let officialUrl: string | null = null;
  try {
    if (["https:", "http:"].includes(new URL(submission.link_resmi).protocol)) {
      officialUrl = submission.link_resmi;
    }
  } catch { /* Admin can still reject an invalid submission. */ }
  const rows = [
    ["Penyelenggara", submission.penyelenggara],
    ["Kategori penyelenggara", submission.kategori_penyelenggara],
    ["Tahun", String(submission.tahun_lomba)],
    ["Kategori", submission.kategori_lomba],
    ["Cakupan", submission.cakupan_peserta],
    ["Mode", submission.mode_lomba],
    ["Biaya", submission.biaya_pendaftaran],
    ["Deadline pendaftaran", new Date(submission.deadline_pendaftaran)
      .toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"],
    ["Deadline lomba", new Date(submission.deadline_lomba)
      .toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"],
    ["Min–maks peserta", `${submission.min_anggota_tim ?? "—"}–${submission.max_anggota_tim ?? "—"}`],
  ];

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin/missions" className="text-sm font-semibold text-indigo-700">
        ← Daftar pengajuan
      </Link>
      <h1 className="mt-5 text-2xl font-bold">Review Mission</h1>
      {failed ? <p role="alert" className="mt-5 text-red-700">Data belum dapat dimuat.</p> : <>
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">{submission.nama_lomba}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Diajukan {student.data?.nama_lengkap ?? "Mahasiswa"} · {submission.status_review}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => <div key={label}>
              <dt className="text-slate-500">{label}</dt><dd>{value}</dd>
            </div>)}
          </dl>
          <p className="mt-4 whitespace-pre-line text-sm">{submission.deskripsi_singkat}</p>
          {officialUrl ? <a href={officialUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-indigo-700 underline">
            Buka tautan resmi
          </a> : <p role="alert" className="mt-4 text-sm text-red-700">
            Tautan resmi tidak valid.
          </p>}
          {document.data?.signedUrl && !document.error ? <a
            href={document.data.signedUrl} target="_blank" rel="noopener noreferrer"
            className="ml-4 inline-block text-sm font-semibold text-indigo-700 underline">
            Lihat dokumen privat
          </a> : <p role="alert" className="mt-4 text-sm text-red-700">
            Dokumen tidak dapat dibuka. Jangan setujui sebelum bukti tersedia.
          </p>}
        </section>
        {submission.status_review === "PENDING" && tiers.data?.length ?
          <ReviewForm submissionId={submissionId} tiers={tiers.data}
            min={submission.min_anggota_tim} max={submission.max_anggota_tim}
            canApprove={Boolean(officialUrl && document.data?.signedUrl && !document.error)} />
          : submission.status_review === "REJECTED" ? <p className="mt-5 text-red-700">
            Ditolak: {submission.alasan_penolakan}
          </p> : submission.status_review === "APPROVED" ? <p className="mt-5 text-emerald-700">
            Disetujui. Tier final: {tiers.data?.find((row) => row.tier_id === submission.final_tier_id)?.kode_tier ?? "—"}.
          </p> : null}
      </>}
    </main>
  </div>;
}


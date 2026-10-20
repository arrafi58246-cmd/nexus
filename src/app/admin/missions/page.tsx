import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminMissionsPage() {
  const { supabase } = await requireAdmin();
  const { data: pending, error } = await supabase.from("mission_submissions")
    .select("mission_submission_id,nama_lomba,penyelenggara,submitted_at")
    .eq("status_review", "PENDING")
    .order("submitted_at", { ascending: true }).limit(50);

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Review Pengajuan Mission</h1>
      <p className="mt-2 text-sm text-slate-600">
        Menampilkan maksimal 50 pengajuan tertua yang menunggu review.
      </p>
      {error ? <p role="alert" className="mt-6 text-red-700">Daftar belum dapat dimuat.</p>
        : !pending?.length ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Belum ada Mission menunggu review.
        </p> : <ul className="mt-6 space-y-3">{pending.map((row) => (
          <li key={row.mission_submission_id}
            className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">{row.nama_lomba}</h2>
            <p className="mt-1 text-sm text-slate-600">{row.penyelenggara}</p>
            <p className="mt-1 text-xs text-slate-500">
              Diajukan {new Date(row.submitted_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
            </p>
            <Link href={`/admin/missions/${row.mission_submission_id}`}
              className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
              Periksa pengajuan
            </Link>
          </li>
        ))}</ul>}
    </main>
  </div>;
}


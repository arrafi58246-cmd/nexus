import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

export default async function MyMissionSubmissionsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap,role_app,status_akun,primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }
  if (profileError || profile?.role_app !== "STUDENT" ||
      profile.status_akun !== "ACTIVE") notFound();
  const { data: submissions, error } = await supabase.from("mission_submissions")
    .select("mission_submission_id,nama_lomba,penyelenggara,status_review,alasan_penolakan,submitted_at,resubmission_count")
    .eq("submitted_by", auth.user.id)
    .order("submitted_at", { ascending: false }).limit(100);

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="missions" />
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/missions" className="text-sm font-semibold text-indigo-700">
          ← Missions</Link>
          <h1 className="mt-4 text-2xl font-bold">Pengajuan Mission Saya</h1>
        </div>
        <Link href="/missions/add" className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white">
          + Tambah Mission
        </Link>
      </div>
      {error ? <p role="alert" className="mt-6 text-red-700">Daftar belum dapat dimuat.</p>
        : !submissions?.length ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Belum ada pengajuan.
        </p> : <ul className="mt-6 space-y-3">{submissions.map((row) => (
          <li key={row.mission_submission_id}
            className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">{row.nama_lomba}</h2>
            <p className="mt-1 text-sm text-slate-600">{row.penyelenggara} · {row.status_review}</p>
            <p className="mt-1 text-xs text-slate-500">
              Diajukan {new Date(row.submitted_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
              {row.resubmission_count ? ` · Kirim ulang ${row.resubmission_count} kali` : ""}
            </p>
            {row.status_review === "REJECTED" && <>
              <p className="mt-3 text-sm text-red-700">Alasan: {row.alasan_penolakan}</p>
              <Link href={`/missions/add?id=${row.mission_submission_id}`}
                className="mt-3 inline-block text-sm font-semibold text-indigo-700 underline">
                Perbaiki dan kirim ulang
              </Link>
            </>}
          </li>
        ))}</ul>}
    </main>
  </div>;
}

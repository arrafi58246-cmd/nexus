import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import MissionHistoryList from "@/components/profile/MissionHistoryList";
import { loadMissionHistory } from "@/lib/mission-history";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

function pageNumber(input: string | string[] | undefined) {
  const value = typeof input === "string" ? Number(input) : NaN;
  return Number.isSafeInteger(value) && value >= 1 && value <= 500 ? value : 1;
}

export default async function MissionHistoryPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap,role_app,status_akun,primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }
  const allowed = !profileError && profile?.role_app === "STUDENT" &&
    profile.status_akun === "ACTIVE";
  const page = pageNumber((await searchParams).page);
  const history = allowed
    ? await loadMissionHistory(supabase, auth.user.id, page, PAGE_SIZE) : null;
  const totalPages = history ? Math.ceil(history.count / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {profile && <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← Profil Saya
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Mission History</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hasil Squad dan prestasi luar NEXUS yang disetujui, beserta XP aktual yang diterima.
          Riwayat keanggotaan lengkap tersedia di <Link href="/my-squad"
            className="font-semibold text-indigo-700 hover:underline">My Squad</Link>.
        </p>
        {!allowed ? <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
          Riwayat tersedia untuk mahasiswa aktif.
        </p> : !history ? <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
          Riwayat belum dapat dimuat. Coba muat ulang.
        </p> : history.count === 0 ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Belum ada hasil atau prestasi yang diverifikasi dan menghasilkan XP.
        </p> : history.items.length === 0 ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Tidak ada riwayat di halaman ini. <Link href="/profile/missions"
            className="text-indigo-700 underline">Kembali ke awal</Link>
        </p> : <>
          <MissionHistoryList items={history.items} />
          {(page > 1 || page < totalPages) && <nav aria-label="Halaman Mission History"
            className="mt-6 flex gap-5 text-sm font-semibold text-indigo-700">
            {page > 1 && <Link href={`/profile/missions?page=${page - 1}`}>← Sebelumnya</Link>}
            {page < totalPages && <Link href={`/profile/missions?page=${page + 1}`}>Berikutnya →</Link>}
          </nav>}
        </>}
      </main>
    </div>
  );
}

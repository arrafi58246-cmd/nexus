import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import SeasonHistoryList from "@/components/profile/SeasonHistoryList";
import { loadSeasonHistory } from "@/lib/season-history";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

function pageNumber(input: string | string[] | undefined) {
  const value = typeof input === "string" ? Number(input) : NaN;
  return Number.isSafeInteger(value) && value >= 1 && value <= 500 ? value : 1;
}

export default async function SeasonHistoryPage({ searchParams }: {
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
    ? await loadSeasonHistory(supabase, auth.user.id, page, PAGE_SIZE) : null;
  const totalPages = history ? Math.ceil(history.count / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {profile && <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← Profil Saya
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Season History</h1>
        <p className="mt-2 text-sm text-slate-600">
          Riwayat XP, Rank, dan posisi akhir yang disimpan saat Season ditutup.
        </p>
        {!allowed ? <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
          Riwayat Season tersedia untuk mahasiswa aktif.
        </p> : !history ? <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
          Riwayat belum dapat dimuat. Coba muat ulang.
        </p> : history.count === 0 ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Belum ada Season yang ditutup dan disimpan sebagai riwayat.
        </p> : history.items.length === 0 ? <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">
          Tidak ada riwayat di halaman ini. <Link href="/profile/seasons" className="text-indigo-700 underline">Kembali ke awal</Link>
        </p> : <>
          <SeasonHistoryList items={history.items} />
          {(page > 1 || page < totalPages) && <nav aria-label="Halaman Season History"
            className="mt-6 flex gap-5 text-sm font-semibold text-indigo-700">
            {page > 1 && <Link href={`/profile/seasons?page=${page - 1}`}>← Sebelumnya</Link>}
            {page < totalPages && <Link href={`/profile/seasons?page=${page + 1}`}>Berikutnya →</Link>}
          </nav>}
        </>}
      </main>
    </div>
  );
}

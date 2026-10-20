import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import LeaderboardEntries, { TopThree } from "./LeaderboardEntries";
import type { LeaderboardEntry, Scope } from "./types";

type Search = Promise<{ scope?: string | string[]; q?: string | string[]; page?: string | string[] }>;

const scopes: Scope[] = ["PROGRAM_STUDI", "FAKULTAS", "UNIVERSITAS"];
const PAGE_SIZE = 20;

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

function pageUrl(scope: Scope, q: string, page = 1) {
  const params = new URLSearchParams({ scope });
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/leaderboard?${params}`;
}

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-white p-5 text-red-700">{message}</p>;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Search }) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, program_studi_id, primary_class_id, role_app, status_akun, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const requestedScope = value(params.scope);
  const scope: Scope = scopes.includes(requestedScope as Scope) ? requestedScope as Scope : "PROGRAM_STUDI";
  const q = value(params.q).trim().slice(0, 80);
  const requestedPage = Number(value(params.page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 500
    ? requestedPage : 1;
  const allowed = !profileError && profile?.role_app === "STUDENT" && profile.status_akun === "ACTIVE";

  const [seasonResult, programResult] = allowed ? await Promise.all([
    supabase.from("seasons").select("nama_season, end_date")
      .eq("status_season", "ACTIVE").maybeSingle(),
    supabase.from("program_studi").select("nama_program_studi, fakultas_id")
      .eq("program_studi_id", profile.program_studi_id).maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const facultyResult = programResult.data
    ? await supabase.from("fakultas").select("nama_fakultas")
        .eq("fakultas_id", programResult.data.fakultas_id).maybeSingle()
    : { data: null, error: null };

  const scopeName = scope === "UNIVERSITAS" ? "Universitas Negeri Surabaya"
    : scope === "FAKULTAS" ? facultyResult.data?.nama_fakultas ?? "Fakultas"
    : programResult.data?.nama_program_studi ?? "Program Studi";
  const canLoad = allowed && seasonResult.data && programResult.data && facultyResult.data &&
    !seasonResult.error && !programResult.error && !facultyResult.error;
  const [topResult, listResult] = canLoad ? await Promise.all([
    supabase.rpc("get_current_leaderboard", {
      p_scope: scope, p_query: "", p_min_rank: 1, p_offset: 0, p_limit: 3,
    }),
    supabase.rpc("get_current_leaderboard", {
      p_scope: scope, p_query: q, p_min_rank: 4,
      p_offset: (page - 1) * PAGE_SIZE, p_limit: PAGE_SIZE + 1,
    }),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const top = (topResult.data ?? []) as LeaderboardEntry[];
  const list = (listResult.data ?? []) as LeaderboardEntry[];
  const hasNext = list.length > PAGE_SIZE;
  const imageUrl = (path: string) => supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const date = seasonResult.data?.end_date
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${seasonResult.data.end_date}T00:00:00Z`))
    : null;

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      {profile && <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="leaderboard" />}
      <main className="nexus-page-shell leaderboard-page mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="nexus-page-heading">
          <p className="nexus-eyebrow">SEASON AKTIF</p>
          <h1 className="text-3xl font-bold">Para penantang teratas.</h1>
        </header>
        {!allowed ? <ErrorMessage message="Leaderboard tersedia untuk mahasiswa aktif." />
          : seasonResult.error || programResult.error || facultyResult.error || topResult.error || listResult.error
            ? <ErrorMessage message="Peringkat belum dapat dimuat. Coba muat ulang." />
            : !seasonResult.data
              ? <p className="mt-6 rounded-xl bg-white p-5">Belum ada Season aktif.</p>
              : !canLoad
                ? <ErrorMessage message="Data akademik belum dapat dimuat." />
                : <>
                    <p className="nexus-page-lead mt-2 text-sm text-slate-600">
                      {seasonResult.data.nama_season} · berakhir {date} · berdasarkan Seasonal XP
                    </p>
                    <nav aria-label="Lingkup Leaderboard" className="nexus-segmented mt-6 flex flex-wrap gap-2">
                      {scopes.map((option) => (
                        <Link key={option} href={pageUrl(option, q)}
                          aria-current={scope === option ? "page" : undefined}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold ${scope === option
                            ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-indigo-700"}`}>
                          {option === "UNIVERSITAS" ? "Universitas"
                            : option === "FAKULTAS" ? "Fakultas saya" : "Program Studi saya"}
                        </Link>
                      ))}
                    </nav>
                    <h2 className="mt-8 text-xl font-bold">{scopeName}</h2>
                    <p className="mt-1 text-sm text-slate-600">{top[0]?.population_total ?? 0} mahasiswa dalam lingkup ini</p>
                    {top.length ? <>
                      <h3 className="mt-8 text-lg font-semibold">Tiga teratas</h3>
                      <TopThree entries={top} currentUserId={auth.user.id} imageUrl={imageUrl} highlightedName={q} />
                    </> : <p className="mt-6 rounded-xl bg-white p-5">Belum ada mahasiswa pada lingkup ini.</p>}
                    <section className="glass-card leaderboard-list mt-10" aria-labelledby="leaderboard-list">
                      <h3 id="leaderboard-list" className="text-lg font-semibold">Peringkat berikutnya</h3>
                      <form method="get" action="/leaderboard" className="mt-4 flex flex-wrap gap-2">
                        <input type="hidden" name="scope" value={scope} />
                        <label htmlFor="leaderboard-search" className="sr-only">Cari nama mahasiswa</label>
                        <input id="leaderboard-search" name="q" defaultValue={q} maxLength={80}
                          placeholder="Cari nama mahasiswa" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2" />
                        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Cari</button>
                      </form>
                      {list.length ? <LeaderboardEntries entries={list.slice(0, PAGE_SIZE)}
                        currentUserId={auth.user.id} imageUrl={imageUrl} highlightedName={q} />
                        : <p className="mt-4 rounded-xl bg-white p-5 text-sm text-slate-600">
                            {q ? "Tidak ada nama yang cocok di peringkat berikutnya. Periksa juga tiga teratas." : "Belum ada peringkat setelah tiga teratas."}
                          </p>}
                      {(page > 1 || hasNext) && <div className="mt-6 flex gap-4 text-sm font-semibold text-indigo-700">
                        {page > 1 && <Link href={pageUrl(scope, q, page - 1)}>← Sebelumnya</Link>}
                        {hasNext && <Link href={pageUrl(scope, q, page + 1)}>Berikutnya →</Link>}
                      </div>}
                    </section>
                  </>}
      </main>
    </div>
  );
}

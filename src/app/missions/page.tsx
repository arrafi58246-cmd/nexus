import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

const deadlineFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type MissionTier = {
  kode_tier: string | null;
};

type MissionsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    tier?: string | string[];
    mode?: string | string[];
    cost?: string | string[];
  }>;
};

function getRelatedTier(relation: unknown): MissionTier | null {
  if (Array.isArray(relation)) return (relation[0] as MissionTier) ?? null;
  if (relation && typeof relation === "object") return relation as MissionTier;
  return null;
}

function formatEnumLabel(value: string | null): string {
  if (!value) return "-";

  const label = value.trim().toLocaleLowerCase("id-ID").replaceAll("_", " ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (firstValue, secondValue) => firstValue.localeCompare(secondValue),
  );
}

const POSTER_BUCKET = "mission-documents";
const IMAGE_PATH = /\.(jpe?g|png|webp)$/i;

export default async function MissionsPage({ searchParams }: MissionsPageProps) {
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, role_app, primary_class_id, foto_profil_path")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");

  if (profileError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">
            NEXUS
          </p>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            Missions belum dapat dimuat
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data profil sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  if (profile.primary_class_id === null) redirect("/onboarding");

  const requestedFilters = await searchParams;
  const now = new Date().toISOString();
  const { data: filterRows, error: filterOptionsError } = await supabase
    .from("missions")
    .select(
      `
        kategori_lomba,
        mode_lomba,
        biaya_pendaftaran,
        tier_id,
        mission_tiers (
          kode_tier
        )
      `,
    )
    .gt("deadline_pendaftaran", now);

  const categoryOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.kategori_lomba),
  );
  const modeOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.mode_lomba),
  );
  const costOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.biaya_pendaftaran),
  );
  const tierOptions = (filterRows ?? [])
    .map((row) => ({
      tierId: row.tier_id,
      code: getRelatedTier(row.mission_tiers)?.kode_tier?.trim() ?? "",
    }))
    .filter(
      (tier, index, tiers) =>
        tier.code && tiers.findIndex((item) => item.code === tier.code) === index,
    )
    .sort((firstTier, secondTier) => firstTier.code.localeCompare(secondTier.code));

  const requestedCategory = getSearchParam(requestedFilters.category);
  const searchQuery = getSearchParam(requestedFilters.q).trim().slice(0, 100);
  const requestedTier = getSearchParam(requestedFilters.tier);
  const requestedMode = getSearchParam(requestedFilters.mode);
  const requestedCost = getSearchParam(requestedFilters.cost);
  const selectedCategory = categoryOptions.includes(requestedCategory)
    ? requestedCategory
    : "";
  const selectedTier = tierOptions.find((tier) => tier.code === requestedTier);
  const selectedMode = modeOptions.includes(requestedMode) ? requestedMode : "";
  const selectedCost = costOptions.includes(requestedCost) ? requestedCost : "";
  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory || selectedTier || selectedMode || selectedCost,
  );

  let missionsQuery = supabase
    .from("missions")
    .select(
      `
        mission_id,
        nama_lomba,
        penyelenggara,
        deadline_pendaftaran,
        kategori_lomba,
        mode_lomba,
        biaya_pendaftaran,
        cakupan_peserta,
        open_squads:squads(count),
        dokumen_path,
        tier_id,
        mission_tiers (
          kode_tier
        )
      `,
    )
    .gt("deadline_pendaftaran", now)
    .eq("open_squads.status_squad", "OPEN_RECRUITMENT");

  if (selectedCategory) {
    missionsQuery = missionsQuery.eq("kategori_lomba", selectedCategory);
  }
  if (selectedTier) {
    missionsQuery = missionsQuery.eq("tier_id", selectedTier.tierId);
  }
  if (selectedMode) {
    missionsQuery = missionsQuery.eq("mode_lomba", selectedMode);
  }
  if (selectedCost) {
    missionsQuery = missionsQuery.eq("biaya_pendaftaran", selectedCost);
  }

  const [missionsResult, xpRulesResult] = await Promise.all([
    missionsQuery.order("deadline_pendaftaran", { ascending: true }),
    supabase.from("xp_rules").select("tier_id, verified_xp")
      .eq("hasil_kompetisi", "PARTICIPANT"),
  ]);
  const { data: availableMissions, error: missionsError } = missionsResult;

  // Discovery already loads the filtered list; use literal text matching so
  // PostgREST wildcard aliases cannot turn a typed name into a pattern.
  const missions = (availableMissions ?? []).filter((mission) =>
    !searchQuery || mission.nama_lomba.toLocaleLowerCase("id-ID")
      .includes(searchQuery.toLocaleLowerCase("id-ID")));
  const participantXp = new Map((xpRulesResult.data ?? [])
    .map((rule) => [rule.tier_id, rule.verified_xp]));

  // Poster disimpan di bucket private. Satu panggilan membuat semua signed URL
  // (berlaku 1 jam). PDF atau poster yang gagal dimuat tampil sebagai placeholder.
  const posterPaths = missions
    .map((mission) => mission.dokumen_path as string | null)
    .filter((path): path is string => Boolean(path && IMAGE_PATH.test(path)));
  const posterUrls = new Map<string, string>();
  if (posterPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(POSTER_BUCKET).createSignedUrls(posterPaths, 3600);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) posterUrls.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="missions" />
      <main className="mission-discovery relative w-full min-w-0 flex-1 overflow-x-clip px-4 py-8 text-slate-900 sm:px-8 lg:py-10">
        <section className="mission-discovery-inner relative mx-auto w-full min-w-0">
          <h1 className="sr-only">Missions</h1>

          <form
            key={JSON.stringify([searchQuery, selectedCategory, selectedTier?.code, selectedMode, selectedCost])}
            method="GET"
            className="mission-toolbar"
          >
            <div className="mission-toolbar-main">
              <details className="mission-filter" open={hasActiveFilters}>
                <summary className="mission-filter-btn">Filter</summary>
                <div className="mission-filter-panel">
                  <div className="mission-filter-grid">
                    <label>
                      Kategori
                      <select name="category" defaultValue={selectedCategory}>
                        <option value="">Semua kategori</option>
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>{formatEnumLabel(category)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tier
                      <select name="tier" defaultValue={selectedTier?.code ?? ""}>
                        <option value="">Semua tier</option>
                        {tierOptions.map((tier) => (
                          <option key={tier.code} value={tier.code}>
                            {tier.code.toLocaleUpperCase("id-ID")}-Rank
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mode
                      <select name="mode" defaultValue={selectedMode}>
                        <option value="">Semua mode</option>
                        {modeOptions.map((mode) => (
                          <option key={mode} value={mode}>{formatEnumLabel(mode)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Biaya
                      <select name="cost" defaultValue={selectedCost}>
                        <option value="">Semua biaya</option>
                        {costOptions.map((cost) => (
                          <option key={cost} value={cost}>{formatEnumLabel(cost)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mission-filter-actions">
                    <button type="submit" className="mission-apply-btn">Terapkan</button>
                    <Link href="/missions" className="mission-reset-btn">Reset</Link>
                  </div>
                </div>
              </details>

              <div className="mission-searchbar" role="search">
                <label htmlFor="mission-q" className="sr-only">Cari nama kompetisi</label>
                <input id="mission-q" type="search" name="q" defaultValue={searchQuery}
                  maxLength={100} placeholder="Search" autoComplete="off" />
                <button type="submit" className="mission-search-btn" aria-label="Cari Mission">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                    strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mission-toolbar-actions">
              <Link href="/missions/add" className="mission-action mission-action--primary">
                + Tambah Mission
              </Link>
              <Link href="/missions/submissions" className="mission-action">
                Pengajuan saya
              </Link>
            </div>
          </form>

          {filterOptionsError || missionsError ? (
            <div className="glass-card mission-empty">
              <p className="font-bold">Missions belum dapat dimuat</p>
              <p className="mt-2 text-sm">Data Mission sedang tidak tersedia.</p>
            </div>
          ) : missions.length === 0 ? (
            <div className="glass-card mission-empty">
              {hasActiveFilters ? (
                <>
                  <p className="font-bold">Tidak ada Mission yang cocok</p>
                  <p className="mt-2 text-sm">Coba ubah kata pencarian atau filter yang digunakan.</p>
                </>
              ) : (
                <>
                  <p className="font-bold">Belum ada Mission aktif</p>
                  <p className="mt-2 text-sm">Mission baru akan muncul di sini setelah tersedia.</p>
                </>
              )}
            </div>
          ) : (
            <div className="mission-grid">
              {missions.map((mission) => {
                const relatedTier = getRelatedTier(mission.mission_tiers);
                const tierCode = relatedTier?.kode_tier?.trim();
                const posterPath = mission.dokumen_path as string | null;
                const posterUrl = posterPath ? posterUrls.get(posterPath) : undefined;
                const posterIsPdf = Boolean(posterPath && /\.pdf$/i.test(posterPath));
                const squadCount = mission.open_squads?.[0]?.count;
                const xp = participantXp.get(mission.tier_id);

                return (
                  <article key={mission.mission_id} className="mission-card">
                    <div className="mission-card-body">
                      <h2 className="mission-card-title">
                        <Link href={`/missions/${mission.mission_id}`}>{mission.nama_lomba}</Link>
                      </h2>
                      <p className="mission-card-organizer">{mission.penyelenggara}</p>

                      <ul className="mission-card-tags">
                        <li>{tierCode ? `${tierCode.toLocaleUpperCase("id-ID")}-Rank` : "Tier belum tersedia"}</li>
                        <li>{formatEnumLabel(mission.cakupan_peserta)}</li>
                        <li>{formatEnumLabel(mission.biaya_pendaftaran)}</li>
                        <li>{formatEnumLabel(mission.mode_lomba)}</li>
                      </ul>

                      <p className="mission-card-meta">
                        {squadCount === undefined
                          ? "Jumlah squad belum dapat dimuat"
                          : `${squadCount} squad sedang melakukan open recruitment`}
                      </p>
                      <p className="mission-card-meta">
                        Deadline{" "}
                        <time dateTime={mission.deadline_pendaftaran}>
                          {deadlineFormatter.format(new Date(mission.deadline_pendaftaran))}
                        </time>
                      </p>

                      <div className="mission-card-foot">
                        <Link href={`/missions/${mission.mission_id}`} className="mission-card-link">
                          Lihat Detail ↗
                        </Link>
                        <span className="mission-card-xp">
                          {xpRulesResult.error || xp === undefined ? "XP belum tersedia" : `${xp} XP Base`}
                        </span>
                      </div>
                    </div>

                    <Link href={`/missions/${mission.mission_id}`} className="mission-card-poster"
                      aria-label={`Poster ${mission.nama_lomba}`}>
                      {posterUrl ? (
                        <Image src={posterUrl} alt={`Poster ${mission.nama_lomba}`}
                          width={232} height={310} unoptimized />
                      ) : (
                        <span>{posterIsPdf ? "Poster PDF" : "Poster belum tersedia"}</span>
                      )}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

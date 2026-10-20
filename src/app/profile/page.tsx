import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import BadgePill from "@/components/profile/BadgePill";
import EndorsementPanel from "@/components/profile/EndorsementPanel";
import MissionHistoryCard from "@/components/profile/MissionHistoryCard";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileBadgeCollection from "@/components/profile/ProfileBadgeCollection";
import RankSwitcherCard from "@/components/profile/RankSwitcherCard";
import SeasonHistoryTiles from "@/components/profile/SeasonHistoryTiles";
import ShareProfile from "@/components/profile/ShareProfile";
import XpProgressCard from "@/components/profile/XpProgressCard";
import { badgeTone, describeBadge, facultyAbbreviation, one } from "@/lib/badges";
import { loadBadgeCollection } from "@/lib/badge-collection";
import { loadEndorsementSummary } from "@/lib/endorsements";
import { loadMissionHistory } from "@/lib/mission-history";
import { loadSeasonHistory } from "@/lib/season-history";
import { createClient } from "@/lib/supabase/server";

function PageError({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">Profil belum dapat dimuat</h1>
      <p role="alert" className="mt-4 rounded-xl bg-white p-5 text-red-700">{message}</p>
    </main>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, bio, tahun_masuk, foto_profil_path, primary_class_id, program_studi_id, role_app, status_akun")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  if (profileError || !profile || profile.status_akun !== "ACTIVE") {
    return <PageError message="Data profil atau akses akun sedang tidak tersedia." />;
  }

  const userId = auth.user.id;
  const isStudent = profile.role_app === "STUDENT";
  const [classResult, programResult, skillsResult, careerResult, seasonResult, rulesResult,
    endorsementSummary, seasonHistory, missionHistory, equippedResult, badgeCollection] =
    await Promise.all([
      profile.primary_class_id === null
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("primary_classes").select("nama_class")
            .eq("primary_class_id", profile.primary_class_id).maybeSingle(),
      supabase.from("program_studi").select("nama_program_studi, fakultas_id")
        .eq("program_studi_id", profile.program_studi_id).maybeSingle(),
      supabase.from("user_skills").select("skills(nama_skill)")
        .eq("user_id", userId),
      supabase.from("career_xp_totals").select("career_xp")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("seasons").select("season_id, nama_season")
        .eq("status_season", "ACTIVE").maybeSingle(),
      supabase.from("rank_rules").select("rank_name, min_xp, max_xp")
        .order("min_xp", { ascending: true }),
      loadEndorsementSummary(supabase, userId),
      isStudent ? loadSeasonHistory(supabase, userId, 1, 3)
        : Promise.resolve({ items: [], count: 0 }),
      isStudent ? loadMissionHistory(supabase, userId, 1, 5)
        : Promise.resolve({ items: [], count: 0 }),
      supabase.from("user_badges")
        .select(`badge_definitions(badge_name), scope_type, rank_position, population_total,
          program_studi(nama_program_studi), fakultas(nama_fakultas)`)
        .eq("user_id", userId).eq("is_equipped", true).maybeSingle(),
      isStudent ? loadBadgeCollection(supabase, userId) : Promise.resolve(null),
    ]);

  const [facultyResult, seasonalResult] = await Promise.all([
    programResult.data
      ? supabase.from("fakultas").select("nama_fakultas")
          .eq("fakultas_id", programResult.data.fakultas_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    seasonResult.data
      ? supabase.from("current_seasonal_xp_totals").select("seasonal_xp")
          .eq("user_id", userId).eq("season_id", seasonResult.data.season_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const queryError = classResult.error || programResult.error || skillsResult.error ||
    careerResult.error || seasonResult.error || rulesResult.error || facultyResult.error ||
    seasonalResult.error;
  if (queryError || !programResult.data || !facultyResult.data ||
      !careerResult.data || !rulesResult.data?.length ||
      (seasonResult.data && !seasonalResult.data)) {
    return <PageError message="Data akademik atau XP sedang tidak tersedia. Coba muat ulang." />;
  }

  const skills = (skillsResult.data ?? []).flatMap((row) => row.skills ?? [])
    .map((skill) => skill.nama_skill).sort((a, b) => a.localeCompare(b));
  const avatar = profile.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.foto_profil_path).data.publicUrl
    : null;
  const rules = rulesResult.data;

  // The equipped badge decides the pill and the colour of the avatar ring.
  const equipped = equippedResult.data;
  const badge = equipped ? describeBadge({
    badgeName: one(equipped.badge_definitions)?.badge_name ?? null,
    scopeType: equipped.scope_type ?? null,
    scopeName: equipped.scope_type === "FAKULTAS"
      ? one(equipped.fakultas)?.nama_fakultas ?? null
      : equipped.scope_type === "PROGRAM_STUDI"
        ? one(equipped.program_studi)?.nama_program_studi ?? null : null,
    rankPosition: equipped.rank_position ?? null,
    populationTotal: equipped.population_total ?? null,
  }) : null;

  const badgeNode = !isStudent ? null : equippedResult.error ? (
    <span role="alert" className="badge-pill badge-pill--empty">Badge terpasang belum dapat dimuat.</span>
  ) : badge ? (
    <BadgePill scope={badge.scope} tier={badge.tier} href="/profile/badges"
      detail={`${badge.detail} · Buka Badge Chest`}>{badge.label}</BadgePill>
  ) : (
    <Link href="/profile/badges" prefetch={false} title="Buka Badge Chest"
      className="badge-pill badge-pill--empty">Belum ada Badge terpasang</Link>
  );

  const tags = [
    classResult.data?.nama_class,
    facultyAbbreviation(facultyResult.data.nama_fakultas),
    programResult.data.nama_program_studi,
    `UNESA ${profile.tahun_masuk}`,
  ].filter((tag): tag is string => Boolean(tag));

  const seasonXp = seasonResult.data && seasonalResult.data ? seasonalResult.data.seasonal_xp : null;
  const rankOptions = [
    { key: "career", label: "Career Rank", xp: careerResult.data.career_xp },
    ...(seasonXp !== null ? [{ key: "season", label: "Season Rank", xp: seasonXp }] : []),
  ];

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />
      <main className="nexus-page-shell profile-v2 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ProfileHero name={profile.nama_lengkap} avatarUrl={avatar} tone={badgeTone(badge)}
          badge={badgeNode} tags={tags} bio={profile.bio?.trim() || "Belum ada bio."}
          actions={
            <>
              <Link href="/profile/edit" className="profile-action">Edit Profil</Link>
              {isStudent && <Link href="/profile/badges" prefetch={false} className="profile-action">Badge Chest</Link>}
              {isStudent && <ShareProfile userId={userId} />}
              {isStudent && <Link href="/profile/claims" className="profile-action">Klaim Achievement</Link>}
            </>
          } />

        {isStudent && <ProfileBadgeCollection collection={badgeCollection} />}

        {isStudent && (
          <div className="profile-grid">
            {seasonResult.data && seasonXp !== null ? (
              <XpProgressCard area="pc-season" tone="season" title="Season XP"
                subtitle={`${seasonResult.data.nama_season} Aktif`} xp={seasonXp} rules={rules} />
            ) : (
              <section className="profile-card pc-season" aria-label="Season XP">
                <h2>Season XP</h2>
                <p className="history2-note">Belum ada Season aktif.</p>
              </section>
            )}
            <XpProgressCard area="pc-career" tone="career" title="Career XP"
              subtitle="XP Career Total" xp={careerResult.data.career_xp} rules={rules} />
            <MissionHistoryCard area="pc-missions" items={missionHistory?.items ?? []}
              count={missionHistory?.count ?? 0} failed={!missionHistory}
              moreHref="/profile/missions"
              emptyText="Belum ada hasil atau prestasi yang diverifikasi dan menghasilkan XP." />

            <section className="profile-card pc-skills" aria-label="Skills">
              <h2>Skills</h2>
              {skills.length ? (
                <ul className="skills2-list">
                  {skills.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              ) : <p className="history2-note">Belum ada Skill yang dipilih.</p>}
            </section>
            <RankSwitcherCard area="pc-rank" options={rankOptions} rules={rules} />
            <EndorsementPanel area="pc-endorse" summary={endorsementSummary} />

            <SeasonHistoryTiles area="pc-seasons" items={seasonHistory?.items ?? []}
              count={seasonHistory?.count ?? 0} failed={!seasonHistory}
              moreHref="/profile/seasons"
              emptyText="Belum ada Season yang ditutup dan disimpan sebagai riwayat." />
          </div>
        )}
      </main>
    </div>
  );
}

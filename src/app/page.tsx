import { redirect } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Dashboard, { type ActiveMission } from "@/components/dashboard/Dashboard";
import type { LeaderboardEntry } from "@/app/leaderboard/types";
import { createClient } from "@/lib/supabase/server";

function PageError({ message }: { message: string }) {
  return <main className="nexus-auth"><section className="glass-card nexus-auth-card">
    <h1 className="text-2xl font-semibold">Home belum dapat dimuat</h1>
    <p role="alert" className="mt-4 text-sm text-slate-600">{message}</p>
  </section></main>;
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  const userId = auth.user.id;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, primary_class_id, role_app, status_akun, foto_profil_path").eq("user_id", userId).maybeSingle();
  if (profileError || !profile) return <PageError message="Data profil sedang tidak tersedia. Coba muat ulang." />;
  if (profile.status_akun !== "ACTIVE") return <PageError message="Akunmu sedang tidak aktif. Hubungi administrator." />;
  if (profile.role_app === "ADMIN") redirect("/admin");
  if (profile.primary_class_id === null) redirect("/onboarding");

  const [career, season, ranks, memberships] = await Promise.all([
    supabase.from("career_xp_totals").select("career_xp").eq("user_id", userId).maybeSingle(),
    supabase.from("seasons").select("season_id, nama_season").eq("status_season", "ACTIVE").maybeSingle(),
    supabase.from("rank_rules").select("rank_name, min_xp, max_xp").order("min_xp"),
    supabase.from("squad_members").select("squad_id, mission_id").eq("user_id", userId).eq("status_member", "ACTIVE")
      .order("joined_at", { ascending: false }),
  ]);
  const [seasonal, leaders, squads, missions] = await Promise.all([
    season.data ? supabase.from("current_seasonal_xp_totals").select("seasonal_xp")
      .eq("user_id", userId).eq("season_id", season.data.season_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    season.data ? supabase.rpc("get_current_leaderboard", {
      p_scope: "PROGRAM_STUDI", p_query: "", p_min_rank: 1, p_offset: 0, p_limit: 5,
    }) : Promise.resolve({ data: null, error: null }),
    memberships.data?.length ? supabase.from("squads").select("squad_id, mission_id, nama_squad, status_squad")
      .in("squad_id", memberships.data.map((row) => row.squad_id)).in("status_squad", ["OPEN_RECRUITMENT", "FULL", "FINALIZED"])
      : Promise.resolve({ data: [], error: null }),
    memberships.data?.length ? supabase.from("missions")
      .select("mission_id, nama_lomba, cakupan_peserta, biaya_pendaftaran, mission_tiers(kode_tier)")
      .in("mission_id", [...new Set(memberships.data.map((row) => row.mission_id))])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const missionsById = new Map((missions.data ?? []).map((mission) => [mission.mission_id, mission]));
  const squadsById = new Map((squads.data ?? []).map((squad) => [squad.squad_id, squad]));
  const activeMissions: ActiveMission[] = (memberships.data ?? []).flatMap((membership) => {
    const squad = squadsById.get(membership.squad_id);
    if (!squad) return [];
    const mission = missionsById.get(squad.mission_id);
    if (!mission) return [];
    const relation = mission.mission_tiers as unknown as { kode_tier: string } | { kode_tier: string }[] | null;
    const tier = Array.isArray(relation) ? relation[0] : relation;
    return [{ squadId: squad.squad_id, squadName: squad.nama_squad, missionId: mission.mission_id,
      title: mission.nama_lomba, tier: tier?.kode_tier ?? null, scope: mission.cakupan_peserta, cost: mission.biaya_pendaftaran }];
  });
  const leaderboard = ((leaders.data ?? []) as LeaderboardEntry[]).map((entry) => ({
    ...entry, avatarUrl: entry.foto_profil_path
      ? supabase.storage.from("avatars").getPublicUrl(entry.foto_profil_path).data.publicUrl : null,
  }));
  return <div className="min-h-screen">
    <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="home" />
    <Dashboard name={profile.nama_lengkap} careerXp={career.data?.career_xp ?? null}
      seasonalXp={seasonal.data?.seasonal_xp ?? null} seasonName={season.data?.nama_season ?? null}
      rules={ranks.data ?? []}
      xpError={Boolean(career.error || !career.data || season.error || ranks.error || !ranks.data?.length ||
        seasonal.error || (season.data && !seasonal.data))}
      missions={activeMissions.slice(0, 3)}
      missionsError={Boolean(memberships.error || squads.error || missions.error ||
        (squads.data ?? []).some((squad) => !missionsById.has(squad.mission_id)))}
      leaders={leaderboard} leadersError={Boolean(leaders.error || season.error)} />
  </div>;
}


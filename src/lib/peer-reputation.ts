import type { SupabaseClient } from "@supabase/supabase-js";

import { describeBadge, one, RANK_ICONS, rankTierFromName } from "./badges";
import type { MissionHistoryItem } from "./mission-history";
import { computeRank, type RankRule } from "./rank-progress";

type HistoryRow = {
  history_id: string; source: "SQUAD" | "EXTERNAL"; name: string; organizer: string;
  squad_name: string | null; result: string; earned_at: string; xp: number; mission_id: string | null;
};

export async function loadPeerReputation(supabase: SupabaseClient, userId: string) {
  const [career, rules, equipped, history] = await Promise.all([
    supabase.from("career_xp_totals").select("career_xp").eq("user_id", userId).maybeSingle(),
    supabase.from("rank_rules").select("rank_name,min_xp,max_xp").order("min_xp", { ascending: true }),
    supabase.from("user_badges")
      .select("badge_definitions(badge_name),scope_type,rank_position,population_total,program_studi(nama_program_studi),fakultas(nama_fakultas)")
      .eq("user_id", userId).eq("is_equipped", true).maybeSingle(),
    // A sanitized contract, not the private XP ledger, claims or evidence tables.
    supabase.rpc("get_peer_verified_mission_history", { p_user_id: userId }),
  ]);

  const value = career.data?.career_xp;
  const xp = !career.error && typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value : null;
  const rankRules = !rules.error ? (rules.data ?? []) as RankRule[] : [];
  const rank = xp !== null && rankRules.length ? computeRank(xp, rankRules).current : null;
  const tier = rankTierFromName(rank?.rank_name, xp);
  const row = equipped.error ? null : equipped.data;
  // Supabase relations can arrive as an object or a one-element array.
  const definition = one<{ badge_name: string }>(row?.badge_definitions);
  const faculty = one<{ nama_fakultas: string }>(row?.fakultas);
  const program = one<{ nama_program_studi: string }>(row?.program_studi);
  const badge = row ? describeBadge({
    badgeName: definition?.badge_name ?? null, scopeType: row.scope_type ?? null,
    scopeName: row.scope_type === "FAKULTAS" ? faculty?.nama_fakultas ?? null
      : row.scope_type === "PROGRAM_STUDI" ? program?.nama_program_studi ?? null : null,
    rankPosition: row.rank_position ?? null, populationTotal: row.population_total ?? null,
  }) : null;
  const items: MissionHistoryItem[] | null = history.error || !history.data ? null
    : (history.data as HistoryRow[]).map(item => ({
      id: item.history_id, source: item.source, name: item.name, organizer: item.organizer,
      squadName: item.squad_name, result: item.result, date: item.earned_at,
      xp: item.xp, missionId: item.mission_id,
    }));

  return { xp, rankName: rank?.rank_name ?? null, rankIcon: tier ? RANK_ICONS[tier] : null,
    rules: rankRules, badge, badgeFailed: Boolean(equipped.error || (row && !badge)), history: items };
}

export type PeerReputation = Awaited<ReturnType<typeof loadPeerReputation>>;

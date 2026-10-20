import type { SupabaseClient } from "@supabase/supabase-js";

import { describeBadge, one, type BadgeView } from "./badges";

export type CollectedBadge = {
  id: string; badge: BadgeView; context: string; season: string | null;
  awardedAt: string; equipped: boolean;
};
export type BadgeCollection = { items: CollectedBadge[]; count: number };

export async function loadBadgeCollection(
  supabase: SupabaseClient, userId: string,
): Promise<BadgeCollection | null> {
  const { data, count, error } = await supabase.from("user_badges")
    .select(`user_badge_id,reward_context,scope_type,rank_position,population_total,
      is_equipped,awarded_at,badge_definitions(badge_name),seasons(nama_season),
      program_studi(nama_program_studi),fakultas(nama_fakultas)`, { count: "exact" })
    .eq("user_id", userId).order("is_equipped", { ascending: false })
    .order("awarded_at", { ascending: false }).order("user_badge_id", { ascending: true }).limit(12);
  if (error || !data || count === null) return null;

  const items: CollectedBadge[] = [];
  for (const row of data) {
    const definition = one<{ badge_name: string }>(row.badge_definitions);
    const faculty = one<{ nama_fakultas: string }>(row.fakultas);
    const program = one<{ nama_program_studi: string }>(row.program_studi);
    const season = one<{ nama_season: string }>(row.seasons);
    const badge = describeBadge({
      badgeName: definition?.badge_name ?? null, scopeType: row.scope_type,
      scopeName: row.scope_type === "FAKULTAS" ? faculty?.nama_fakultas ?? null
        : row.scope_type === "PROGRAM_STUDI" ? program?.nama_program_studi ?? null : null,
      rankPosition: row.rank_position, populationTotal: row.population_total,
    });
    if (!definition?.badge_name || !badge) return null;
    items.push({ id: row.user_badge_id, badge, equipped: row.is_equipped,
      awardedAt: row.awarded_at, season: season?.nama_season ?? null,
      context: row.reward_context === "CAREER" ? "Career Rank-Up"
        : row.reward_context === "SEASONAL" ? "Seasonal Rank-Up" : "Leaderboard" });
  }
  return { items, count };
}

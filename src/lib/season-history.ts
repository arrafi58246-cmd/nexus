import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Relation<T> = T | T[] | null;

type UserSnapshot = {
  season_id: string;
  seasonal_xp: number;
  season_rank_name: string;
  snapshot_at: string;
  season: Relation<{ nama_season: string; start_date: string; end_date: string }>;
};

type BoardSnapshot = {
  season_id: string;
  scope_type: "UNIVERSITAS" | "FAKULTAS" | "PROGRAM_STUDI";
  rank_position: number;
  population_total: number;
  program: Relation<{ nama_program_studi: string }>;
  faculty: Relation<{ nama_fakultas: string }>;
};

export type SeasonRank = {
  scope: BoardSnapshot["scope_type"];
  label: string;
  position: number;
  population: number;
};

export type SeasonHistory = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  xp: number;
  rank: string;
  snapshotAt: string;
  positions: SeasonRank[];
};

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value.length === 1 ? value[0] : null : value;
}

const scopeOrder = { PROGRAM_STUDI: 0, FAKULTAS: 1, UNIVERSITAS: 2 };

export async function loadSeasonHistory(
  supabase: Supabase, userId: string, page: number, pageSize = 10,
): Promise<{ items: SeasonHistory[]; count: number } | null> {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from("season_user_history")
    .select(`season_id,seasonal_xp,season_rank_name,snapshot_at,
      season:seasons(nama_season,start_date,end_date)`, { count: "exact" })
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .order("season_id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error || !data || count === null) return null;

  const snapshots = data as UserSnapshot[];
  if (snapshots.some((row) => !one(row.season))) return null;
  if (snapshots.length === 0) return { items: [], count };

  const { data: positions, error: positionsError } = await supabase
    .from("season_leaderboard_history")
    .select(`season_id,scope_type,rank_position,population_total,
      program:program_studi(nama_program_studi),faculty:fakultas(nama_fakultas)`)
    .eq("user_id", userId)
    .in("season_id", snapshots.map((row) => row.season_id));
  if (positionsError || !positions) return null;

  const bySeason = new Map<string, SeasonRank[]>();
  for (const row of positions as BoardSnapshot[]) {
    const label = row.scope_type === "PROGRAM_STUDI"
      ? one(row.program)?.nama_program_studi ?? "Program Studi"
      : row.scope_type === "FAKULTAS"
        ? one(row.faculty)?.nama_fakultas ?? "Fakultas" : "Universitas";
    const ranks = bySeason.get(row.season_id) ?? [];
    ranks.push({ scope: row.scope_type, label,
      position: row.rank_position, population: row.population_total });
    bySeason.set(row.season_id, ranks);
  }

  return { count, items: snapshots.map((row) => {
    const season = one(row.season)!;
    return {
      id: row.season_id,
      name: season.nama_season,
      startDate: season.start_date,
      endDate: season.end_date,
      xp: row.seasonal_xp,
      rank: row.season_rank_name,
      snapshotAt: row.snapshot_at,
      positions: (bySeason.get(row.season_id) ?? [])
        .sort((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope]),
    };
  }) };
}

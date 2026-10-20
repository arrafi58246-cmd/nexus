import type { createClient } from "@/lib/supabase/server";
import { endorsementWindow } from "./endorsement-window";

export const ENDORSEMENT_FIELDS = [
  ["communication", "Komunikasi"],
  ["contribution", "Kontribusi"],
  ["teamwork", "Kerja sama"],
  ["responsibility", "Tanggung jawab"],
] as const;

export type EndorsementField = (typeof ENDORSEMENT_FIELDS)[number][0];
export type EndorsementScores = Record<EndorsementField, number>;
export type EndorsementSummary = { count: number; averages: EndorsementScores };
export type SharedSquad = {
  squadId: string; name: string; alreadyRated: boolean;
  closesAt: string | null; windowOpen: boolean;
};

export async function loadSharedCompletedSquads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
  targetUserId: string,
): Promise<SharedSquad[] | null> {
  const { data: mine, error: mineError } = await supabase.from("finalized_squad_members")
    .select("squad_id").eq("user_id", viewerId);
  if (mineError || !mine) return null;
  const squadIds = [...new Set(mine.map((row) => row.squad_id))];
  if (squadIds.length === 0) return [];

  const [peer, completed, rated] = await Promise.all([
    supabase.from("finalized_squad_members").select("squad_id")
      .eq("user_id", targetUserId).in("squad_id", squadIds),
    supabase.from("squads").select("squad_id,nama_squad,completed_at")
      .eq("status_squad", "MISSION_COMPLETED").in("squad_id", squadIds),
    supabase.from("endorsements").select("squad_id")
      .eq("from_user_id", viewerId).eq("to_user_id", targetUserId)
      .in("squad_id", squadIds),
  ]);
  if (peer.error || completed.error || rated.error) return null;
  const peerIds = new Set((peer.data ?? []).map((row) => row.squad_id));
  const ratedIds = new Set((rated.data ?? []).map((row) => row.squad_id));
  return (completed.data ?? []).filter((squad) => peerIds.has(squad.squad_id))
    .map((squad) => ({
      squadId: squad.squad_id,
      name: squad.nama_squad,
      alreadyRated: ratedIds.has(squad.squad_id),
      ...endorsementWindow(squad.completed_at),
    })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadEndorsementSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<EndorsementSummary | null> {
  const totals: EndorsementScores = {
    communication: 0, contribution: 0, teamwork: 0, responsibility: 0,
  };
  const pageSize = 1000;
  let count = 0;

  // PostgREST membatasi jumlah baris per respons; ambil semua halaman agar rata-ratanya benar.
  while (true) {
    const { data, error } = await supabase.from("endorsements")
      .select("communication,contribution,teamwork,responsibility")
      .eq("to_user_id", userId)
      .order("endorsement_id", { ascending: true })
      .range(count, count + pageSize - 1);
    if (error || !data) return null;

    for (const row of data) {
      for (const [field] of ENDORSEMENT_FIELDS) totals[field] += row[field];
    }
    count += data.length;
    if (data.length < pageSize) break;
  }

  return {
    count,
    averages: Object.fromEntries(ENDORSEMENT_FIELDS.map(([field]) => [
      field, count ? Number((totals[field] / count).toFixed(1)) : 0,
    ])) as EndorsementScores,
  };
}

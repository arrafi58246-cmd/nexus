import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MissionHistoryItem = {
  id: string;
  source: "SQUAD" | "EXTERNAL";
  name: string;
  organizer: string;
  squadName: string | null;
  result: string;
  date: string;
  xp: number;
  missionId: string | null;
};

type Transaction = {
  xp_transaction_id: string;
  xp_source_type: "VERIFIED_MISSION" | "LEGACY_ACHIEVEMENT";
  xp_amount: number;
  earned_at: string;
  mission_result_submission_id: string | null;
  achievement_claim_id: string | null;
};

export async function loadMissionHistory(
  supabase: Supabase, userId: string, page: number, pageSize = 10,
): Promise<{ items: MissionHistoryItem[]; count: number } | null> {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase.from("xp_transactions")
    .select(`xp_transaction_id,xp_source_type,xp_amount,earned_at,
      mission_result_submission_id,achievement_claim_id`, { count: "exact" })
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .order("xp_transaction_id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error || !data || count === null) return null;

  const transactions = data as Transaction[];
  const resultIds = transactions.flatMap((row) =>
    row.mission_result_submission_id ? [row.mission_result_submission_id] : []);
  const claimIds = transactions.flatMap((row) =>
    row.achievement_claim_id ? [row.achievement_claim_id] : []);
  const [results, claims] = await Promise.all([
    resultIds.length ? supabase.from("mission_result_submissions")
      .select("result_submission_id,squad_id,hasil_kompetisi,approved_hasil_kompetisi,status_validation")
      .in("result_submission_id", resultIds) : Promise.resolve({ data: [], error: null }),
    claimIds.length ? supabase.from("achievement_claims")
      .select("achievement_claim_id,nama_kompetisi,penyelenggara,hasil_kompetisi,status_validation")
      .eq("user_id", userId).in("achievement_claim_id", claimIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (results.error || claims.error || !results.data || !claims.data) return null;

  const squadIds = [...new Set(results.data.map((row) => row.squad_id))];
  const { data: squads, error: squadError } = squadIds.length
    ? await supabase.from("squads").select("squad_id,mission_id,nama_squad")
      .in("squad_id", squadIds)
    : { data: [], error: null };
  if (squadError || !squads) return null;
  const missionIds = [...new Set(squads.map((row) => row.mission_id))];
  const { data: missions, error: missionError } = missionIds.length
    ? await supabase.from("missions").select("mission_id,nama_lomba,penyelenggara")
      .in("mission_id", missionIds)
    : { data: [], error: null };
  if (missionError || !missions) return null;

  const resultById = new Map(results.data.map((row) => [row.result_submission_id, row]));
  const claimById = new Map(claims.data.map((row) => [row.achievement_claim_id, row]));
  const squadById = new Map(squads.map((row) => [row.squad_id, row]));
  const missionById = new Map(missions.map((row) => [row.mission_id, row]));
  const items: MissionHistoryItem[] = [];

  for (const row of transactions) {
    if (row.xp_source_type === "VERIFIED_MISSION" && row.mission_result_submission_id) {
      const result = resultById.get(row.mission_result_submission_id);
      const squad = result && squadById.get(result.squad_id);
      const mission = squad && missionById.get(squad.mission_id);
      if (!result || result.status_validation !== "APPROVED" || !squad || !mission) return null;
      items.push({ id: row.xp_transaction_id, source: "SQUAD",
        name: mission.nama_lomba, organizer: mission.penyelenggara,
        squadName: squad.nama_squad,
        result: result.approved_hasil_kompetisi ?? result.hasil_kompetisi,
        date: row.earned_at, xp: row.xp_amount, missionId: mission.mission_id });
    } else if (row.xp_source_type === "LEGACY_ACHIEVEMENT" && row.achievement_claim_id) {
      const claim = claimById.get(row.achievement_claim_id);
      if (!claim || claim.status_validation !== "APPROVED") return null;
      items.push({ id: row.xp_transaction_id, source: "EXTERNAL",
        name: claim.nama_kompetisi, organizer: claim.penyelenggara,
        squadName: null, result: claim.hasil_kompetisi,
        date: row.earned_at, xp: row.xp_amount, missionId: null });
    } else return null;
  }

  return { items, count };
}

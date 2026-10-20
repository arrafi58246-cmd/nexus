import type { SupabaseClient } from "@supabase/supabase-js";

// Resolve identities only for applications already returned by the leader RPC.
// The caller's session and squad_applications RLS still apply to this lookup.
export async function loadPendingApplicantIds(
  supabase: SupabaseClient,
  missionId: string,
  applicationIds: string[],
): Promise<Map<string, string> | null> {
  if (applicationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("squad_applications")
    .select("application_id, user_id")
    .eq("mission_id", missionId)
    .eq("status_application", "PENDING")
    .in("application_id", applicationIds);

  if (error) return null;
  return new Map((data ?? []).map((row) => [row.application_id, row.user_id]));
}

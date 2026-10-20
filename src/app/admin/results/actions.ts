"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { RESULT_OPTIONS, type CompetitionResult } from "@/app/squads/[squadId]/result/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReviewOutcome = { success: true } | { success: false; message: string };

export async function reviewMissionResult(
  resultId: string,
  decision: "APPROVED" | "REJECTED",
  tierId: number | null,
  approvedResult: CompetitionResult | null,
  reason: string | null,
): Promise<ReviewOutcome> {
  if (!UUID_PATTERN.test(resultId) || !["APPROVED", "REJECTED"].includes(decision)) {
    return { success: false, message: "Keputusan tidak valid." };
  }

  if (decision === "APPROVED") {
    if (!Number.isSafeInteger(tierId) || (tierId ?? 0) <= 0 ||
        !RESULT_OPTIONS.some((option) => option.value === approvedResult) || reason !== null) {
      return { success: false, message: "Pilih tier dan hasil akhir yang valid." };
    }
  } else if (tierId !== null || approvedResult !== null || !reason ||
             !reason.trim() || reason.length > 1000) {
    return { success: false, message: "Isi alasan penolakan (maksimal 1000 karakter)." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, message: "Silakan login kembali." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app, status_akun").eq("user_id", auth.user.id).maybeSingle();
  if (profileError || profile?.role_app !== "ADMIN" || profile.status_akun !== "ACTIVE") {
    return { success: false, message: "Kamu tidak memiliki akses untuk menilai hasil." };
  }

  const { data: pending, error: pendingError } = await supabase
    .from("mission_result_submissions")
    .select("squad_id, status_validation")
    .eq("result_submission_id", resultId).maybeSingle();
  if (pendingError || pending?.status_validation !== "PENDING") {
    return { success: false, message: "Pengajuan ini tidak lagi menunggu penilaian." };
  }

  const { error } = await supabase.rpc("review_mission_result", {
    p_result_submission_id: resultId,
    p_decision: decision,
    p_approved_tier_id: decision === "APPROVED" ? tierId : null,
    p_approved_hasil: decision === "APPROVED" ? approvedResult : null,
    p_rejection_reason: decision === "REJECTED" ? reason!.trim() : null,
  });
  if (error) {
    return { success: false, message: "Penilaian belum tersimpan. Muat ulang dan periksa statusnya." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${resultId}`);
  revalidatePath(`/squads/${pending.squad_id}/result`);
  revalidatePath(`/squads/${pending.squad_id}`);
  revalidatePath("/my-squad");
  return { success: true };
}


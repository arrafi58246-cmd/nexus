"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Outcome = { success: true } | { success: false; message: string };

export async function reviewAchievement(
  claimId: string,
  decision: "APPROVED" | "REJECTED",
  tierId: number | null,
  reason: string | null,
): Promise<Outcome> {
  if (!UUID.test(claimId) || !["APPROVED", "REJECTED"].includes(decision) ||
      (decision === "APPROVED" && (!Number.isSafeInteger(tierId) || (tierId ?? 0) < 1 || reason !== null)) ||
      (decision === "REJECTED" &&
        (tierId !== null || !reason?.trim() || reason.length > 1000))) {
    return { success: false, message: "Keputusan tidak valid." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { success: false, message: "Silakan login kembali." };
  const { data: admin, error: adminError } = await supabase.from("profiles")
    .select("role_app, status_akun").eq("user_id", auth.user.id).maybeSingle();
  if (adminError || admin?.role_app !== "ADMIN" || admin.status_akun !== "ACTIVE") {
    return { success: false, message: "Kamu tidak memiliki akses untuk review klaim." };
  }
  const { data: claim, error: claimError } = await supabase.from("achievement_claims")
    .select("status_validation, user_id, hasil_kompetisi, sertifikat_path")
    .eq("achievement_claim_id", claimId).maybeSingle();
  if (claimError || claim?.status_validation !== "PENDING") {
    return { success: false, message: "Klaim ini tidak lagi menunggu review." };
  }
  const { error: evidenceError } = await supabase.storage
    .from("achievement-certificates").info(claim.sertifikat_path);
  if (evidenceError) {
    return { success: false, message: "Sertifikat tidak tersedia. Periksa bukti sebelum menilai." };
  }
  if (decision === "APPROVED") {
    const { data: rule, error: ruleError } = await supabase.from("xp_rules")
      .select("legacy_xp").eq("tier_id", tierId!)
      .eq("hasil_kompetisi", claim.hasil_kompetisi).maybeSingle();
    if (ruleError || !rule) return { success: false, message: "Aturan XP tidak tersedia." };
  }

  const { data: saved, error } = await supabase.from("achievement_claims")
    .update(decision === "APPROVED"
      ? { status_validation: "APPROVED", approved_tier_id: tierId }
      : { status_validation: "REJECTED", rejection_reason: reason!.trim() })
    .eq("achievement_claim_id", claimId).eq("status_validation", "PENDING")
    .select("achievement_claim_id").maybeSingle();
  if (error || !saved) {
    return { success: false, message: "Keputusan belum tersimpan. Muat ulang dan cek status klaim." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/achievements");
  revalidatePath(`/admin/achievements/${claimId}`);
  revalidatePath("/profile/claims");
  revalidatePath(`/profile/${claim.user_id}`);
  revalidatePath("/leaderboard");
  return { success: true };
}


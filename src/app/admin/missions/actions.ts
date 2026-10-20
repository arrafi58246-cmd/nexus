"use server";

import { revalidatePath } from "next/cache";

import { validSubmissionId } from "@/app/missions/add/validation";
import { createClient } from "@/lib/supabase/server";

type Outcome = { success: true } | { success: false; message: string };

export async function reviewMission(
  submissionId: string,
  decision: "APPROVED" | "REJECTED",
  tierId: number | null,
  reason: string | null,
  min: number | null,
  max: number | null,
): Promise<Outcome> {
  if (!validSubmissionId(submissionId) ||
      !["APPROVED", "REJECTED"].includes(decision) ||
      (decision === "APPROVED" &&
        (!Number.isSafeInteger(tierId) || (tierId ?? 0) < 1 || reason !== null ||
          !Number.isInteger(min) || !Number.isInteger(max) ||
          (min ?? 0) < 2 || (max ?? 0) < (min ?? 0) || (max ?? 0) > 32767)) ||
      (decision === "REJECTED" &&
        (tierId !== null || !reason?.trim() || reason.length > 1000 ||
          min !== null || max !== null))) {
    return { success: false, message: "Keputusan tidak valid." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { success: false, message: "Silakan login kembali." };
  const { data: admin, error: adminError } = await supabase.from("profiles")
    .select("role_app,status_akun").eq("user_id", auth.user.id).maybeSingle();
  if (adminError || admin?.role_app !== "ADMIN" || admin.status_akun !== "ACTIVE") {
    return { success: false, message: "Kamu tidak memiliki akses review." };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("mission_submissions")
    .select("status_review,dokumen_path,deadline_pendaftaran,link_resmi,nama_lomba,penyelenggara,tahun_lomba")
    .eq("mission_submission_id", submissionId).maybeSingle();
  if (submissionError || submission?.status_review !== "PENDING") {
    return { success: false, message: "Pengajuan ini tidak lagi menunggu review." };
  }

  if (decision === "APPROVED") {
    try {
      if (!["https:", "http:"].includes(new URL(submission.link_resmi).protocol)) {
        return { success: false, message: "Tautan resmi tidak valid." };
      }
    } catch { return { success: false, message: "Tautan resmi tidak valid." }; }
    if (new Date(submission.deadline_pendaftaran).getTime() <= Date.now()) {
      return { success: false, message: "Pendaftaran lomba sudah berakhir. Pengajuan tidak dapat disetujui." };
    }
    const [tierQuery, evidence, candidates] = await Promise.all([
      supabase.from("mission_tiers").select("tier_id").eq("tier_id", tierId!).maybeSingle(),
      supabase.storage.from("mission-documents").info(submission.dokumen_path),
      supabase.from("missions").select("nama_lomba,penyelenggara")
        .eq("tahun_lomba", submission.tahun_lomba),
    ]);
    if (tierQuery.error || !tierQuery.data || evidence.error ||
        candidates.error || !candidates.data) {
      return { success: false, message: "Tier, dokumen, atau Mission belum dapat diverifikasi." };
    }
    const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");
    if (candidates.data.some((item) =>
      normalize(item.nama_lomba) === normalize(submission.nama_lomba) &&
      normalize(item.penyelenggara) === normalize(submission.penyelenggara))) {
      return { success: false, message: "Mission dengan nama, penyelenggara, dan tahun yang sama sudah tersedia." };
    }
  }

  const changes = decision === "APPROVED"
    ? { status_review: "APPROVED", final_tier_id: tierId,
        min_anggota_tim: min, max_anggota_tim: max }
    : { status_review: "REJECTED", alasan_penolakan: reason!.trim() };
  const { data: saved, error } = await supabase.from("mission_submissions")
    .update(changes).eq("mission_submission_id", submissionId)
    .eq("status_review", "PENDING")
    .select("mission_submission_id").maybeSingle();
  if (error || !saved) {
    return { success: false, message: "Keputusan belum tersimpan. Muat ulang dan cek status pengajuan." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${submissionId}`);
  revalidatePath("/missions");
  revalidatePath("/missions/submissions");
  return { success: true };
}


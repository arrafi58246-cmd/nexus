"use server";

import { createClient } from "@/lib/supabase/server";

export type OnboardingResult =
  | { success: true; alreadyCompleted?: boolean }
  | { success: false; message: string };

const SAFE_ERROR = "Onboarding belum dapat disimpan. Silakan coba lagi.";

export async function completeOnboarding(
  selectedClassId: number,
  selectedSkillIds: number[],
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { success: false, message: "Sesi Anda telah berakhir. Silakan login kembali." };
  }

  if (
    !Number.isInteger(selectedClassId) ||
    selectedClassId <= 0 ||
    !Array.isArray(selectedSkillIds)
  ) {
    return { success: false, message: "Pilihan onboarding tidak valid." };
  }

  const uniqueSkillIds = [...new Set(selectedSkillIds)];
  if (
    uniqueSkillIds.length !== selectedSkillIds.length ||
    uniqueSkillIds.length > 5 ||
    uniqueSkillIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    return { success: false, message: "Pilihan onboarding tidak valid." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, role_app, status_akun, primary_class_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) return { success: false, message: SAFE_ERROR };
  if (profile.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE") {
    return { success: false, message: "Onboarding hanya tersedia untuk mahasiswa aktif." };
  }
  if (profile.primary_class_id !== null) return { success: true, alreadyCompleted: true };

  const { data: primaryClass, error: classError } = await supabase
    .from("primary_classes")
    .select("primary_class_id")
    .eq("primary_class_id", selectedClassId)
    .maybeSingle();

  if (classError || !primaryClass) {
    return { success: false, message: "Primary Class yang dipilih tidak valid." };
  }

  if (uniqueSkillIds.length > 0) {
    const { data: selectedSkills, error: skillsError } = await supabase
      .from("skills")
      .select("skill_id, primary_class_id")
      .in("skill_id", uniqueSkillIds);

    if (
      skillsError ||
      !selectedSkills ||
      selectedSkills.length !== uniqueSkillIds.length ||
      selectedSkills.some((skill) => skill.primary_class_id !== selectedClassId)
    ) {
      return { success: false, message: "Skills harus berasal dari Primary Class yang dipilih." };
    }
  }

  // Profil masih incomplete, sehingga pilihan lama boleh direkonsiliasi agar retry idempotent.
  const { error: deleteError } = await supabase
    .from("user_skills")
    .delete()
    .eq("user_id", authData.user.id);

  if (deleteError) return { success: false, message: SAFE_ERROR };

  if (uniqueSkillIds.length > 0) {
    const { error: insertError } = await supabase.from("user_skills").insert(
      uniqueSkillIds.map((skillId) => ({ user_id: authData.user.id, skill_id: skillId })),
    );
    if (insertError) return { success: false, message: SAFE_ERROR };
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ primary_class_id: selectedClassId })
    .eq("user_id", authData.user.id)
    .is("primary_class_id", null)
    .select("user_id")
    .maybeSingle();

  if (updateError) return { success: false, message: SAFE_ERROR };
  if (!updatedProfile) return { success: true, alreadyCompleted: true };

  return { success: true };
}

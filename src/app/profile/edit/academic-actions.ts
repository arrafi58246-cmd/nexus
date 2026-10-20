"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type EditResult = { success: true } | { success: false; message: string };

function validId(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

async function editor() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;

  const { data: profile, error } = await supabase.from("profiles")
    .select("role_app,status_akun,primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (error || profile?.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE" ||
      profile.primary_class_id === null) return null;
  return { supabase, userId: auth.user.id };
}

function refreshProfile() {
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
}

export async function updatePrimaryClass(classId: number): Promise<EditResult> {
  if (!validId(classId)) return { success: false, message: "Pilih Primary Class yang valid." };
  const session = await editor();
  if (!session) return { success: false, message: "Akun belum dapat mengubah Class. Silakan login ulang." };

  const { data: selected, error: classError } = await session.supabase
    .from("primary_classes").select("primary_class_id")
    .eq("primary_class_id", classId).maybeSingle();
  if (classError || !selected) {
    return { success: false, message: "Primary Class tidak tersedia. Muat ulang halaman." };
  }

  const { data: updated, error } = await session.supabase.from("profiles")
    .update({ primary_class_id: classId })
    .eq("user_id", session.userId).eq("status_akun", "ACTIVE")
    .select("primary_class_id").maybeSingle();
  if (error || updated?.primary_class_id !== classId) {
    return { success: false, message: "Primary Class belum tersimpan. Coba lagi." };
  }
  refreshProfile();
  return { success: true };
}

export async function addProfileSkill(skillId: number): Promise<EditResult> {
  if (!validId(skillId)) return { success: false, message: "Pilih Skill yang valid." };
  const session = await editor();
  if (!session) return { success: false, message: "Akun belum dapat mengubah Skills. Silakan login ulang." };

  const { data: skill, error: skillError } = await session.supabase.from("skills")
    .select("skill_id").eq("skill_id", skillId).maybeSingle();
  if (skillError || !skill) {
    return { success: false, message: "Skill tidak tersedia. Muat ulang halaman." };
  }
  const { count, error: countError } = await session.supabase.from("user_skills")
    .select("user_skill_id", { count: "exact", head: true })
    .eq("user_id", session.userId);
  if (countError || count === null) {
    return { success: false, message: "Jumlah Skills belum dapat diperiksa. Coba lagi." };
  }
  if (count >= 5) return { success: false, message: "Maksimal lima Skills." };

  const { error } = await session.supabase.from("user_skills")
    .insert({ user_id: session.userId, skill_id: skillId });
  if (error) {
    return { success: false, message: error.code === "23505"
      ? "Skill ini sudah dipilih. Muat ulang halaman."
      : "Skill belum tersimpan. Batas maksimal lima Skills berlaku. Muat ulang lalu coba lagi." };
  }
  refreshProfile();
  return { success: true };
}

export async function removeProfileSkill(skillId: number): Promise<EditResult> {
  if (!validId(skillId)) return { success: false, message: "Skill tidak valid." };
  const session = await editor();
  if (!session) return { success: false, message: "Akun belum dapat mengubah Skills. Silakan login ulang." };

  const { data, error } = await session.supabase.from("user_skills")
    .delete().eq("user_id", session.userId).eq("skill_id", skillId)
    .select("user_skill_id");
  if (error || !data?.length) {
    return { success: false, message: "Skill belum berhasil dihapus. Muat ulang lalu coba lagi." };
  }
  refreshProfile();
  return { success: true };
}

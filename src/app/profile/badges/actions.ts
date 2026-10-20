"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type EquipBadgeResult = { success: true } | { success: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function equipBadge(userBadgeId: string): Promise<EquipBadgeResult> {
  if (typeof userBadgeId !== "string" || !UUID.test(userBadgeId)) {
    return { success: false, message: "Badge tidak valid." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, message: "Sesi berakhir. Silakan login kembali." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app, status_akun, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (profileError) {
    return { success: false, message: "Akun belum dapat diperiksa. Coba lagi." };
  }
  if (!profile || profile.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE" ||
      profile.primary_class_id === null) {
    return { success: false, message: "Akun ini belum dapat memasang Badge." };
  }

  const { data: owned, error: ownedError } = await supabase.from("user_badges")
    .select("user_badge_id, is_equipped")
    .eq("user_id", auth.user.id)
    .eq("user_badge_id", userBadgeId).maybeSingle();
  if (ownedError) {
    return { success: false, message: "Badge belum dapat diperiksa. Coba lagi." };
  }
  if (!owned) return { success: false, message: "Badge tidak ada di koleksimu." };
  if (owned.is_equipped) return { success: true };

  const { error } = await supabase.rpc("equip_badge", {
    p_user_badge_id: userBadgeId,
  });
  if (error) {
    return { success: false, message: "Badge belum berhasil dipasang. Muat ulang lalu coba lagi." };
  }

  revalidatePath("/profile/badges");
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

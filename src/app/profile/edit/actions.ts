"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type EditResult = { success: true } | { success: false; message: string };

export async function updateProfileBasics(name: string, bio: string): Promise<EditResult> {
  if (typeof name !== "string" || typeof bio !== "string" || !name.trim()) {
    return { success: false, message: "Nama lengkap wajib diisi." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, message: "Sesi berakhir. Silakan login kembali." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("status_akun, role_app, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (profileError || !profile || profile.status_akun !== "ACTIVE" ||
      (profile.role_app !== "STUDENT" || profile.primary_class_id === null)) {
    return { success: false, message: "Profil belum dapat diubah dari akun ini." };
  }

  const { data: updated, error } = await supabase.from("profiles")
    .update({ nama_lengkap: name.trim(), bio: bio.trim() || null })
    .eq("user_id", auth.user.id)
    .eq("status_akun", "ACTIVE")
    .select("user_id").maybeSingle();
  if (error || !updated) {
    return { success: false, message: "Perubahan belum dapat disimpan. Coba lagi." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/");
  return { success: true };
}

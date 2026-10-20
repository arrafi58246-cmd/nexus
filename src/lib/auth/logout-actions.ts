"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logout(): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { success: false, message: "Belum berhasil keluar. Silakan coba lagi." };
  } catch {
    return { success: false, message: "Belum berhasil keluar. Periksa koneksi dan coba lagi." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

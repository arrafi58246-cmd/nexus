"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MembershipActionResult } from "./types";

export async function disbandSoloSquad(squadId: string): Promise<MembershipActionResult> {
  if (typeof squadId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(squadId)) {
    return { success: false, message: "Squad tidak valid." };
  }
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { success: false, message: "Silakan login kembali." };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app, status_akun, primary_class_id").eq("user_id", auth.user.id).maybeSingle();
  if (profileError || !profile || profile.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE"
    || profile.primary_class_id === null) {
    return { success: false, message: "Mahasiswa aktif yang selesai onboarding diperlukan." };
  }
  const { data: squad, error: squadError } = await supabase.from("squads")
    .select("ketua_id, mission_id, status_squad").eq("squad_id", squadId).maybeSingle();
  if (squadError || !squad || squad.ketua_id !== auth.user.id
    || !["OPEN_RECRUITMENT", "FULL", "DISBANDED"].includes(squad.status_squad)) {
    return { success: false, message: "Hanya ketua dapat membubarkan Squad sebelum finalisasi." };
  }
  // The RPC locks and rechecks the roster and Pending applications atomically.
  const { error } = await supabase.rpc("disband_solo_squad", { p_squad_id: squadId });
  if (error) return { success: false, message: error.code === "40001"
    ? "Lamaran berubah saat pembubaran. Muat ulang lalu coba lagi."
    : error.message === "Only a solo active leader can disband"
      ? "Masih ada anggota lain. Transfer kepemimpinan jika kamu ingin keluar."
      : "Pembubaran belum berhasil. Muat ulang untuk memeriksa status dan anggota Squad." };
  for (const path of ["/my-squad", "/", "/missions", "/notifications", `/missions/${squad.mission_id}`, `/squads/${squadId}`]) {
    revalidatePath(path);
  }
  return { success: true };
}

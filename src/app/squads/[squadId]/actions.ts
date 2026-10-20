"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { MembershipActionResult, SendMessageResult } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;

async function getActiveUser() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status_akun, role_app")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  return !profileError && profile?.status_akun === "ACTIVE" && profile.role_app === "STUDENT"
    ? { supabase, userId: authData.user.id }
    : null;
}

export async function leaveSquad(squadId: string): Promise<MembershipActionResult> {
  if (!UUID_PATTERN.test(squadId)) {
    return { success: false, message: "Squad tidak valid." };
  }

  const actor = await getActiveUser();
  if (!actor) {
    return { success: false, message: "Akun aktif diperlukan untuk keluar dari Squad." };
  }

  const { data: membership, error: membershipError } = await actor.supabase
    .from("squad_members")
    .select("role_squad, squads!inner(status_squad)")
    .eq("squad_id", squadId)
    .eq("user_id", actor.userId)
    .eq("status_member", "ACTIVE")
    .maybeSingle();

  const squad = Array.isArray(membership?.squads) ? membership.squads[0] : membership?.squads;
  if (membershipError || !membership || membership.role_squad !== "ANGGOTA" ||
      !squad || !["OPEN_RECRUITMENT", "FULL"].includes(squad.status_squad)) {
    return { success: false, message: "Kamu tidak dapat keluar dari Squad ini." };
  }

  const { error } = await actor.supabase.rpc("leave_squad", { p_squad_id: squadId });
  if (error) {
    return { success: false, message: "Gagal keluar dari Squad. Muat ulang lalu coba lagi." };
  }

  revalidatePath("/my-squad");
  revalidatePath(`/squads/${squadId}`);
  return { success: true };
}

export async function kickSquadMember(
  squadId: string,
  memberUserId: string,
): Promise<MembershipActionResult> {
  if (!UUID_PATTERN.test(squadId) || !UUID_PATTERN.test(memberUserId)) {
    return { success: false, message: "Anggota Squad tidak valid." };
  }

  const actor = await getActiveUser();
  if (!actor || actor.userId === memberUserId) {
    return { success: false, message: "Kamu tidak dapat mengeluarkan anggota ini." };
  }

  const { data: squad, error: squadError } = await actor.supabase
    .from("squads")
    .select("status_squad, ketua_id")
    .eq("squad_id", squadId)
    .maybeSingle();
  const { data: member, error: memberError } = await actor.supabase
    .from("squad_members")
    .select("role_squad")
    .eq("squad_id", squadId)
    .eq("user_id", memberUserId)
    .eq("status_member", "ACTIVE")
    .maybeSingle();

  if (squadError || memberError || !squad || squad.ketua_id !== actor.userId ||
      !["OPEN_RECRUITMENT", "FULL"].includes(squad.status_squad) ||
      !member || member.role_squad !== "ANGGOTA") {
    return { success: false, message: "Anggota ini tidak dapat dikeluarkan dari Squad." };
  }

  const { error } = await actor.supabase.rpc("kick_squad_member", {
    p_squad_id: squadId,
    p_user_id: memberUserId,
    p_reason: "Dikeluarkan oleh ketua Squad.",
  });
  if (error) {
    return { success: false, message: "Gagal mengeluarkan anggota. Muat ulang lalu coba lagi." };
  }

  revalidatePath("/my-squad");
  revalidatePath(`/squads/${squadId}`);
  return { success: true };
}

export async function finalizeSquad(squadId: string): Promise<MembershipActionResult> {
  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId)) {
    return { success: false, message: "Squad tidak valid." };
  }

  const actor = await getActiveUser();
  if (!actor) {
    return { success: false, message: "Akun aktif diperlukan untuk finalisasi Squad." };
  }

  const { data: squad, error: squadError } = await actor.supabase
    .from("squads")
    .select("mission_id, ketua_id, status_squad")
    .eq("squad_id", squadId)
    .maybeSingle();

  if (squadError || !squad || squad.ketua_id !== actor.userId ||
      !["OPEN_RECRUITMENT", "FULL"].includes(squad.status_squad)) {
    return { success: false, message: "Squad ini tidak dapat difinalisasi." };
  }

  const [missionResult, membersResult] = await Promise.all([
    actor.supabase
      .from("missions")
      .select("min_anggota_tim")
      .eq("mission_id", squad.mission_id)
      .maybeSingle(),
    actor.supabase.rpc("get_squad_room_members", { p_squad_id: squadId }),
  ]);
  if (missionResult.error || membersResult.error || !missionResult.data ||
      !Array.isArray(membersResult.data)) {
    return { success: false, message: "Syarat finalisasi belum dapat diperiksa." };
  }
  const minimum = missionResult.data.min_anggota_tim;
  if (minimum === null || membersResult.data.length < minimum) {
    return { success: false, message: "Jumlah anggota aktif belum memenuhi minimum Mission." };
  }

  // The RPC locks the Squad and checks the active count again atomically.
  const { error } = await actor.supabase.rpc("finalize_squad", {
    p_squad_id: squadId,
  });
  if (error) {
    return {
      success: false,
      message: "Finalisasi gagal. Pastikan anggota aktif memenuhi minimum Mission, lalu muat ulang.",
    };
  }

  revalidatePath("/my-squad");
  revalidatePath(`/squads/${squadId}`);
  revalidatePath(`/missions/${squad.mission_id}`);
  return { success: true };
}

export async function transferSquadLeadership(
  squadId: string,
  newLeaderId: string,
): Promise<MembershipActionResult> {
  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId) ||
      typeof newLeaderId !== "string" || !UUID_PATTERN.test(newLeaderId)) {
    return { success: false, message: "Squad atau calon ketua tidak valid." };
  }

  const actor = await getActiveUser();
  if (!actor || actor.userId === newLeaderId) {
    return { success: false, message: "Pilih anggota aktif lain sebagai ketua baru." };
  }

  const { data: squad, error: squadError } = await actor.supabase
    .from("squads")
    .select("mission_id, ketua_id, status_squad")
    .eq("squad_id", squadId)
    .maybeSingle();
  if (squadError || !squad || squad.ketua_id !== actor.userId ||
      !["OPEN_RECRUITMENT", "FULL"].includes(squad.status_squad)) {
    return { success: false, message: "Hanya ketua yang dapat mentransfer kepemimpinan sebelum finalisasi." };
  }

  // The RPC locks the Squad and rechecks both accounts and memberships.
  const { error } = await actor.supabase.rpc("transfer_squad_leadership", {
    p_squad_id: squadId,
    p_new_leader_id: newLeaderId,
  });
  if (error) {
    return {
      success: false,
      message: error.message === "The successor must be an active Student member"
        ? "Calon ketua harus mahasiswa aktif yang masih menjadi anggota Squad."
        : "Transfer belum berhasil. Muat ulang untuk memeriksa ketua, anggota, dan status Squad.",
    };
  }

  revalidatePath(`/squads/${squadId}`);
  revalidatePath("/my-squad");
  revalidatePath(`/missions/${squad.mission_id}`);
  revalidatePath("/");
  return { success: true };
}

export async function sendSquadMessage(
  squadId: string,
  content: string,
): Promise<SendMessageResult> {
  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId)) {
    return { success: false, message: "Squad tidak valid." };
  }

  const text = typeof content === "string" ? content.trim() : "";
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      message: "Pesan wajib diisi dan maksimal 2.000 karakter.",
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, message: "Sesi berakhir. Silakan login kembali." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("squad_id", squadId)
    .eq("user_id", authData.user.id)
    .eq("status_member", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { success: false, message: "Status keanggotaan belum dapat diperiksa." };
  }
  if (!membership) {
    return { success: false, message: "Kamu tidak memiliki akses chat Squad ini." };
  }

  // The database RLS policy checks current account status, active membership,
  // sender identity, and Squad completion again at INSERT time.
  const { error: insertError } = await supabase.from("squad_messages").insert({
    squad_id: squadId,
    sender_id: authData.user.id,
    content: text,
  });

  if (insertError) {
    return {
      success: false,
      message:
        insertError.code === "42501"
          ? "Akses chat ditolak. Muat ulang halaman untuk melihat status Squad."
          : "Pesan belum terkirim. Silakan coba lagi.",
    };
  }

  revalidatePath(`/squads/${squadId}`);
  return { success: true };
}


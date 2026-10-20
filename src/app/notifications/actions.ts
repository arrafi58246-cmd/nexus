"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MarkReadResult = { success: true } | { success: false; message: string };

export async function markNotificationRead(notificationId: string): Promise<MarkReadResult> {
  if (typeof notificationId !== "string" || !UUID_PATTERN.test(notificationId)) {
    return { success: false, message: "Notifikasi tidak valid." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, message: "Silakan login kembali." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("status_akun").eq("user_id", auth.user.id).maybeSingle();
  if (profileError || profile?.status_akun !== "ACTIVE") {
    return { success: false, message: "Akunmu tidak dapat mengubah notifikasi." };
  }

  const { data, error } = await supabase.from("notifications")
    .update({ is_read: true })
    .eq("notification_id", notificationId)
    .eq("user_id", auth.user.id)
    .eq("is_read", false)
    .select("notification_id")
    .maybeSingle();
  if (error) {
    return { success: false, message: "Notifikasi belum dapat ditandai. Muat ulang lalu coba lagi." };
  }
  if (!data) {
    // Another tab may have read it already; still verify ownership before success.
    const existing = await supabase.from("notifications").select("is_read")
      .eq("notification_id", notificationId).eq("user_id", auth.user.id).maybeSingle();
    if (existing.error || existing.data?.is_read !== true) {
      return { success: false, message: "Notifikasi tidak tersedia untuk akunmu." };
    }
  }

  return { success: true };
}

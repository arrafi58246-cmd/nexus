import type { SupabaseClient } from "@supabase/supabase-js";

type LoginResult = { success: true; destination: string }
  | { success: false; message: string };

export async function loginWithProfile(
  supabase: SupabaseClient, email: string, password: string,
): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    return { success: false, message: "Email atau password tidak valid." };
  }

  async function rejectSession(message: string): Promise<LoginResult> {
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
    } catch {
      return { success: false, message: "Sesi belum dapat ditutup. Muat ulang lalu coba lagi." };
    }
    return { success: false, message };
  }

  try {
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("user_id, primary_class_id, role_app, status_akun")
      .eq("user_id", data.user.id).maybeSingle();
    if (profileError) {
      return rejectSession("Profil akun belum dapat dimuat. Silakan coba lagi.");
    }
    // Suspended profiles are hidden by RLS, so a missing row must also sign out.
    if (!profile || profile.status_akun !== "ACTIVE") {
      return rejectSession("Profil tidak tersedia atau akun tidak aktif. Hubungi administrator.");
    }
    if (profile.role_app !== "ADMIN" && profile.role_app !== "STUDENT") {
      return rejectSession("Peran akun tidak tersedia. Hubungi administrator.");
    }
    return { success: true, destination: profile.role_app === "ADMIN"
      ? "/admin" : profile.primary_class_id === null ? "/onboarding" : "/" };
  } catch {
    return rejectSession("Profil akun belum dapat dimuat. Silakan coba lagi.");
  }
}


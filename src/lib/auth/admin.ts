import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Memoized only within a server render; pages must also call this before reading data.
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: admin, error } = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (error || admin?.role_app !== "ADMIN" || admin.status_akun !== "ACTIVE") notFound();

  return { supabase, admin };
});

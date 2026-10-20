import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import NotificationItem from "./NotificationItem";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, status_akun, role_app, primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  const eligible = !profileError && profile?.status_akun === "ACTIVE";
  const { data: notifications, error } = eligible
    ? await supabase.from("notifications")
        .select("notification_id, notification_type, title, body, is_read, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null, error: null };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile?.nama_lengkap ?? "NEXUS"} avatarPath={profile?.foto_profil_path}
        activeItem="notifications" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Notifikasi</h1>
        <p className="mt-2 text-sm text-slate-600">50 notifikasi terbaru untuk akunmu.</p>
        <p className="mt-1 text-xs text-slate-500">Klik notifikasi untuk membuka halaman terkait. Titik merah berarti belum dibaca.</p>
        {!eligible ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
            Notifikasi belum dapat dibuka. Periksa status akun atau coba lagi.
          </p>
        ) : error ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
            Notifikasi belum dapat dimuat. Muat ulang lalu coba lagi.
          </p>
        ) : notifications?.length ? (
          <ul className="mt-6 space-y-3">
            {notifications.map((item) => <NotificationItem key={item.notification_id} item={item} />)}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-600">
            Belum ada notifikasi untuk akunmu.
          </p>
        )}
      </main>
    </div>
  );
}

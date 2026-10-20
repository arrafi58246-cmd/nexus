import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import MissionForm from "./MissionForm";
import type { MissionSubmission } from "./options";
import { validSubmissionId } from "./validation";

export default async function AddMissionPage({ searchParams }: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap,role_app,status_akun,primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }
  if (profileError || profile?.role_app !== "STUDENT" ||
      profile.status_akun !== "ACTIVE") notFound();

  const id = (await searchParams).id;
  if (id !== undefined && (typeof id !== "string" || !validSubmissionId(id))) notFound();
  const { data: initial, error } = id
    ? await supabase.from("mission_submissions").select("*")
        .eq("mission_submission_id", id).eq("submitted_by", auth.user.id)
        .eq("status_review", "REJECTED").maybeSingle()
    : { data: null, error: null };
  if (error || (id && !initial)) notFound();

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="missions" />
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/missions/submissions" className="text-sm font-semibold text-indigo-700">
        ← Pengajuan saya
      </Link>
      <h1 className="mt-5 text-2xl font-bold">{initial ? "Ajukan ulang Mission" : "Tambah Mission"}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Hanya lomba tim. Minimum dan maksimum peserta mengikuti aturan resmi lomba,
        termasuk Ketua Squad.
      </p>
      {initial?.alasan_penolakan && <p role="alert"
        className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Alasan penolakan: {initial.alasan_penolakan}
      </p>}
      <MissionForm initial={initial as MissionSubmission | null} />
    </main>
  </div>;
}

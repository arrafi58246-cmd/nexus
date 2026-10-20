import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import ResultForm from "./ResultForm";
import type { ResultRecord, TierOption, XpRule } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ squadId: string }> };

export default async function MissionResultPage({ params }: Props) {
  const { squadId } = await params;
  if (!UUID_PATTERN.test(squadId)) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");

  const profileResult = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, primary_class_id, foto_profil_path")
    .eq("user_id", authData.user.id).maybeSingle();
  const profile = profileResult.data;
  if (profileResult.error || !profile) notFound();
  if (profile.role_app === "ADMIN") redirect("/admin");
  if (profile.status_akun !== "ACTIVE" || profile.role_app !== "STUDENT") notFound();
  if (profile.primary_class_id === null) redirect("/onboarding");

  const [memberResult, squadResult] = await Promise.all([
    supabase.from("squad_members")
      .select("role_squad")
      .eq("squad_id", squadId).eq("user_id", authData.user.id)
      .eq("status_member", "ACTIVE").maybeSingle(),
    supabase.from("squads")
      .select("nama_squad, mission_id, ketua_id, status_squad")
      .eq("squad_id", squadId).maybeSingle(),
  ]);

  if (memberResult.error || !memberResult.data ||
      squadResult.error || !squadResult.data) notFound();

  const squad = squadResult.data;
  if (!["FINALIZED", "MISSION_COMPLETED"].includes(squad.status_squad)) {
    redirect(`/squads/${squadId}`);
  }
  const isLeader = squad.ketua_id === authData.user.id &&
    memberResult.data.role_squad === "KETUA";

  const [missionResult, resultQuery, tiersQuery, rulesQuery] = await Promise.all([
    supabase.from("missions").select("nama_lomba")
      .eq("mission_id", squad.mission_id).maybeSingle(),
    supabase.from("mission_result_submissions")
      .select("result_submission_id, hasil_kompetisi, submitted_tier_id, approved_tier_id, approved_hasil_kompetisi, preview_xp, approved_xp, status_validation, rejection_reason, submitted_at")
      .eq("squad_id", squadId).maybeSingle(),
    supabase.from("mission_tiers").select("tier_id, kode_tier").order("tier_id"),
    supabase.from("xp_rules")
      .select("tier_id, hasil_kompetisi, verified_xp"),
  ]);

  const loadFailed = missionResult.error || !missionResult.data ||
    resultQuery.error || tiersQuery.error || rulesQuery.error;
  const result = resultQuery.data as ResultRecord | null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="my-squad" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href={squad.status_squad === "MISSION_COMPLETED" ? "/my-squad" : `/squads/${squadId}`}
          className="text-sm font-bold text-indigo-600">
          ← Kembali
        </Link>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
            Validasi Prestasi
          </p>
          <h1 className="mt-2 text-2xl font-bold">Kirim Hasil Mission</h1>
          <p className="mt-3 text-sm text-slate-600">
            {squad.nama_squad} · {missionResult.data?.nama_lomba ?? "Mission"}
          </p>

          {loadFailed ? (
            <p role="alert" className="mt-6 text-sm text-red-700">
              Data hasil belum dapat dimuat. Muat ulang halaman dan coba lagi.
            </p>
          ) : (
            <ResultForm
              squadId={squadId}
              isLeader={isLeader}
              squadStatus={squad.status_squad}
              initialResult={result}
              tiers={(tiersQuery.data ?? []) as TierOption[]}
              rules={(rulesQuery.data ?? []) as XpRule[]}
            />
          )}
        </div>
      </main>
    </div>
  );
}

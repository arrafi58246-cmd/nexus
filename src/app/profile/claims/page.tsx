import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";
import { RESULT_OPTIONS } from "@/app/squads/[squadId]/result/types";
import ClaimForm from "./ClaimForm";
import type { ClaimRecord, ClaimRule, TierOption } from "./types";

type Props = { searchParams: Promise<{ resubmit?: string }> };

export default async function ClaimsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (profileError || profile?.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE") {
    notFound();
  }
  if (profile.primary_class_id === null) redirect("/onboarding");

  const [claimsQuery, tiersQuery, rulesQuery] = await Promise.all([
    supabase.from("achievement_claims")
      .select("achievement_claim_id, nama_kompetisi, penyelenggara, achievement_date, submitted_tier_id, approved_tier_id, hasil_kompetisi, preview_xp, approved_xp, status_validation, rejection_reason, submitted_at, resubmission_count")
      .eq("user_id", auth.user.id).order("submitted_at", { ascending: false }).limit(50),
    supabase.from("mission_tiers").select("tier_id, kode_tier").order("tier_id"),
    supabase.from("xp_rules").select("tier_id, hasil_kompetisi, legacy_xp"),
  ]);
  const failed = claimsQuery.error || tiersQuery.error || rulesQuery.error;
  const claims = (claimsQuery.data ?? []) as ClaimRecord[];
  const tiers = (tiersQuery.data ?? []) as TierOption[];
  const rules = (rulesQuery.data ?? []) as ClaimRule[];
  const { resubmit } = await searchParams;
  const initial = claims.find((claim) => claim.achievement_claim_id === resubmit &&
    claim.status_validation === "REJECTED") ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="text-sm font-bold text-indigo-700">← Profil Saya</Link>
        <h1 className="mt-5 text-2xl font-bold">Klaim Prestasi</h1>
        <p className="mt-2 text-sm text-slate-600">Untuk kompetisi di luar Squad NEXUS,
          termasuk lomba individu. Admin memeriksa sertifikat sebelum Legacy XP diberikan.</p>
        {failed ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">
            Data klaim belum dapat dimuat. Coba lagi nanti.
          </p>
        ) : (
          <>
            <h2 className="mt-8 text-lg font-bold">{initial ? "Perbaiki klaim ditolak" : "Kirim klaim baru"}</h2>
            <ClaimForm key={initial?.achievement_claim_id ?? "new"}
              initial={initial} tiers={tiers} rules={rules} />
            <h2 className="mt-10 text-lg font-bold">Riwayat klaim</h2>
            {claims.length ? (
              <ul className="mt-3 space-y-3">
                {claims.map((claim) => (
                  <li key={claim.achievement_claim_id}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <h3 className="font-bold">{claim.nama_kompetisi}</h3>
                    <p className="mt-1 text-slate-600">{claim.penyelenggara} · {claim.achievement_date}</p>
                    <p className="mt-1">{RESULT_OPTIONS.find((item) => item.value ===
                      claim.hasil_kompetisi)?.label ?? claim.hasil_kompetisi} · {claim.status_validation}</p>
                    {claim.status_validation === "APPROVED" ? (
                      <p className="mt-1 font-semibold text-emerald-700">
                        Legacy XP disetujui: +{claim.approved_xp ?? 0}
                      </p>
                    ) : claim.status_validation === "REJECTED" ? (
                      <div className="mt-2 text-red-700">
                        <p>Alasan: {claim.rejection_reason}</p>
                        <Link href={`/profile/claims?resubmit=${claim.achievement_claim_id}`}
                          className="mt-2 inline-block font-semibold underline">Perbaiki dan kirim ulang</Link>
                      </div>
                    ) : <p className="mt-1 text-amber-700">
                      Preview +{claim.preview_xp} XP; menunggu keputusan admin.</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-600">Belum ada klaim.</p>}
          </>
        )}
      </main>
    </div>
  );
}

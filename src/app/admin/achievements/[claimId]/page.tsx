import Link from "next/link";
import { notFound } from "next/navigation";

import type { ClaimRule, TierOption } from "@/app/profile/claims/types";
import { RESULT_OPTIONS, type CompetitionResult } from "@/app/squads/[squadId]/result/types";
import { requireAdmin } from "@/lib/auth/admin";
import ReviewForm from "./ReviewForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Props = { params: Promise<{ claimId: string }> };

export default async function AchievementDetailPage({ params }: Props) {
  const { claimId } = await params;
  if (!UUID.test(claimId)) notFound();
  const { supabase } = await requireAdmin();

  const { data: claim, error: claimError } = await supabase.from("achievement_claims")
    .select("achievement_claim_id, user_id, nama_kompetisi, penyelenggara, achievement_date, submitted_tier_id, approved_tier_id, hasil_kompetisi, preview_xp, approved_xp, status_validation, sertifikat_path, rejection_reason, submitted_at")
    .eq("achievement_claim_id", claimId).maybeSingle();
  if (claimError || !claim) notFound();
  const [studentQuery, tiersQuery, rulesQuery, certificate] = await Promise.all([
    supabase.from("profiles").select("nama_lengkap").eq("user_id", claim.user_id).maybeSingle(),
    supabase.from("mission_tiers").select("tier_id, kode_tier").order("tier_id"),
    supabase.from("xp_rules").select("tier_id, hasil_kompetisi, legacy_xp"),
    supabase.storage.from("achievement-certificates")
      .createSignedUrl(claim.sertifikat_path, 300),
  ]);
  const failed = studentQuery.error || tiersQuery.error || rulesQuery.error;
  const tiers = (tiersQuery.data ?? []) as TierOption[];
  const rules = (rulesQuery.data ?? []) as ClaimRule[];
  const submittedTier = tiers.find((tier) => tier.tier_id === claim.submitted_tier_id);
  const approvedTier = tiers.find((tier) => tier.tier_id === claim.approved_tier_id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin/achievements" className="text-sm font-semibold text-indigo-700">
          ← Daftar klaim
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Periksa Klaim Prestasi</h1>
        {failed ? <p role="alert" className="mt-5 text-red-700">Data belum dapat dimuat.</p> : (
          <>
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">{claim.nama_kompetisi}</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Mahasiswa</dt>
                  <dd>{studentQuery.data?.nama_lengkap ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Penyelenggara</dt>
                  <dd>{claim.penyelenggara}</dd></div>
                <div><dt className="text-slate-500">Tanggal prestasi</dt>
                  <dd>{claim.achievement_date}</dd></div>
                <div><dt className="text-slate-500">Diajukan</dt>
                  <dd>{new Date(claim.submitted_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</dd></div>
                <div><dt className="text-slate-500">Hasil</dt>
                  <dd>{RESULT_OPTIONS.find((item) => item.value === claim.hasil_kompetisi)?.label}</dd></div>
                <div><dt className="text-slate-500">Tier diajukan</dt>
                  <dd>{submittedTier?.kode_tier ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Preview Legacy XP</dt>
                  <dd>+{claim.preview_xp}</dd></div>
                <div><dt className="text-slate-500">Status</dt>
                  <dd>{claim.status_validation}</dd></div>
              </dl>
              {certificate.data?.signedUrl && !certificate.error ? (
                <a href={certificate.data.signedUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-5 inline-block font-semibold text-indigo-700 underline">
                  Lihat sertifikat privat
                </a>
              ) : <p role="alert" className="mt-5 text-red-700">
                Sertifikat tidak dapat dibuka. Jangan ambil keputusan sebelum bukti tersedia.
              </p>}
            </section>
            {claim.status_validation === "PENDING" && certificate.data?.signedUrl &&
              !certificate.error ? (
                <ReviewForm claimId={claimId} submittedTierId={claim.submitted_tier_id}
                  result={claim.hasil_kompetisi as CompetitionResult}
                  tiers={tiers} rules={rules} />
              ) : claim.status_validation === "APPROVED" ? (
                <p className="mt-5 text-sm text-emerald-700">
                  Disetujui: {approvedTier?.kode_tier ?? "—"} · +{claim.approved_xp ?? 0} Legacy XP.
                </p>
              ) : claim.status_validation === "REJECTED" ? (
                <p className="mt-5 text-sm text-red-700">Ditolak: {claim.rejection_reason}</p>
              ) : null}
          </>
        )}
      </main>
    </div>
  );
}


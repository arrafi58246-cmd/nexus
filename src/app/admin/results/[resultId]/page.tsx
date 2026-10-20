import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { RESULT_BUCKET } from "@/app/squads/[squadId]/result/file-validation";
import { RESULT_OPTIONS, type CompetitionResult, type TierOption, type XpRule }
  from "@/app/squads/[squadId]/result/types";

import ReviewForm from "./ReviewForm";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ resultId: string }> };

export default async function AdminResultDetailPage({ params }: Props) {
  const { resultId } = await params;
  if (!UUID_PATTERN.test(resultId)) notFound();

  const { supabase } = await requireAdmin();

  const { data: result, error: resultError } = await supabase
    .from("mission_result_submissions")
    .select("result_submission_id, squad_id, hasil_kompetisi, submitted_tier_id, approved_hasil_kompetisi, approved_tier_id, preview_xp, approved_xp, sertifikat_path, dokumen_pendukung_path, status_validation, rejection_reason, submitted_at")
    .eq("result_submission_id", resultId).maybeSingle();
  if (resultError || !result) notFound();

  const [squadQuery, tiersQuery, rulesQuery, memberQuery] = await Promise.all([
    supabase.from("squads").select("mission_id, nama_squad, status_squad")
      .eq("squad_id", result.squad_id).maybeSingle(),
    supabase.from("mission_tiers").select("tier_id, kode_tier").order("tier_id"),
    supabase.from("xp_rules").select("tier_id, hasil_kompetisi, verified_xp"),
    supabase.from("squad_members").select("squad_member_id", { count: "exact", head: true })
      .eq("squad_id", result.squad_id).eq("status_member", "ACTIVE"),
  ]);
  const squad = squadQuery.data;
  if (!squad || squadQuery.error || tiersQuery.error || rulesQuery.error || memberQuery.error) {
    notFound();
  }
  const { data: mission } = await supabase.from("missions")
    .select("nama_lomba").eq("mission_id", squad.mission_id).maybeSingle();

  const storage = supabase.storage.from(RESULT_BUCKET);
  const [certificate, supporting] = await Promise.all([
    storage.createSignedUrl(result.sertifikat_path, 300),
    result.dokumen_pendukung_path
      ? storage.createSignedUrl(result.dokumen_pendukung_path, 300)
      : Promise.resolve(null),
  ]);
  const tiers = (tiersQuery.data ?? []) as TierOption[];
  const rules = (rulesQuery.data ?? []) as XpRule[];
  const submittedTier = tiers.find((tier) => tier.tier_id === result.submitted_tier_id);
  const submittedResult = RESULT_OPTIONS.find((option) =>
    option.value === result.hasil_kompetisi)?.label ?? result.hasil_kompetisi;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin/results" className="text-sm font-bold text-indigo-600">
          ← Daftar review
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Periksa Hasil Mission</h1>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">{squad.nama_squad}</h2>
          <p className="mt-1 text-sm text-slate-600">{mission?.nama_lomba ?? "Mission"}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Status</dt>
              <dd className="font-semibold">{result.status_validation}</dd></div>
            <div><dt className="text-slate-500">Diajukan</dt>
              <dd>{new Date(result.submitted_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</dd></div>
            <div><dt className="text-slate-500">Hasil pengajuan</dt>
              <dd>{submittedResult}</dd></div>
            <div><dt className="text-slate-500">Tier pengajuan</dt>
              <dd>{submittedTier?.kode_tier ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Preview XP</dt>
              <dd>{result.preview_xp} per anggota aktif</dd></div>
            <div><dt className="text-slate-500">Anggota aktif</dt>
              <dd>{memberQuery.count ?? "—"}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
            {certificate.data?.signedUrl && !certificate.error
              ? <a href={certificate.data.signedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-700 underline">Lihat sertifikat</a>
              : <span className="text-red-700">Sertifikat tidak tersedia</span>}
            {result.dokumen_pendukung_path && (supporting?.data?.signedUrl && !supporting.error
              ? <a href={supporting.data.signedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-700 underline">Lihat dokumen pendukung</a>
              : <span className="text-red-700">Dokumen pendukung tidak tersedia</span>)}
          </div>
        </section>
        {result.status_validation === "PENDING" && squad.status_squad === "FINALIZED" ? (
          certificate.error || !certificate.data?.signedUrl ||
          (result.dokumen_pendukung_path && (!supporting?.data?.signedUrl || supporting.error)) ? (
            <p role="alert" className="mt-6 text-sm text-red-700">
              Bukti belum bisa dibuka. Periksa Storage sebelum mengambil keputusan.
            </p>
          ) : <ReviewForm resultId={resultId}
              submittedTierId={result.submitted_tier_id}
              submittedResult={result.hasil_kompetisi as CompetitionResult}
              tiers={tiers} rules={rules} />
        ) : (
          <p className="mt-6 rounded-xl bg-white p-4 text-sm text-slate-600">
            Pengajuan tidak menunggu review. {result.rejection_reason ?? ""}
            {result.status_validation === "APPROVED" &&
              ` Hasil final: ${RESULT_OPTIONS.find((option) => option.value ===
                (result.approved_hasil_kompetisi ?? result.hasil_kompetisi))?.label ?? "—"},
                ${tiers.find((tier) => tier.tier_id === result.approved_tier_id)?.kode_tier ?? "—"},
                ${result.approved_xp ?? 0} XP.`}
          </p>
        )}
      </main>
    </div>
  );
}


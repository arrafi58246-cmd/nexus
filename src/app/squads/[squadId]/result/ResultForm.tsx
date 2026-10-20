"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { submitWithUploads } from "@/lib/uploads/submit-with-uploads";

import {
  RESULT_OPTIONS,
  type CompetitionResult,
  type ResultRecord,
  type TierOption,
  type XpRule,
} from "./types";

type Props = {
  squadId: string;
  isLeader: boolean;
  squadStatus: string;
  initialResult: ResultRecord | null;
  tiers: TierOption[];
  rules: XpRule[];
};

const MAX_FILE_BYTES = 5_000_000;

export default function ResultForm({
  squadId,
  isLeader,
  squadStatus,
  initialResult,
  tiers,
  rules,
}: Props) {
  const router = useRouter();
  const [result, setResult] = useState<CompetitionResult>(
    initialResult?.hasil_kompetisi ?? "PARTICIPANT",
  );
  const [tierId, setTierId] = useState(
    String(initialResult?.submitted_tier_id ?? tiers[0]?.tier_id ?? ""),
  );
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const rule = rules.find((item) =>
    item.tier_id === Number(tierId) && item.hasil_kompetisi === result
  );
  const tierLabel = tiers.find((item) => item.tier_id === Number(tierId))?.kode_tier;
  const resultLabel = RESULT_OPTIONS.find((item) => item.value === result)?.label;
  const canSubmit = isLeader && squadStatus === "FINALIZED" &&
    (!initialResult || initialResult.status_validation === "REJECTED") && !submitted;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canSubmit) return;

    const data = new FormData(event.currentTarget);
    const certificate = data.get("sertifikat");
    const supporting = data.get("dokumen_pendukung");
    for (const file of [certificate, supporting]) {
      if (file instanceof File && file.size > MAX_FILE_BYTES) {
        setError("Setiap file maksimal 5 MB.");
        return;
      }
    }
    if (!rule || !(certificate instanceof File) || certificate.size === 0) {
      setError("Pilih hasil, tier, dan sertifikat tim yang valid.");
      return;
    }
    if (!window.confirm("Kirim hasil ini untuk diverifikasi admin?")) return;

    setPending(true);
    setError("");
    try {
      const response = await submitWithUploads(`/api/squads/${squadId}/result`, data,
        "mission-result-certificates", ["sertifikat", "dokumen_pendukung"], squadId);
      const payload: { success?: boolean; message?: string } = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "Hasil belum terkirim. Coba lagi.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Periksa jaringan lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
      Hasil terkirim dan menunggu verifikasi admin.
    </p>;
  }

  if (initialResult?.status_validation === "PENDING") {
    return (
      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-bold">Menunggu verifikasi admin</p>
        <p className="mt-2">
          {RESULT_OPTIONS.find((item) => item.value === initialResult.hasil_kompetisi)?.label}
          {" · "}Preview +{initialResult.preview_xp} XP per anggota aktif yang berhak.
        </p>
        <p className="mt-1">Sertifikat tim telah diunggah. XP belum diberikan.</p>
      </div>
    );
  }

  if (initialResult?.status_validation === "APPROVED") {
    const finalResult = initialResult.approved_hasil_kompetisi ?? initialResult.hasil_kompetisi;
    const finalTier = tiers.find((tier) => tier.tier_id === initialResult.approved_tier_id);
    return (
      <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-bold">Hasil disetujui · Mission selesai</p>
        <p className="mt-2">{RESULT_OPTIONS.find((option) => option.value === finalResult)?.label}
          {" · "}Tier {finalTier?.kode_tier ?? "—"}</p>
        <p className="mt-2">XP disetujui: +{initialResult.approved_xp ?? 0} per anggota yang berhak.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {initialResult?.status_validation === "REJECTED" && (
        <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">Hasil ditolak. Perbaiki dan kirim ulang.</p>
          <p className="mt-1">{initialResult.rejection_reason}</p>
        </div>
      )}
      {!canSubmit ? (
        <p className="text-sm text-slate-600">
          Hanya Ketua Squad yang sudah Finalized dapat mengirim hasil.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="hasil" className="block text-sm font-semibold">Pencapaian tim</label>
            <select id="hasil" name="hasil_kompetisi" required value={result}
              onChange={(event) => setResult(event.target.value as CompetitionResult)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              {RESULT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tier" className="block text-sm font-semibold">Tier yang diajukan</label>
            <select id="tier" name="submitted_tier_id" required value={tierId}
              onChange={(event) => setTierId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              {tiers.map((tier) => (
                <option value={tier.tier_id} key={tier.tier_id}>{tier.kode_tier}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="certificate" className="block text-sm font-semibold">
              Sertifikat tim (wajib)
            </label>
            <input id="certificate" name="sertifikat" type="file" required
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="mt-2 block w-full text-sm" />
          </div>
          <div>
            <label htmlFor="supporting" className="block text-sm font-semibold">
              Dokumen pendukung (opsional, maksimal satu)
            </label>
            <input id="supporting" name="dokumen_pendukung" type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="mt-2 block w-full text-sm" />
          </div>
          <p className="text-xs text-slate-600">
            Format PDF/JPG/PNG, maksimal 5 MB per file.
          </p>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
            <p className="font-bold text-indigo-900">Preview Verified Mission XP</p>
            <p className="mt-1 text-indigo-800">
              Tier {tierLabel ?? "—"} · {resultLabel ?? "—"} · nilai penuh 100%
            </p>
            <p className="mt-1 font-semibold text-indigo-900">
              {rule ? `+${rule.verified_xp} XP per anggota aktif yang berhak` : "Aturan XP belum tersedia"}
            </p>
            <p className="mt-1 text-xs text-indigo-700">
              XP diberikan setelah admin menyetujui hasil.
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending || !rule}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Mengirim..." : initialResult ? "Kirim ulang hasil" : "Kirim hasil"}
          </button>
        </form>
      )}
    </div>
  );
}

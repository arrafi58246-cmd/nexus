"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RESULT_OPTIONS, type CompetitionResult, type TierOption, type XpRule }
  from "@/app/squads/[squadId]/result/types";
import { reviewMissionResult } from "../actions";

type Props = {
  resultId: string;
  submittedTierId: number;
  submittedResult: CompetitionResult;
  tiers: TierOption[];
  rules: XpRule[];
};

export default function ReviewForm({
  resultId, submittedTierId, submittedResult, tiers, rules,
}: Props) {
  const router = useRouter();
  const [tierId, setTierId] = useState(String(submittedTierId));
  const [result, setResult] = useState<CompetitionResult>(submittedResult);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const xp = rules.find((rule) =>
    rule.tier_id === Number(tierId) && rule.hasil_kompetisi === result)?.verified_xp;

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (pending || finished) return;
    if (decision === "APPROVED" && (xp === undefined || !Number.isSafeInteger(Number(tierId)))) {
      setError("Pilih tier dan hasil dengan aturan XP yang tersedia.");
      return;
    }
    if (decision === "REJECTED" && (!reason.trim() || reason.length > 1000)) {
      setError("Isi alasan penolakan, maksimal 1000 karakter.");
      return;
    }
    if (!window.confirm(decision === "APPROVED"
      ? `Setujui hasil ini dan berikan ${xp} XP kepada setiap anggota aktif?`
      : "Tolak hasil ini dan kirim alasan kepada Squad?")) return;

    setPending(true);
    setError("");
    try {
      const response = await reviewMissionResult(
        resultId,
        decision,
        decision === "APPROVED" ? Number(tierId) : null,
        decision === "APPROVED" ? result : null,
        decision === "REJECTED" ? reason : null,
      );
      if (!response.success) {
        setError(response.message);
        return;
      }
      setFinished(true);
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Muat ulang sebelum mencoba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (finished) return (
    <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
      Keputusan tersimpan. Daftar review sedang diperbarui.
    </p>
  );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Keputusan admin</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Hasil yang disetujui
          <select value={result} onChange={(event) =>
            setResult(event.target.value as CompetitionResult)}
            disabled={pending} className="mt-2 block w-full rounded-lg border border-slate-300 p-2">
            {RESULT_OPTIONS.map((option) =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Tier yang disetujui
          <select value={tierId} onChange={(event) => setTierId(event.target.value)}
            disabled={pending} className="mt-2 block w-full rounded-lg border border-slate-300 p-2">
            {tiers.map((tier) =>
              <option key={tier.tier_id} value={tier.tier_id}>{tier.kode_tier}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm text-indigo-800">
        {xp === undefined ? "Aturan XP tidak tersedia." :
          `XP final: ${xp} per anggota aktif yang berhak.`}
      </p>
      <button type="button" disabled={pending || xp === undefined}
        onClick={() => decide("APPROVED")}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {pending ? "Memproses..." : "Setujui hasil"}
      </button>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <label htmlFor="rejection-reason" className="text-sm font-semibold">
          Alasan jika ditolak
        </label>
        <textarea id="rejection-reason" value={reason} maxLength={1000} rows={3}
          onChange={(event) => setReason(event.target.value)} disabled={pending}
          className="mt-2 block w-full rounded-lg border border-slate-300 p-2" />
        <button type="button" disabled={pending || !reason.trim()}
          onClick={() => decide("REJECTED")}
          className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">
          {pending ? "Memproses..." : "Tolak hasil"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ClaimRule, TierOption } from "@/app/profile/claims/types";
import type { CompetitionResult } from "@/app/squads/[squadId]/result/types";
import { reviewAchievement } from "../actions";

type Props = {
  claimId: string;
  submittedTierId: number;
  result: CompetitionResult;
  tiers: TierOption[];
  rules: ClaimRule[];
};

export default function ReviewForm({ claimId, submittedTierId, result, tiers, rules }: Props) {
  const router = useRouter();
  const [tier, setTier] = useState(String(submittedTierId));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const xp = rules.find((rule) => rule.tier_id === Number(tier) &&
    rule.hasil_kompetisi === result)?.legacy_xp;

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (pending || finished) return;
    if (decision === "APPROVED" && xp === undefined) {
      setError("Pilih tier dengan aturan XP yang tersedia.");
      return;
    }
    if (decision === "REJECTED" && (!reason.trim() || reason.length > 1000)) {
      setError("Isi alasan penolakan, maksimal 1000 karakter.");
      return;
    }
    if (!window.confirm(decision === "APPROVED"
      ? `Setujui klaim dan berikan ${xp} Legacy XP?`
      : "Tolak klaim dan kirim alasan kepada mahasiswa?")) return;
    setPending(true);
    setError("");
    try {
      const response = await reviewAchievement(claimId, decision,
        decision === "APPROVED" ? Number(tier) : null,
        decision === "REJECTED" ? reason : null);
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

  if (finished) return <p role="status" className="mt-6 text-emerald-700">
    Keputusan tersimpan. Daftar review sedang diperbarui.
  </p>;
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Keputusan admin</h2>
      <label className="mt-4 block text-sm font-semibold">Tier yang disetujui
        <select value={tier} onChange={(event) => setTier(event.target.value)}
          disabled={pending} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
          {tiers.map((item) => <option key={item.tier_id} value={item.tier_id}>
            {item.kode_tier}</option>)}
        </select>
      </label>
      <p className="mt-3 text-sm">Legacy XP final: {xp ?? "—"}</p>
      <button type="button" disabled={pending || xp === undefined}
        onClick={() => decide("APPROVED")}
        className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
        Setujui
      </button>
      <label className="mt-6 block border-t border-slate-200 pt-4 text-sm font-semibold">
        Alasan penolakan
        <textarea value={reason} onChange={(event) => setReason(event.target.value)}
          maxLength={1000} rows={3} disabled={pending}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <button type="button" disabled={pending || !reason.trim()}
        onClick={() => decide("REJECTED")}
        className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50">
        Tolak
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </section>
  );
}

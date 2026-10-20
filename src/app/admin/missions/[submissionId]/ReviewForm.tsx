"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { reviewMission } from "../actions";

export default function ReviewForm({ submissionId, tiers, min, max, canApprove }: {
  submissionId: string;
  tiers: { tier_id: number; kode_tier: string }[];
  min: number | null;
  max: number | null;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [tierId, setTierId] = useState(String(tiers[0]?.tier_id ?? ""));
  const [minimum, setMinimum] = useState(min === null ? "" : String(min));
  const [maximum, setMaximum] = useState(max === null ? "" : String(max));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(decision: "APPROVED" | "REJECTED") {
    if (pending) return;
    if (decision === "APPROVED" &&
        (!minimum || !maximum || !Number.isInteger(Number(minimum)) ||
         Number(minimum) < 2 || !Number.isInteger(Number(maximum)) ||
         Number(maximum) < Number(minimum))) {
      setError("Periksa minimum dan maksimum peserta resmi, termasuk Ketua.");
      return;
    }
    if (decision === "REJECTED" && !reason.trim()) {
      setError("Isi alasan penolakan.");
      return;
    }
    if (!window.confirm(decision === "APPROVED"
      ? "Setujui Mission dan terbitkan di Discovery?" : "Tolak pengajuan ini?")) return;
    setPending(true);
    setError("");
    try {
      const result = await reviewMission(submissionId, decision,
        decision === "APPROVED" ? Number(tierId) : null,
        decision === "REJECTED" ? reason : null,
        decision === "APPROVED" ? Number(minimum) : null,
        decision === "APPROVED" ? Number(maximum) : null);
      if (!result.success) { setError(result.message); return; }
      router.refresh();
    } catch { setError("Keputusan belum tersimpan. Coba lagi."); }
    finally { setPending(false); }
  }

  return <section className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold">Keputusan admin</h2>
    <label className="block text-sm font-semibold">Tier final
      <select value={tierId} onChange={(event) => setTierId(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
        {tiers.map((tier) => <option key={tier.tier_id} value={tier.tier_id}>
          {tier.kode_tier}</option>)}
      </select>
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Minimum peserta resmi
        <input type="number" min={2} max={32767} value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Maksimum peserta resmi
        <input type="number" min={2} max={32767} value={maximum}
          onChange={(event) => setMaximum(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
    </div>
    <p className="text-xs text-slate-600">Pastikan rentang sesuai aturan resmi lomba.
      Tier akhir ditentukan admin. Persetujuan membuat Mission dan mengirim notifikasi.</p>
    <button type="button" disabled={pending || !tierId || !canApprove} onClick={() => submit("APPROVED")}
      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
      {pending ? "Menyimpan..." : "Setujui"}
    </button>
    <label className="block text-sm font-semibold">Alasan penolakan
      <textarea value={reason} onChange={(event) => setReason(event.target.value)}
        maxLength={1000} rows={3}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
    </label>
    <button type="button" disabled={pending} onClick={() => submit("REJECTED")}
      className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50">
      Tolak dengan alasan
    </button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { submitWithUploads } from "@/lib/uploads/submit-with-uploads";

import { RESULT_OPTIONS, type CompetitionResult } from "@/app/squads/[squadId]/result/types";
import type { ClaimRecord, ClaimRule, TierOption } from "./types";

type Props = { initial: ClaimRecord | null; tiers: TierOption[]; rules: ClaimRule[] };

export default function ClaimForm({ initial, tiers, rules }: Props) {
  const router = useRouter();
  const [tier, setTier] = useState(String(initial?.submitted_tier_id ?? tiers[0]?.tier_id ?? ""));
  const [result, setResult] = useState<CompetitionResult>(initial?.hasil_kompetisi ?? "PARTICIPANT");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const rule = rules.find((item) => item.tier_id === Number(tier) &&
    item.hasil_kompetisi === result);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("sertifikat");
    if (!rule || !(file instanceof File) || file.size < 1 || file.size > 5_000_000) {
      setError("Pilih tier, hasil, dan sertifikat PDF/JPG/PNG maksimal 5 MB.");
      return;
    }
    if (!window.confirm("Kirim klaim prestasi ini untuk diperiksa admin?")) return;
    setPending(true);
    setError("");
    try {
      const response = await submitWithUploads("/api/achievement-claims", form,
        "achievement-certificates", ["sertifikat"], initial?.achievement_claim_id);
      const payload: { success?: boolean; message?: string } = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "Klaim belum terkirim. Coba lagi.");
        return;
      }
      router.replace("/profile/claims");
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi setelah memeriksa jaringan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {initial && <input type="hidden" name="claim_id" value={initial.achievement_claim_id} />}
      <label className="block text-sm font-semibold">Nama kompetisi
        <input name="nama_kompetisi" required maxLength={200} defaultValue={initial?.nama_kompetisi}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Penyelenggara
        <input name="penyelenggara" required maxLength={200} defaultValue={initial?.penyelenggara}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Tanggal prestasi
        <input name="achievement_date" type="date" required
          defaultValue={initial?.achievement_date}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Tier pengajuan
          <select name="submitted_tier_id" required value={tier}
            onChange={(event) => setTier(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
            {tiers.map((item) => <option key={item.tier_id} value={item.tier_id}>
              {item.kode_tier}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Pencapaian
          <select name="hasil_kompetisi" required value={result}
            onChange={(event) => setResult(event.target.value as CompetitionResult)}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
            {RESULT_OPTIONS.map((item) => <option key={item.value} value={item.value}>
              {item.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold">Sertifikat baru (wajib)
        <input name="sertifikat" type="file" required
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="mt-1 block w-full text-sm" />
      </label>
      <p className="text-sm text-slate-600">Klaim untuk kompetisi di luar Squad NEXUS,
        termasuk lomba individu. PDF/JPG/PNG maksimal 5 MB.</p>
      <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
        Preview Legacy XP (50% Verified): <strong>{rule ? `+${rule.legacy_xp}` : "—"}</strong>.
        XP baru diberikan setelah disetujui admin.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || !rule}
          className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? "Mengirim..." : initial ? "Kirim ulang" : "Kirim klaim"}
        </button>
        <Link href="/profile/claims" className="text-sm font-semibold text-slate-600">Batal</Link>
      </div>
    </form>
  );
}

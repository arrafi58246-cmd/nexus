"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { disbandSoloSquad } from "./disband-actions";

export default function DisbandSquadButton({ squadId }: { squadId: string }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function disband() {
    if (submitting.current || !window.confirm(
      "Bubarkan Squad ini? Semua lamaran Pending dibatalkan dan pelamar diberi notifikasi. Riwayat tetap disimpan.",
    )) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await disbandSoloSquad(squadId);
      if (!result.success) { setError(result.message); return; }
      router.replace("/my-squad");
      router.refresh();
    } catch { setError("Pembubaran belum berhasil. Muat ulang lalu coba lagi."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <section className="rounded-2xl border border-red-600/30 bg-white p-5">
    <h2 className="text-lg font-bold">Bubarkan Squad</h2>
    <p className="my-3 text-sm text-slate-600">Kamu masih satu-satunya anggota aktif. Pembubaran mengakhiri keanggotaanmu; riwayat Squad tetap disimpan.</p>
    <button type="button" disabled={pending} onClick={disband}
      className="rounded-xl border border-red-600 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">
      {pending ? "Membubarkan..." : "Bubarkan Squad"}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}

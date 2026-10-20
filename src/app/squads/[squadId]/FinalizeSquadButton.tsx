"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { finalizeSquad } from "./actions";

type FinalizeSquadButtonProps = {
  squadId: string;
  activeCount: number;
  minimumCount: number | null;
};

export default function FinalizeSquadButton({
  squadId,
  activeCount,
  minimumCount,
}: FinalizeSquadButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = minimumCount !== null && activeCount >= minimumCount;

  async function run() {
    if (!eligible || pending) return;
    if (!window.confirm(
      "Finalisasi Squad sekarang? Perekrutan serta aksi keluar/keluarkan akan terkunci. Lamaran Pending tetap tersimpan.",
    )) return;

    setPending(true);
    setError(null);
    try {
      const result = await finalizeSquad(squadId);
      if (!result.success) {
        setError(result.message);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Finalisasi belum berhasil. Silakan muat ulang lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={!eligible || pending}
        onClick={run}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "Memproses..." : "Finalisasi Squad"}
      </button>
      {!eligible && (
        <p className="mt-2 text-xs text-slate-600">
          {minimumCount === null
            ? "Minimum anggota Mission belum ditetapkan."
            : `Butuh minimal ${minimumCount} anggota aktif; saat ini ${activeCount}.`}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

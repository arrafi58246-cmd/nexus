"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { transferSquadLeadership } from "./actions";

type TransferLeadershipButtonProps = {
  squadId: string;
  memberUserId: string;
  memberName: string;
};

export default function TransferLeadershipButton({
  squadId,
  memberUserId,
  memberName,
}: TransferLeadershipButtonProps) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transfer() {
    if (submitting.current) return;
    if (!window.confirm(
      `Jadikan ${memberName} ketua Squad? Kamu tetap menjadi anggota dan dapat memilih Keluar Squad setelah transfer berhasil.`,
    )) return;

    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await transferSquadLeadership(squadId, memberUserId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("Transfer belum berhasil. Muat ulang lalu coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={transfer}
        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Mentransfer..." : "Jadikan Ketua"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

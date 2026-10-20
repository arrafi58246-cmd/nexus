"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { kickSquadMember, leaveSquad } from "./actions";

type MembershipActionsProps = {
  squadId: string;
  memberUserId?: string;
  memberName?: string;
};

export default function MembershipActions({
  squadId,
  memberUserId,
  memberName,
}: MembershipActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isKick = Boolean(memberUserId);

  async function run() {
    const message = isKick
      ? `Keluarkan ${memberName ?? "anggota ini"} dari Squad?`
      : "Keluar dari Squad ini? Riwayat keanggotaanmu tetap tersimpan.";
    if (!window.confirm(message)) return;

    setPending(true);
    setError(null);
    try {
      const result = memberUserId
        ? await kickSquadMember(squadId, memberUserId)
        : await leaveSquad(squadId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      if (memberUserId) router.refresh();
      else router.replace("/my-squad");
    } catch {
      setError("Aksi belum berhasil. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Memproses..." : isKick ? "Keluarkan" : "Keluar Squad"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

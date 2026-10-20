"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { equipBadge } from "./actions";

export default function EquipBadgeButton({ userBadgeId }: { userBadgeId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();

  async function handleClick() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await equipBadge(userBadgeId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("Badge belum berhasil dipasang. Coba lagi.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="chest-equip">
      <button type="button" onClick={handleClick} disabled={pending}
        className="chest-equip-btn">
        {pending ? "Memasang…" : "Pasang di profil"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

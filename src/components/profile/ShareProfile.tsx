"use client";

import { useState, useSyncExternalStore } from "react";

const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

/** "Bagikan Profil" button: copies the profile link; recipients still need an active NEXUS login. */
export default function ShareProfile({ userId }: { userId: string }) {
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const link = `${origin}/profile/${userId}`;

  async function copyLink() {
    if (!origin || status === "copying") return;
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" onClick={copyLink} disabled={!origin || status === "copying"}
        title="Penerima perlu login ke akun NEXUS yang aktif untuk melihat profilmu."
        className="profile-action">
        {status === "copying" ? "Menyalin…" : "Bagikan Profil"}
      </button>
      <span role="status" aria-live="polite" className="profile-action-status">
        {status === "copied" ? "Link profil disalin."
          : status === "error" ? <>Salin manual: <input readOnly value={link} aria-label="Link profil"
              onFocus={(event) => event.currentTarget.select()} /></>
          : ""}
      </span>
    </>
  );
}

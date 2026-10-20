"use client";

import { useRef, useState, useTransition } from "react";
import { logout } from "@/lib/auth/logout-actions";

export default function LogoutButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const submitting = useRef(false);

  function handleLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await logout();
        if (result.success) {
          // A full navigation drops cached private UI and current Realtime connections.
          window.location.replace("/login");
          return;
        }
        setError(result.message || "Belum berhasil keluar. Silakan coba lagi.");
      } catch {
        setError("Belum berhasil keluar. Periksa koneksi dan coba lagi.");
      }
      submitting.current = false;
    });
  }

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={handleLogout} disabled={pending}
        aria-label="Keluar dari akun" aria-busy={pending} className="nexus-admin-shortcut disabled:opacity-60">
        {pending ? "Keluar…" : "Keluar"}
      </button>
      {error && <p role="alert" className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-red-700 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}

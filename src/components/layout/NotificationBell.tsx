"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NotificationBell({ count, current }: { count: number; current: boolean }) {
  const router = useRouter();

  // Re-fetch the server-rendered badge when the user returns to this tab.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const label = count > 0 ? `Notifikasi, ${count} belum dibaca` : "Notifikasi";
  return (
    <Link href="/notifications" aria-label={label} title="Notifikasi"
      aria-current={current ? "page" : undefined} className="nexus-bell rounded-full p-2">
      <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3a1 1 0 0 1 1 1v.1a6 6 0 0 1 5 5.9v4l2 3H4l2-3v-4a6 6 0 0 1 5-5.9V4a1 1 0 0 1 1-1Zm-2 16h4a2 2 0 0 1-4 0Z" />
      </svg>
      {count > 0 && <span className="nexus-badge" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}

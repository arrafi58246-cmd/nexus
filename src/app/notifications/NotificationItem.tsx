"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { notificationHref } from "@/lib/notifications";
import { markNotificationRead } from "./actions";

export type Notification = {
  notification_id: string;
  notification_type?: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationItem({ item }: { item: Notification }) {
  const router = useRouter();
  const [read, setRead] = useState(item.is_read);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const href = notificationHref(item.notification_type);

  async function markRead(): Promise<boolean> {
    if (read) return true;
    try {
      const result = await markNotificationRead(item.notification_id);
      if (result.success) { setRead(true); return true; }
      setError(result.message);
    } catch {
      setError("Status baca belum tersimpan. Coba lagi.");
    }
    return false;
  }

  async function open(event: React.MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // keep "open in new tab"
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError("");
    await markRead();
    busy.current = false;
    if (href) router.push(href);
    router.refresh(); // update the navbar badge
  }

  const content = <>
    <span className="inline-flex items-center gap-3 font-bold">
      {item.title}
      {!read && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500">
        <span className="sr-only">Belum dibaca</span>
      </span>}
    </span>
    <time dateTime={item.created_at} className="mt-2 block text-xs font-normal text-slate-500">
      {new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
    </time>
    <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{item.body}</p>
    {href && <span className="mt-3 inline-block text-sm font-semibold text-indigo-700">Lihat detail →</span>}
  </>;
  const cardClass = `block w-full rounded-2xl border bg-white p-5 text-left focus-visible:outline-2 focus-visible:outline-indigo-500 ${
    read ? "border-slate-200" : "border-red-500"}`;

  return (
    <li>
      {href
        ? <Link href={href} onClick={open} className={cardClass}>{content}</Link>
        : <button type="button" onClick={open} className={cardClass}>{content}</button>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  );
}

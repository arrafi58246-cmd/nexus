"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { sendSquadMessage } from "./actions";
import type { RoomMember, RoomMessage } from "./types";

type SquadChatProps = {
  squadId: string;
  currentUserId: string;
  members: RoomMember[];
  initialMessages: RoomMessage[];
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu belum tersedia"
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(date);
}

export default function SquadChat({
  squadId,
  currentUserId,
  members,
  initialMessages,
}: SquadChatProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeAvailable, setRealtimeAvailable] = useState(true);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const memberNames = new Map(
    members.map((member) => [member.member_user_id, member.nama_lengkap]),
  );

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const [{ data: membership, error: membershipError }, { data: squad, error: squadError }, { data: profile, error: profileError }] =
        await Promise.all([
          supabase
            .from("squad_members")
            .select("squad_id")
            .eq("squad_id", squadId)
            .eq("user_id", currentUserId)
            .eq("status_member", "ACTIVE")
            .limit(1)
            .maybeSingle(),
          supabase
            .from("squads")
            .select("status_squad")
            .eq("squad_id", squadId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("status_akun, role_app")
            .eq("user_id", currentUserId)
            .maybeSingle(),
        ]);

      if (cancelled) return;
      if (membershipError || squadError || profileError || !membership ||
          !profile || profile.status_akun !== "ACTIVE" || profile.role_app !== "STUDENT" ||
          !squad || ["MISSION_COMPLETED", "DISBANDED"].includes(squad.status_squad)) {
        setAccessRevoked(true);
        router.replace("/my-squad");
        router.refresh();
      }
    }

    const channel = supabase
      .channel(`squad-messages-${squadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "squad_messages",
          filter: `squad_id=eq.${squadId}`,
        },
        () => router.refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeAvailable(true);
          router.refresh();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeAvailable(false);
        }
      });

    const accessCheck = window.setInterval(() => void checkAccess(), 15_000);
    window.addEventListener("focus", checkAccess);

    return () => {
      cancelled = true;
      window.clearInterval(accessCheck);
      window.removeEventListener("focus", checkAccess);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, router, squadId, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accessRevoked || isSending || !content.trim()) return;

    setError(null);
    setIsSending(true);
    try {
      const result = await sendSquadMessage(squadId, content);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setContent("");
      router.refresh();
    } catch {
      setError("Pesan belum terkirim. Silakan coba lagi.");
    } finally {
      setIsSending(false);
    }
  }

  if (accessRevoked) {
    return (
      <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Akses chat Squad telah berakhir. Kembali ke My Squad.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-950">Chat Squad</h2>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Muat pesan
        </button>
      </div>
      {!realtimeAvailable && (
        <p role="status" className="mt-3 text-sm text-amber-700">
          Pembaruan otomatis belum tersedia. Gunakan Muat pesan untuk melihat pesan baru.
        </p>
      )}
      <div
        aria-label="Percakapan Squad"
        aria-live="polite"
        className="mt-5 flex max-h-[32rem] min-h-64 flex-col gap-3 overflow-y-auto rounded-xl bg-slate-50 p-4"
      >
        {initialMessages.length === 0 ? (
          <p className="my-auto text-center text-sm text-slate-500">
            Belum ada pesan. Mulai percakapan dengan anggota Squad.
          </p>
        ) : (
          initialMessages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            const senderName = memberNames.get(message.sender_id)?.trim();
            return (
              <article
                key={message.message_id}
                className={`max-w-[90%] rounded-xl px-4 py-3 text-sm sm:max-w-[75%] ${
                  isOwn
                    ? "self-end bg-indigo-600 text-white"
                    : "self-start border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="break-words font-bold [overflow-wrap:anywhere]">
                  {senderName || (isOwn ? "Kamu" : "Mantan anggota")}
                  {isOwn && senderName && " (Kamu)"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {message.content}
                </p>
                <p className={`mt-2 text-xs ${isOwn ? "text-indigo-100" : "text-slate-500"}`}>
                  {formatTime(message.created_at)}
                </p>
              </article>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label htmlFor="squad-chat-content" className="sr-only">
          Tulis pesan untuk Squad
        </label>
        <textarea
          id="squad-chat-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Ketik pesan untuk Squad..."
          disabled={isSending}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
        />
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{content.length}/2000</p>
          <button
            type="submit"
            disabled={isSending || !content.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Mengirim..." : "Kirim"}
          </button>
        </div>
      </form>
    </section>
  );
}

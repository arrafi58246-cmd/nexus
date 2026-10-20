"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { submitWithUploads } from "@/lib/uploads/submit-with-uploads";

const MAX_AVATAR_BYTES = 5_242_880;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function AvatarUploadForm({ name, avatarUrl }: {
  name: string;
  avatarUrl: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const file = new FormData(event.currentTarget).get("avatar");
    setMessage("");
    setError("");
    if (!(file instanceof File) || !file.size || !ALLOWED_TYPES.includes(file.type) ||
        file.size > MAX_AVATAR_BYTES) {
      setError("Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 5 MiB.");
      return;
    }

    submitting.current = true;
    setPending(true);
    try {
      const body = new FormData();
      body.set("avatar", file);
      const response = await submitWithUploads("/api/profile/avatar", body, "avatars", ["avatar"]);
      const result: { success?: boolean; message?: string } = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? "Foto belum berhasil diunggah. Coba lagi.");
        return;
      }
      form.current?.reset();
      setMessage("Foto profil berhasil diganti.");
      router.refresh();
    } catch {
      setError("Foto belum berhasil diunggah. Coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form ref={form} onSubmit={handleSubmit} aria-busy={pending}
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">Foto profil</h2>
      <div className="mt-4 flex items-center gap-4">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`Foto ${name}`} width={72} height={72} unoptimized
            className="h-18 w-18 rounded-full object-cover" />
        ) : (
          <span aria-label="Foto profil belum tersedia"
            className="flex h-18 w-18 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">
            {name.trim().charAt(0).toUpperCase() || "N"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="profile-avatar" className="block text-sm font-medium">Pilih foto baru</label>
          <input id="profile-avatar" name="avatar" type="file" required
            accept="image/jpeg,image/png,image/webp" disabled={pending}
            className="mt-1 block w-full text-sm text-slate-700" />
          <p className="mt-1 text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5 MiB. Foto dapat dilihat publik.</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={pending}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Mengunggah…" : "Ganti foto"}
      </button>
    </form>
  );
}

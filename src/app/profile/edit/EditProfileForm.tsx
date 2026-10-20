"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { updateProfileBasics } from "./actions";

export default function EditProfileForm({ name, bio }: { name: string; bio: string }) {
  const [fullName, setFullName] = useState(name);
  const [description, setDescription] = useState(bio);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const result = await updateProfileBasics(fullName, description);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.replace("/profile");
      router.refresh();
    } catch {
      setError("Perubahan belum dapat disimpan. Coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={pending}
      className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="profile-name" className="block text-sm font-semibold">Nama lengkap</label>
        <input id="profile-name" type="text" autoComplete="name" required
          value={fullName} onChange={(event) => setFullName(event.target.value)}
          disabled={pending}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div>
        <label htmlFor="profile-bio" className="block text-sm font-semibold">Bio</label>
        <textarea id="profile-bio" rows={5} value={description}
          onChange={(event) => setDescription(event.target.value)} disabled={pending}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        <p className="mt-1 text-xs text-slate-500">Bio boleh dikosongkan.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
        <Link href="/profile" className="px-2 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          Batal
        </Link>
      </div>
    </form>
  );
}

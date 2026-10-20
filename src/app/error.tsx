"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="nexus-auth">
      <section className="glass-card nexus-auth-card">
        <p className="text-xs font-semibold tracking-[.2em] text-indigo-700">NEXUS</p>
        <h1 className="mt-4 text-2xl font-semibold">Halaman belum dapat dimuat</h1>
        <p role="alert" className="mt-3 text-sm leading-7 text-slate-600">Coba muat ulang halaman. Jika masalah berlanjut, hubungi pengelola NEXUS.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={retry} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold">Coba lagi</button>
          <Link href="/login" className="rounded-full border border-white/30 px-5 py-2 text-sm">Kembali ke login</Link>
        </div>
      </section>
    </main>
  );
}

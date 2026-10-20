export default function Loading() {
  return (
    <main className="nexus-dashboard" aria-busy="true" aria-label="Memuat halaman NEXUS">
      <p role="status" className="sr-only">Memuat halaman…</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((key) => <div key={key} className="glass-card p-7" aria-hidden="true">
          <div className="h-5 w-2/3 rounded-full bg-white/20" />
          <div className="mt-5 h-28 rounded-2xl bg-white/10" />
        </div>)}
      </div>
    </main>
  );
}

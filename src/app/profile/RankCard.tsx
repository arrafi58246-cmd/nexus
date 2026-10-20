export type RankRule = {
  rank_name: string;
  min_xp: number;
  max_xp: number | null;
};

export default function RankCard({ label, xp, rules }: { label: string; xp: number; rules: RankRule[] }) {
  const orderedRules = [...rules].sort((a, b) => a.min_xp - b.min_xp);
  const current = [...orderedRules].reverse().find((rule) =>
    xp >= rule.min_xp && (rule.max_xp === null || xp <= rule.max_xp));
  const next = orderedRules.find((rule) => rule.min_xp > xp);
  const progress = current ? next
    ? Math.max(0, Math.min(100, Math.floor(100 * (xp - current.min_xp) / (next.min_xp - current.min_xp))))
    : 100 : 0;
  const formatted = new Intl.NumberFormat("id-ID");
  const color = label.toLowerCase().includes("career") ? "#63c8ed" : "#ffca54";
  return (
    <section className="glass-card xp-card">
      <h2>{label.endsWith("XP") ? label : `${label} XP`}</h2>
      <div className="xp-ring" role="progressbar" aria-label={`Progres ${label}`}
        aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
        aria-valuetext={current ? `${formatted.format(xp)} XP, ${current.rank_name}, ${next ? `${progress}% menuju rank berikutnya` : "rank tertinggi tercapai"}` : "Rank belum tersedia"}>
        <svg viewBox="0 0 152 152" aria-hidden="true">
          <circle cx="76" cy="76" r="67" fill="none" stroke="#737b7e" strokeWidth="16" />
          <circle cx="76" cy="76" r="67" fill="none" stroke={color} strokeWidth="16"
            pathLength="100" strokeDasharray={`${progress} 100`} />
        </svg>
        <div className="xp-ring-center"><small>{current?.rank_name ?? "Belum tersedia"}</small><strong>{formatted.format(xp)}</strong></div>
      </div>
      <div className="xp-track" aria-hidden="true"><span style={{ width: `${progress}%`, background: color }} /></div>
      <p className="xp-caption">{current ? next ? `Menuju ${next.rank_name} · ${formatted.format(next.min_xp - xp)} XP lagi` : "Rank tertinggi tercapai" : "Aturan rank belum tersedia"}</p>
    </section>
  );
}

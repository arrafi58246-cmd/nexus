import { computeRank, type RankRule } from "@/lib/rank-progress";

const fmt = new Intl.NumberFormat("id-ID");

/** Season XP / Career XP card: ring + big number + progress toward the next rank. */
export default function XpProgressCard({ title, subtitle, xp, rules, tone, area }: {
  title: string;
  subtitle: string;
  xp: number;
  rules: RankRule[];
  tone: "season" | "career";
  area: string;
}) {
  const { current, next, progress } = computeRank(xp, rules);
  const gradient = `xp2-grad-${tone}`;
  return (
    <section className={`profile-card ${area} xp2 xp2--${tone}`} aria-label={title}>
      <h2>{title}</h2>
      <div className="xp2-body">
        <div className="xp2-ring" role="progressbar" aria-label={`Progres ${title}`}
          aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
          aria-valuetext={current
            ? `${fmt.format(xp)} XP, ${current.rank_name}, ${next ? `${progress}% menuju ${next.rank_name}` : "rank tertinggi tercapai"}`
            : "Rank belum tersedia"}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                {tone === "season"
                  ? <><stop offset="0" stopColor="#f59e0b" /><stop offset="1" stopColor="#ffd45e" /></>
                  : <><stop offset="0" stopColor="#2fa8d8" /><stop offset="1" stopColor="#7be0f0" /></>}
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#6d7276" strokeWidth="15" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={`url(#${gradient})`} strokeWidth="15"
              pathLength="100" strokeDasharray={`${progress} 100`} />
          </svg>
          <div className="xp2-ring-center">
            <small>{current?.rank_name ?? "—"}</small>
            <strong>{fmt.format(xp)}</strong>
          </div>
        </div>
        <div className="xp2-info">
          <p className="xp2-big">{fmt.format(xp)} XP</p>
          <p className="xp2-sub">{subtitle}</p>
          <div className="xp2-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          <p className="xp2-meta">
            <span>{next ? `Menuju ${next.rank_name}` : current ? "Rank tertinggi" : "Aturan rank belum tersedia"}</span>
            {next && <span>{fmt.format(xp)}/{fmt.format(next.min_xp)}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

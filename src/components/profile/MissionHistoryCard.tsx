import Link from "next/link";

import type { MissionHistoryItem } from "@/lib/mission-history";

/** Compact scrollable list; "Lihat Selengkapnya" only exists for the own profile. */
export default function MissionHistoryCard({ items, count, failed, moreHref, emptyText, area }: {
  items: MissionHistoryItem[];
  count: number;
  failed: boolean;
  moreHref?: string;
  emptyText: string;
  area: string;
}) {
  return (
    <section className={`profile-card ${area} history2`} aria-label="Mission History">
      <h2>Mission History</h2>
      {failed ? (
        <p role="alert" className="history2-note history2-note--error">Riwayat Mission belum dapat dimuat.</p>
      ) : count === 0 ? (
        <p className="history2-note">{emptyText}</p>
      ) : (
        <ol className="history2-list">
          {items.map((item) => (
            <li key={item.id} title={item.squadName ? `${item.name} — ${item.squadName}` : item.name}>
              {item.squadName ? `${item.squadName} — ${item.name}` : item.name}
            </li>
          ))}
        </ol>
      )}
      {moreHref && !failed && count > 0 && (
        <Link href={moreHref} className="history2-more">Lihat Selengkapnya ↗</Link>
      )}
    </section>
  );
}

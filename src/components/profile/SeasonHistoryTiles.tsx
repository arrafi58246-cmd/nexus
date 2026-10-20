import Image from "next/image";
import Link from "next/link";

import { RANK_ICONS, rankTierFromName } from "@/lib/badges";
import type { SeasonHistory } from "@/lib/season-history";

/** Season History tiles: shield + season name + rank + XP. */
export default function SeasonHistoryTiles({ items, count, failed, moreHref, emptyText, area }: {
  items: SeasonHistory[];
  count: number;
  failed: boolean;
  moreHref?: string;
  emptyText: string;
  area: string;
}) {
  return (
    <section className={`profile-card ${area} seasons2`} aria-label="Season History">
      <h2>Season History</h2>
      {failed ? (
        <p role="alert" className="history2-note history2-note--error">Riwayat Season belum dapat dimuat.</p>
      ) : count === 0 ? (
        <p className="history2-note">{emptyText}</p>
      ) : (
        <ul className="seasons2-list">
          {items.map((season) => {
            const tier = rankTierFromName(season.rank, season.xp);
            return (
              <li key={season.id} className={`seasons2-tile${tier ? ` seasons2-tile--${tier.split("-")[0]}` : ""}`}>
                {tier && <Image src={RANK_ICONS[tier]} alt="" width={40} height={40} />}
                <div>
                  <small>{season.name}</small>
                  <strong>{season.rank}</strong>
                  <span>{season.xp.toLocaleString("id-ID")} XP</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {moreHref && !failed && count > items.length && (
        <Link href={moreHref} className="history2-more">Lihat semua Season →</Link>
      )}
    </section>
  );
}

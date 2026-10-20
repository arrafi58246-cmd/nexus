import Link from "next/link";

import EquipBadgeButton from "@/app/profile/badges/EquipBadgeButton";
import type { BadgeCollection } from "@/lib/badge-collection";

import BadgePill from "./BadgePill";

const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

export default function ProfileBadgeCollection({ collection }: { collection: BadgeCollection | null }) {
  return (
    <section className="profile-card mb-8 mt-6" aria-label="Koleksi badge">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Badge Chest</h2>
        <Link href="/profile/badges" prefetch={false} className="profile-action">Kelola semua badge</Link>
      </div>
      <p className="history2-note mt-2">Koleksi badge yang sudah kamu peroleh. Pilih satu untuk ditampilkan dekat namamu.</p>
      {!collection ? (
        <p role="alert" className="history2-note history2-note--error mt-4">Koleksi badge belum dapat dimuat. Coba muat ulang.</p>
      ) : collection.count === 0 ? (
        <p className="history2-note mt-4">Belum ada badge di koleksimu. Badge yang diperoleh dari Rank-Up dan Leaderboard akan tampil di sini.</p>
      ) : (
        <>
          <p className="history2-note mt-3">{collection.count} badge dimiliki</p>
          <ul className="mt-4 grid max-h-96 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {collection.items.map(item => (
              <li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/20 bg-black/20 p-4">
                <BadgePill scope={item.badge.scope} tier={item.badge.tier} detail={item.badge.detail}>
                  {item.badge.label}
                </BadgePill>
                <p className="history2-note">{item.badge.detail}</p>
                <p className="history2-note">{item.context}{item.season ? ` · ${item.season}` : ""}</p>
                <p className="history2-note">Diperoleh {date.format(new Date(item.awardedAt))}</p>
                {item.equipped ? <span className="chest-equipped self-start">Terpasang</span>
                  : <EquipBadgeButton userBadgeId={item.id} />}
              </li>
            ))}
          </ul>
          {collection.count > collection.items.length && (
            <Link href="/profile/badges" prefetch={false} className="history2-more">
              Lihat semua {collection.count} badge ↗
            </Link>
          )}
        </>
      )}
    </section>
  );
}

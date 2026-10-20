import Image from "next/image";
import Link from "next/link";

import type { LeaderboardEntry } from "./types";

type Props = {
  entries: LeaderboardEntry[];
  currentUserId: string;
  imageUrl: (path: string) => string;
  highlightedName?: string;
};

const xpFormat = new Intl.NumberFormat("id-ID");

function Entry({ row, currentUserId, imageUrl, highlightedName = "", featured = false }: {
  row: LeaderboardEntry;
  currentUserId: string;
  imageUrl: (path: string) => string;
  highlightedName?: string;
  featured?: boolean;
}) {
  const match = highlightedName.length > 0 &&
    row.nama_lengkap.toLocaleLowerCase("id-ID").includes(highlightedName.toLocaleLowerCase("id-ID"));
  const link = row.user_id === currentUserId ? "/profile" : `/profile/${row.user_id}`;

  return (
    <li className={`leaderboard-entry rounded-2xl border bg-white p-5 ${featured ? "leaderboard-featured" : ""} ${match ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}>
      <Link href={link} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600">
        <div className="flex items-center gap-3">
          <span className="w-9 shrink-0 text-xl font-bold text-indigo-700">#{row.rank_position}</span>
          {row.foto_profil_path ? (
            <Image src={imageUrl(row.foto_profil_path)} alt="" width={48} height={48}
              unoptimized className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
              {row.nama_lengkap.trim().charAt(0).toUpperCase() || "N"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{row.nama_lengkap}{row.user_id === currentUserId ? " (kamu)" : ""}</p>
            <p className="text-xs text-slate-600">{row.nama_program_studi} · {row.nama_fakultas}</p>
            {featured && <p className="mt-1 text-xs text-slate-500">{row.nama_class ?? "Class belum dipilih"}</p>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-600">{row.rank_name ?? "Rank belum tersedia"}</span>
          <strong className="text-indigo-700">{xpFormat.format(row.seasonal_xp)} XP</strong>
        </div>
      </Link>
    </li>
  );
}

export default function LeaderboardEntries({ entries, currentUserId, imageUrl, highlightedName }: Props) {
  return (
    <ul className="leaderboard-table mt-4 grid gap-3">
      {entries.map((row) => <Entry key={row.user_id} row={row} currentUserId={currentUserId}
        imageUrl={imageUrl} highlightedName={highlightedName} />)}
    </ul>
  );
}

export function TopThree({ entries, currentUserId, imageUrl, highlightedName }: Props) {
  return (
    <ul className="leaderboard-podium mt-4 grid gap-4 md:grid-cols-3">
      {entries.map((row) => <Entry key={row.user_id} row={row} currentUserId={currentUserId}
        imageUrl={imageUrl} highlightedName={highlightedName} featured />)}
    </ul>
  );
}

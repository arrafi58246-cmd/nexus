import Link from "next/link";

import type { MissionHistoryItem } from "@/lib/mission-history";

const results: Record<string, string> = {
  PARTICIPANT: "Peserta", FINALIST: "Finalis", JUARA_3: "Juara 3",
  JUARA_2: "Juara 2", JUARA_1: "Juara 1",
};

export default function MissionHistoryList({ items }: { items: MissionHistoryItem[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {item.source === "SQUAD" ? "Hasil Squad NEXUS" : "Prestasi di luar Squad NEXUS"}
          </p>
          <h3 className="mt-2 text-lg font-bold">{item.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{item.organizer}</p>
          {item.squadName && <p className="mt-1 text-sm text-slate-600">Squad: {item.squadName}</p>}
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-slate-600">Hasil</dt>
              <dd className="font-semibold">{results[item.result] ?? item.result}</dd></div>
            <div><dt className="text-sm text-slate-600">Tanggal XP</dt>
              <dd className="font-semibold">{new Intl.DateTimeFormat("id-ID", {
                day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
              }).format(new Date(`${item.date}T12:00:00+07:00`))}</dd></div>
            <div><dt className="text-sm text-slate-600">XP diterima</dt>
              <dd className="font-semibold">+{item.xp.toLocaleString("id-ID")}</dd></div>
          </dl>
          {item.missionId && <Link href={`/missions/${item.missionId}`} prefetch={false}
            className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:underline">
            Lihat Mission
          </Link>}
        </li>
      ))}
    </ol>
  );
}

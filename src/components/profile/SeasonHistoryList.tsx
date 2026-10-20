import type { SeasonHistory } from "@/lib/season-history";

function date(value: string, timestamp = false) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(new Date(timestamp ? value : `${value}T12:00:00+07:00`));
}

export default function SeasonHistoryList({ items }: { items: SeasonHistory[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((season) => (
        <li key={season.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold">{season.name}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {date(season.startDate)} – {date(season.endDate)}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-600">Seasonal XP</dt>
              <dd className="font-bold">{season.xp.toLocaleString("id-ID")}</dd></div>
            <div><dt className="text-sm text-slate-600">Season Rank</dt>
              <dd className="font-bold">{season.rank}</dd></div>
          </dl>
          {season.positions.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
              {season.positions.map((place) => (
                <li key={place.scope} className="flex flex-wrap justify-between gap-x-3">
                  <span>{place.label}</span>
                  <strong>#{place.position.toLocaleString("id-ID")} dari {place.population.toLocaleString("id-ID")}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-slate-600">
            Posisi akhir untuk Season ini belum tersedia dalam snapshot.
          </p>}
          <p className="mt-4 text-xs text-slate-500">Snapshot {date(season.snapshotAt, true)}</p>
        </li>
      ))}
    </ol>
  );
}

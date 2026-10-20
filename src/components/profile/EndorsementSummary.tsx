import { ENDORSEMENT_FIELDS, type EndorsementSummary as Summary } from "@/lib/endorsements";

export default function EndorsementSummary({ summary }: { summary: Summary | null }) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-950">Penilaian rekan Squad</h2>
      {!summary ? (
        <p role="alert" className="mt-3 text-sm text-red-700">Penilaian belum dapat dimuat.</p>
      ) : summary.count === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Belum ada penilaian dari rekan Squad.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">Dari {summary.count} penilaian.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {ENDORSEMENT_FIELDS.map(([field, label]) => (
              <div key={field} className="rounded-lg bg-slate-50 p-3 text-sm">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-bold text-indigo-700">{summary.averages[field].toFixed(1)} / 5</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

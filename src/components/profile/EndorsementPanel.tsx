import type { ReactNode } from "react";

import type { EndorsementField, EndorsementSummary } from "@/lib/endorsements";

const ROWS: [EndorsementField, string][] = [
  ["communication", "Communication"],
  ["contribution", "Contribution"],
  ["teamwork", "Teamwork"],
  ["responsibility", "Responsibility"],
];

/** Endorsement averages as green bars; the peer profile passes the rating form as children. */
export default function EndorsementPanel({ summary, area, children }: {
  summary: EndorsementSummary | null;
  area: string;
  children?: ReactNode;
}) {
  return (
    <section className={`profile-card ${area} endorse2`} aria-label="Endorsement">
      <h2>Endorsement</h2>
      {!summary ? (
        <p role="alert" className="endorse2-note endorse2-note--error">Penilaian belum dapat dimuat.</p>
      ) : summary.count === 0 ? (
        <p className="endorse2-note">Belum ada penilaian dari rekan Squad.</p>
      ) : (
        <>
          <dl className="endorse2-rows">
            {ROWS.map(([field, label]) => {
              const score = summary.averages[field];
              return (
                <div key={field}>
                  <dt>{label}</dt>
                  <dd>
                    <span className="endorse2-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, (score / 5) * 100))}%` }} />
                    </span>
                    <strong>{score.toFixed(1)}</strong>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="endorse2-caption">Berdasarkan {summary.count} Endorsement dari Squad</p>
        </>
      )}
      {children}
    </section>
  );
}

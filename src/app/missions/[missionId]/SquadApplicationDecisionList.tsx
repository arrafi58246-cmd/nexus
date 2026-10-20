"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  decideSquadApplication,
  type SquadApplicationDecision,
} from "./actions";

export type SquadApplicationDecisionItem = {
  applicationId: string;
  applicantUserId: string | null;
  applicantName: string;
  primaryClassName: string | null;
  submittedAtLabel: string;
};

type SquadApplicationDecisionListProps = {
  missionId: string;
  applications: SquadApplicationDecisionItem[];
  acceptDisabledReason?: string;
};

export default function SquadApplicationDecisionList({
  missionId,
  applications: initialApplications,
  acceptDisabledReason,
}: SquadApplicationDecisionListProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [feedbackById, setFeedbackById] = useState<
    Record<string, { kind: "success" | "error"; message: string }>
  >({});
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const processingIdsRef = useRef(new Set<string>());
  const router = useRouter();

  async function handleDecision(
    applicationId: string,
    decision: SquadApplicationDecision,
  ) {
    if (
      processingIdsRef.current.has(applicationId) ||
      (decision === "ACCEPTED" && acceptDisabledReason)
    ) {
      return;
    }

    processingIdsRef.current.add(applicationId);
    setProcessingIds(new Set(processingIdsRef.current));
    setSuccessFeedback(null);
    setFeedbackById((current) => {
      const next = { ...current };
      delete next[applicationId];
      return next;
    });

    try {
      const result = await decideSquadApplication(applicationId, decision);

      if (!result.success) {
        setFeedbackById((current) => ({
          ...current,
          [applicationId]: { kind: "error", message: result.message },
        }));
        return;
      }

      setApplications((current) =>
        current.filter(
          (application) => application.applicationId !== applicationId,
        ),
      );
      setSuccessFeedback(
        decision === "ACCEPTED"
          ? "Pelamar berhasil diterima."
          : "Aplikasi berhasil ditolak.",
      );
      router.refresh();
    } catch {
      setFeedbackById((current) => ({
        ...current,
        [applicationId]: {
          kind: "error",
          message: "Aplikasi belum dapat diproses. Silakan coba lagi.",
        },
      }));
    } finally {
      processingIdsRef.current.delete(applicationId);
      setProcessingIds(new Set(processingIdsRef.current));
    }
  }

  return (
    <section className="mt-5 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-bold text-slate-900">Pelamar Pending</h4>
      <div aria-live="polite" className="mt-2 min-h-5">
        {successFeedback && (
          <p role="status" className="text-xs leading-5 text-emerald-700">
            {successFeedback}
          </p>
        )}
      </div>

      {applications.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Belum ada aplikasi Pending untuk Squad ini.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {applications.map((application) => {
            const isProcessing = processingIds.has(application.applicationId);
            const feedback = feedbackById[application.applicationId];

            return (
              <article
                key={application.applicationId}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                aria-busy={isProcessing}
              >
                <p className="break-words text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">
                  {application.applicantName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {application.primaryClassName ?? "Primary Class tidak tersedia"}
                  {" · "}
                  {application.submittedAtLabel}
                </p>

                {application.applicantUserId ? (
                  <Link
                    href={`/profile/${application.applicantUserId}?mission=${missionId}`}
                    prefetch={false}
                    aria-label={`Lihat profil ${application.applicantName}`}
                    className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    Lihat Profil
                  </Link>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Profil pelamar belum dapat dimuat. Coba muat ulang halaman.
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleDecision(application.applicationId, "ACCEPTED")
                    }
                    disabled={isProcessing || Boolean(acceptDisabledReason)}
                    aria-describedby={
                      acceptDisabledReason
                        ? `accept-disabled-${application.applicationId}`
                        : undefined
                    }
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 disabled:hover:bg-slate-200"
                  >
                    {isProcessing ? "Memproses..." : "Terima"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDecision(application.applicationId, "REJECTED")
                    }
                    disabled={isProcessing}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {isProcessing ? "Memproses..." : "Tolak"}
                  </button>
                </div>

                {acceptDisabledReason && (
                  <p
                    id={`accept-disabled-${application.applicationId}`}
                    className="mt-2 text-xs leading-5 text-slate-500"
                  >
                    {acceptDisabledReason}
                  </p>
                )}

                <div aria-live="polite" className="mt-2 min-h-5">
                  {feedback && (
                    <p
                      role={feedback.kind === "success" ? "status" : "alert"}
                      className={`text-xs leading-5 ${feedback.kind === "success" ? "text-emerald-700" : "text-red-600"}`}
                    >
                      {feedback.message}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

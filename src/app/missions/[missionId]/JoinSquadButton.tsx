"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cancelSquadApplication } from "./actions";
import type { SubmitSquadApplicationResult } from "./actions";

const SUBMIT_APPLICATION_ENDPOINT = "/api/squad-applications/submit";

const SUBMIT_FALLBACK_ERROR: SubmitSquadApplicationResult = {
  success: false,
  code: "DATABASE_ERROR",
  message: "Permintaan Join belum dapat dikirim. Silakan coba lagi.",
};

function isSubmitSquadApplicationResult(
  value: unknown,
): value is SubmitSquadApplicationResult {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  if (candidate.success === true) {
    return typeof candidate.applicationId === "string";
  }

  return (
    candidate.success === false &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

async function requestSquadApplication(
  squadId: string,
): Promise<SubmitSquadApplicationResult> {
  const response = await fetch(SUBMIT_APPLICATION_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ squadId }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!isSubmitSquadApplicationResult(payload)) {
    return SUBMIT_FALLBACK_ERROR;
  }

  return payload;
}

type JoinSquadState =
  | "eligible"
  | "pending"
  | "cancelled"
  | "member"
  | "disabled";

type JoinSquadButtonProps = {
  squadId: string;
  initialState: JoinSquadState;
  pendingApplicationId?: string;
  disabledReason?: string;
};

export default function JoinSquadButton({
  squadId,
  initialState,
  pendingApplicationId,
  disabledReason,
}: JoinSquadButtonProps) {
  const [state, setState] = useState(initialState);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [applicationId, setApplicationId] = useState(
    pendingApplicationId,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgressRef = useRef(false);
  const router = useRouter();

  if (state === "member") {
    return (
      <p className="squad-dialog-note">
        Anda sudah menjadi anggota atau Ketua Squad pada Mission ini.
      </p>
    );
  }

  const isPending = state === "pending";
  const isDisabled = state === "disabled";
  const isCancelled = state === "cancelled";

  async function handleAction() {
    if (
      (state !== "eligible" && state !== "pending") ||
      isSubmitting ||
      submitInProgressRef.current
    ) {
      return;
    }

    submitInProgressRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (state === "pending") {
        if (!applicationId) {
          setFeedback({
            kind: "error",
            message:
              "Aplikasi Pending belum dapat ditemukan. Muat ulang halaman.",
          });
          return;
        }

        const result = await cancelSquadApplication(applicationId);

        if (!result.success) {
          setFeedback({ kind: "error", message: result.message });
          return;
        }

        setState("cancelled");
        setApplicationId(undefined);
        setFeedback({
          kind: "success",
          message: "Aplikasi Join berhasil dibatalkan.",
        });
        router.refresh();
        return;
      }

      const result = await requestSquadApplication(squadId);

      if (!result.success) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }

      setApplicationId(result.applicationId);
      setState("pending");
      setFeedback({
        kind: "success",
        message: "Permintaan Join berhasil dikirim dan sedang Pending.",
      });
      router.refresh();
    } catch {
      setFeedback({
        kind: "error",
        message: "Aplikasi Squad belum dapat diproses. Silakan coba lagi.",
      });
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="squad-join">
      <button
        type="button"
        onClick={handleAction}
        disabled={isDisabled || isCancelled || isSubmitting}
        aria-busy={isSubmitting}
        aria-describedby={
          isDisabled && disabledReason
            ? `join-squad-reason-${squadId}`
            : undefined
        }
        className={`squad-join-btn${isPending ? " is-pending" : ""}`}
      >
        {isSubmitting
          ? isPending
            ? "Membatalkan..."
            : "Mengirim..."
          : isPending
            ? "Batalkan aplikasi Pending"
            : isCancelled
              ? "Dibatalkan"
              : "Minta Gabung"}
      </button>

      {isPending && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          Status aplikasi: Pending
        </p>
      )}

      {isDisabled && disabledReason && (
        <p
          id={`join-squad-reason-${squadId}`}
          className="mt-2 text-xs leading-5 text-slate-500"
        >
          {disabledReason}
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
    </div>
  );
}

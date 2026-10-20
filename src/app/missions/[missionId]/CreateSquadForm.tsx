"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";

import { createSquad } from "./actions";
import RequirementsEditor from "./create-squad-form/RequirementsEditor";
import SquadFields from "./create-squad-form/SquadFields";
import type {
  CreateSquadPrimaryClass,
  FormErrors,
  RequirementRow,
  SubmitFeedback,
} from "./create-squad-form/types";
import {
  parseInteger,
  validateCreateSquadForm,
} from "./create-squad-form/validation";

export type { CreateSquadPrimaryClass } from "./create-squad-form/types";

type CreateSquadFormProps = {
  missionId: string;
  primaryClasses: CreateSquadPrimaryClass[];
  primaryClassesLoadFailed: boolean;
  registrationOpen: boolean;
  hasActiveMembership: boolean;
  membershipLoadFailed: boolean;
  minimumTeamSize: number | null;
  maximumTeamSize: number | null;
};

export default function CreateSquadForm({
  missionId,
  primaryClasses,
  primaryClassesLoadFailed,
  registrationOpen,
  hasActiveMembership,
  membershipLoadFailed,
  minimumTeamSize,
  maximumTeamSize,
}: CreateSquadFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [namaSquad, setNamaSquad] = useState("");
  const [deskripsiSquad, setDeskripsiSquad] = useState("");
  const initialCapacity =
    minimumTeamSize !== null && minimumTeamSize >= 2
      ? String(minimumTeamSize)
      : "";
  const [kapasitasAnggota, setKapasitasAnggota] = useState(initialCapacity);
  const [requirements, setRequirements] = useState<RequirementRow[]>([
    { id: 1, primaryClassId: "", slots: "1" },
  ]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitFeedback, setSubmitFeedback] =
    useState<SubmitFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgressRef = useRef(false);
  const nextRequirementIdRef = useRef(2);
  const router = useRouter();

  const selectedPrimaryClassIds = useMemo(
    () =>
      new Set(
        requirements
          .map((requirement) => requirement.primaryClassId)
          .filter(Boolean),
      ),
    [requirements],
  );

  const allocatedSlots = useMemo(
    () =>
      requirements.reduce((total, requirement) => {
        const slots = parseInteger(requirement.slots);
        return slots !== null && slots > 0 ? total + slots : total;
      }, 0),
    [requirements],
  );

  const parsedCapacity = parseInteger(kapasitasAnggota);
  const requiredSlots =
    parsedCapacity !== null && parsedCapacity >= 2
      ? parsedCapacity - 1
      : null;
  const remainingSlots =
    requiredSlots === null ? null : requiredSlots - allocatedSlots;

  const availabilityMessage = membershipLoadFailed
    ? "Status keanggotaan Squad belum dapat diperiksa. Coba muat ulang halaman."
    : hasActiveMembership
      ? "Anda sudah menjadi anggota atau Ketua Squad pada Mission ini."
      : !registrationOpen
        ? "Pendaftaran Mission telah ditutup. Squad baru tidak dapat dibuat."
        : minimumTeamSize === null || maximumTeamSize === null
          ? "Batas anggota Mission belum tersedia. Squad belum dapat dibuat."
          : maximumTeamSize === 1
            ? "Mission ini merupakan lomba individu dan tidak menggunakan Squad."
            : primaryClassesLoadFailed
              ? "Pilihan Primary Class belum dapat dimuat. Coba muat ulang halaman."
              : primaryClasses.length === 0
                ? "Belum ada Primary Class yang tersedia untuk requirements."
                : null;

  function clearMessages() {
    setFormErrors({});
    setSubmitFeedback((current) =>
      current?.type === "error" ? null : current,
    );
  }

  function updateRequirement(
    id: number,
    field: "primaryClassId" | "slots",
    value: string,
  ) {
    if (isSubmitting) return;

    clearMessages();
    setRequirements((current) =>
      current.map((requirement) =>
        requirement.id === id
          ? { ...requirement, [field]: value }
          : requirement,
      ),
    );
  }

  function addRequirement() {
    if (isSubmitting || requirements.length >= primaryClasses.length) return;

    clearMessages();
    const id = nextRequirementIdRef.current;
    nextRequirementIdRef.current += 1;
    setRequirements((current) => [
      ...current,
      { id, primaryClassId: "", slots: "1" },
    ]);
  }

  function removeRequirement(id: number) {
    if (isSubmitting) return;

    clearMessages();
    setRequirements((current) =>
      current.filter((requirement) => requirement.id !== id),
    );
  }

  function resetForm() {
    setNamaSquad("");
    setDeskripsiSquad("");
    setKapasitasAnggota(initialCapacity);
    setRequirements([{ id: 1, primaryClassId: "", slots: "1" }]);
    nextRequirementIdRef.current = 2;
    setFormErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || submitInProgressRef.current || availabilityMessage) {
      return;
    }

    setSubmitFeedback(null);
    const validation = validateCreateSquadForm({
      missionId,
      namaSquad,
      deskripsiSquad,
      kapasitasAnggota,
      requirements,
      primaryClasses,
      minimumTeamSize,
      maximumTeamSize,
    });

    if (!validation.input) {
      setFormErrors(validation.errors);
      return;
    }

    submitInProgressRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await createSquad(validation.input);

      if (!result.success) {
        setSubmitFeedback({ type: "error", message: result.message });
        return;
      }

      resetForm();
      setIsOpen(false);
      setSubmitFeedback({
        type: "success",
        message: "Squad berhasil dibuat. Lamaran Pending kamu pada Mission ini otomatis dibatalkan.",
      });
      router.refresh();
    } catch {
      setSubmitFeedback({
        type: "error",
        message: "Squad belum dapat dibuat. Silakan coba lagi.",
      });
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="create-squad-title"
      className={isOpen ? "glass-card mt-5 p-6 sm:p-8" : "mt-4"}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={isOpen ? "min-w-0" : "sr-only"}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            Kolaborasi
          </p>
          <h2
            id="create-squad-title"
            className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl"
          >
            Buat Squad
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Susun kebutuhan anggota berdasarkan Primary Class untuk mengikuti
            Mission ini. Jika berhasil, semua lamaran Pending kamu pada Mission ini
            otomatis dibatalkan. Lamaran di Mission lain tetap tersimpan.
          </p>
        </div>

        {!isOpen && (
          <button
            type="button"
            disabled={Boolean(availabilityMessage)}
            onClick={() => {
              setSubmitFeedback(null);
              setIsOpen(true);
            }}
            aria-describedby={
              availabilityMessage ? "create-squad-availability" : undefined
            }
            className="squad-add-btn ml-auto w-full shrink-0 focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:w-auto"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 4.9 2.6 7.4 8 8-5.4.6-7.4 3.1-8 8-.6-4.9-2.6-7.4-8-8 5.4-.6 7.4-3.1 8-8Z" /></svg>
            Buat Squad
          </button>
        )}
      </div>

      {availabilityMessage && (
        <p
          id="create-squad-availability"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          {availabilityMessage}
        </p>
      )}

      <div aria-live="polite" className={submitFeedback ? "mt-4" : ""}>
        {submitFeedback && (
          <p
            role={submitFeedback.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm leading-6 ${submitFeedback.type === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
          >
            {submitFeedback.message}
          </p>
        )}
      </div>

      {isOpen && !availabilityMessage && (
        <form
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          className="mt-5 border-t border-slate-100 pt-6"
        >
          <fieldset disabled={isSubmitting} className="min-w-0">
            <legend className="sr-only">Informasi Create Squad</legend>

            {formErrors.form && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {formErrors.form}
              </p>
            )}

            <SquadFields
              namaSquad={namaSquad}
              deskripsiSquad={deskripsiSquad}
              kapasitasAnggota={kapasitasAnggota}
              minimumTeamSize={minimumTeamSize}
              maximumTeamSize={maximumTeamSize}
              errors={formErrors}
              onNameChange={(value) => {
                setNamaSquad(value);
                clearMessages();
              }}
              onDescriptionChange={(value) => {
                setDeskripsiSquad(value);
                clearMessages();
              }}
              onCapacityChange={(value) => {
                setKapasitasAnggota(value);
                clearMessages();
              }}
            />

            <RequirementsEditor
              requirements={requirements}
              primaryClasses={primaryClasses}
              selectedPrimaryClassIds={selectedPrimaryClassIds}
              allocatedSlots={allocatedSlots}
              remainingSlots={remainingSlots}
              errors={formErrors}
              onUpdate={updateRequirement}
              onAdd={addRequirement}
              onRemove={removeRequirement}
            />
          </fieldset>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setFormErrors({});
                setSubmitFeedback(null);
                setIsOpen(false);
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:opacity-80 sm:w-auto"
            >
              {isSubmitting ? "Membuat Squad..." : "Simpan Squad"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}


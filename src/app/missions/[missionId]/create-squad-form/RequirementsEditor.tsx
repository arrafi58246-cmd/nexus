import type {
  CreateSquadPrimaryClass,
  FormErrors,
  RequirementRow,
} from "./types";
import { SMALLINT_MAX } from "./validation";

type RequirementsEditorProps = {
  requirements: RequirementRow[];
  primaryClasses: CreateSquadPrimaryClass[];
  selectedPrimaryClassIds: Set<string>;
  allocatedSlots: number;
  remainingSlots: number | null;
  errors: FormErrors;
  onUpdate: (
    id: number,
    field: "primaryClassId" | "slots",
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
};

export default function RequirementsEditor({
  requirements,
  primaryClasses,
  selectedPrimaryClassIds,
  allocatedSlots,
  remainingSlots,
  errors,
  onUpdate,
  onAdd,
  onRemove,
}: RequirementsEditorProps) {
  return (
    <div className="mt-7 border-t border-slate-100 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Requirements anggota
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Alokasikan slot anggota di luar Ketua. Primary Class Ketua tidak
            mengurangi requirements.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 text-center text-xs sm:w-64">
          <div className="rounded-xl bg-indigo-50 px-3 py-2 text-indigo-700">
            <span className="block font-semibold">Dialokasikan</span>
            <span className="mt-0.5 block text-base font-bold">
              {allocatedSlots}
            </span>
          </div>
          <div
            className={`rounded-xl px-3 py-2 ${remainingSlots !== null && remainingSlots < 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}
          >
            <span className="block font-semibold">
              {remainingSlots !== null && remainingSlots < 0
                ? "Kelebihan"
                : "Sisa"}
            </span>
            <span className="mt-0.5 block text-base font-bold">
              {remainingSlots === null ? "-" : Math.abs(remainingSlots)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {requirements.map((requirement, index) => {
          const rowErrors = errors.requirementRows?.[requirement.id];

          return (
            <div
              key={requirement.id}
              className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Requirement {index + 1}
              </p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start">
                <div className="min-w-0">
                  <label
                    htmlFor={`requirement-class-${requirement.id}`}
                    className="text-sm font-bold text-slate-700"
                  >
                    Primary Class
                  </label>
                  <select
                    id={`requirement-class-${requirement.id}`}
                    value={requirement.primaryClassId}
                    onChange={(event) =>
                      onUpdate(
                        requirement.id,
                        "primaryClassId",
                        event.target.value,
                      )
                    }
                    aria-invalid={Boolean(rowErrors?.primaryClassId)}
                    aria-describedby={
                      rowErrors?.primaryClassId
                        ? `requirement-class-error-${requirement.id}`
                        : undefined
                    }
                    required
                    className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">Pilih Primary Class</option>
                    {primaryClasses.map((primaryClass) => {
                      const optionValue = String(
                        primaryClass.primary_class_id,
                      );
                      const selectedElsewhere =
                        optionValue !== requirement.primaryClassId &&
                        selectedPrimaryClassIds.has(optionValue);

                      return (
                        <option
                          key={primaryClass.primary_class_id}
                          value={optionValue}
                          disabled={selectedElsewhere}
                        >
                          {primaryClass.nama_class}
                        </option>
                      );
                    })}
                  </select>
                  {rowErrors?.primaryClassId && (
                    <p
                      id={`requirement-class-error-${requirement.id}`}
                      className="mt-2 text-sm text-red-600"
                    >
                      {rowErrors.primaryClassId}
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor={`requirement-slots-${requirement.id}`}
                    className="text-sm font-bold text-slate-700"
                  >
                    Jumlah slot
                  </label>
                  <input
                    id={`requirement-slots-${requirement.id}`}
                    type="number"
                    min={1}
                    max={SMALLINT_MAX}
                    step={1}
                    value={requirement.slots}
                    onChange={(event) =>
                      onUpdate(requirement.id, "slots", event.target.value)
                    }
                    aria-invalid={Boolean(rowErrors?.slots)}
                    aria-describedby={
                      rowErrors?.slots
                        ? `requirement-slots-error-${requirement.id}`
                        : undefined
                    }
                    required
                    className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  {rowErrors?.slots && (
                    <p
                      id={`requirement-slots-error-${requirement.id}`}
                      className="mt-2 text-sm text-red-600"
                    >
                      {rowErrors.slots}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(requirement.id)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-100 bg-white px-4 text-sm font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100 sm:mt-7 sm:w-auto"
                  aria-label={`Hapus requirement ${index + 1}`}
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })}

        {requirements.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            Belum ada requirement. Tambahkan minimal satu Primary Class.
          </p>
        )}
      </div>

      {errors.requirements && (
        <p
          id="create-squad-requirements-error"
          role="alert"
          className="mt-3 text-sm text-red-600"
        >
          {errors.requirements}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onAdd}
          disabled={requirements.length >= primaryClasses.length}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
        >
          Tambah requirement
        </button>
        {requirements.length >= primaryClasses.length && (
          <p className="text-xs leading-5 text-slate-500">
            Jumlah requirement sudah mencapai jumlah Primary Class yang
            tersedia.
          </p>
        )}
      </div>
    </div>
  );
}

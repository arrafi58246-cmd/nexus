import type { FormErrors } from "./types";

type SquadFieldsProps = {
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: string;
  minimumTeamSize: number | null;
  maximumTeamSize: number | null;
  errors: FormErrors;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCapacityChange: (value: string) => void;
};

export default function SquadFields({
  namaSquad,
  deskripsiSquad,
  kapasitasAnggota,
  minimumTeamSize,
  maximumTeamSize,
  errors,
  onNameChange,
  onDescriptionChange,
  onCapacityChange,
}: SquadFieldsProps) {
  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <div className="min-w-0">
        <label
          htmlFor="create-squad-name"
          className="text-sm font-bold text-slate-700"
        >
          Nama Squad
        </label>
        <input
          id="create-squad-name"
          type="text"
          value={namaSquad}
          onChange={(event) => onNameChange(event.target.value)}
          aria-invalid={Boolean(errors.namaSquad)}
          aria-describedby={
            errors.namaSquad ? "create-squad-name-error" : undefined
          }
          required
          className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          placeholder="Contoh: Squad Garuda"
        />
        {errors.namaSquad && (
          <p id="create-squad-name-error" className="mt-2 text-sm text-red-600">
            {errors.namaSquad}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <label
          htmlFor="create-squad-capacity"
          className="text-sm font-bold text-slate-700"
        >
          Kapasitas anggota
        </label>
        <input
          id="create-squad-capacity"
          type="number"
          min={minimumTeamSize ?? undefined}
          max={maximumTeamSize ?? undefined}
          step={1}
          value={kapasitasAnggota}
          onChange={(event) => onCapacityChange(event.target.value)}
          aria-invalid={Boolean(errors.kapasitasAnggota)}
          aria-describedby={`create-squad-capacity-help${errors.kapasitasAnggota ? " create-squad-capacity-error" : ""}`}
          required
          className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
        <p
          id="create-squad-capacity-help"
          className="mt-2 text-xs leading-5 text-slate-500"
        >
          {minimumTeamSize !== null && maximumTeamSize !== null
            ? `Jumlah anggota termasuk Ketua: minimum ${minimumTeamSize}, maksimum ${maximumTeamSize}.`
            : "Batas anggota Mission belum tersedia."}
        </p>
        {errors.kapasitasAnggota && (
          <p
            id="create-squad-capacity-error"
            className="mt-1 text-sm text-red-600"
          >
            {errors.kapasitasAnggota}
          </p>
        )}
      </div>

      <div className="min-w-0 sm:col-span-2">
        <label
          htmlFor="create-squad-description"
          className="text-sm font-bold text-slate-700"
        >
          Deskripsi Squad
        </label>
        <textarea
          id="create-squad-description"
          rows={4}
          value={deskripsiSquad}
          onChange={(event) => onDescriptionChange(event.target.value)}
          aria-invalid={Boolean(errors.deskripsiSquad)}
          aria-describedby={
            errors.deskripsiSquad
              ? "create-squad-description-error"
              : undefined
          }
          required
          className="mt-2 block w-full min-w-0 resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          placeholder="Jelaskan fokus dan tujuan Squad ini."
        />
        {errors.deskripsiSquad && (
          <p
            id="create-squad-description-error"
            className="mt-2 text-sm text-red-600"
          >
            {errors.deskripsiSquad}
          </p>
        )}
      </div>
    </div>
  );
}

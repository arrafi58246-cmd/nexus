import type { CreateSquadInput } from "../actions";
import type {
  CreateSquadPrimaryClass,
  FormErrors,
  RequirementErrors,
  RequirementRow,
} from "./types";

export const SMALLINT_MAX = 32767;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ValidateCreateSquadFormOptions = {
  missionId: string;
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: string;
  requirements: RequirementRow[];
  primaryClasses: CreateSquadPrimaryClass[];
  minimumTeamSize: number | null;
  maximumTeamSize: number | null;
};

type ValidateCreateSquadFormResult =
  | { input: CreateSquadInput; errors: null }
  | { input: null; errors: FormErrors };

export function parseInteger(value: string): number | null {
  const normalizedValue = value.trim();

  if (!/^-?\d+$/.test(normalizedValue)) return null;

  const parsedValue = Number(normalizedValue);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

export function validateCreateSquadForm({
  missionId,
  namaSquad,
  deskripsiSquad,
  kapasitasAnggota,
  requirements,
  primaryClasses,
  minimumTeamSize,
  maximumTeamSize,
}: ValidateCreateSquadFormOptions): ValidateCreateSquadFormResult {
  const errors: FormErrors = {};
  const requirementErrors: RequirementErrors = {};
  const normalizedMissionId = missionId.trim().toLocaleLowerCase("en-US");
  const normalizedName = namaSquad.trim();
  const normalizedDescription = deskripsiSquad.trim();
  const capacity = parseInteger(kapasitasAnggota);
  const validPrimaryClassIds = new Set(
    primaryClasses.map((primaryClass) => primaryClass.primary_class_id),
  );
  const usedPrimaryClassIds = new Set<number>();
  const normalizedRequirements: CreateSquadInput["requirements"] = [];

  if (!UUID_PATTERN.test(normalizedMissionId)) {
    errors.form = "Mission tidak valid. Muat ulang halaman lalu coba lagi.";
  }

  if (!normalizedName) errors.namaSquad = "Nama Squad wajib diisi.";
  if (!normalizedDescription) {
    errors.deskripsiSquad = "Deskripsi Squad wajib diisi.";
  }

  if (capacity === null || capacity < 2 || capacity > SMALLINT_MAX) {
    errors.kapasitasAnggota =
      "Kapasitas harus berupa bilangan bulat antara 2 dan 32767.";
  } else if (minimumTeamSize === null || maximumTeamSize === null) {
    errors.kapasitasAnggota = "Batas anggota Mission belum tersedia.";
  } else if (maximumTeamSize === 1) {
    errors.kapasitasAnggota =
      "Mission individu tidak menggunakan alur Create Squad.";
  } else if (capacity < minimumTeamSize) {
    errors.kapasitasAnggota = `Kapasitas minimal untuk Mission ini adalah ${minimumTeamSize}.`;
  } else if (capacity > maximumTeamSize) {
    errors.kapasitasAnggota = `Kapasitas maksimal untuk Mission ini adalah ${maximumTeamSize}.`;
  }

  if (requirements.length === 0) {
    errors.requirements = "Tambahkan minimal satu requirement.";
  }

  let totalSlots = 0;

  for (const requirement of requirements) {
    const primaryClassId = parseInteger(requirement.primaryClassId);
    const slots = parseInteger(requirement.slots);
    const rowErrors: RequirementErrors[number] = {};

    if (
      primaryClassId === null ||
      !validPrimaryClassIds.has(primaryClassId)
    ) {
      rowErrors.primaryClassId = "Pilih Primary Class.";
    } else if (usedPrimaryClassIds.has(primaryClassId)) {
      rowErrors.primaryClassId =
        "Primary Class yang sama tidak boleh dipilih dua kali.";
    } else {
      usedPrimaryClassIds.add(primaryClassId);
    }

    if (slots === null || slots <= 0 || slots > SMALLINT_MAX) {
      rowErrors.slots =
        "Slot harus berupa bilangan bulat antara 1 dan 32767.";
    }

    if (Object.keys(rowErrors).length > 0) {
      requirementErrors[requirement.id] = rowErrors;
      continue;
    }

    totalSlots += slots as number;
    normalizedRequirements.push({
      primaryClassId: primaryClassId as number,
      slots: slots as number,
    });
  }

  if (
    capacity !== null &&
    capacity >= 2 &&
    capacity <= SMALLINT_MAX &&
    requirements.length > 0 &&
    Object.keys(requirementErrors).length === 0 &&
    totalSlots !== capacity - 1
  ) {
    errors.requirements = `Total slot harus ${capacity - 1}, sesuai kapasitas di luar Ketua.`;
  }

  if (Object.keys(requirementErrors).length > 0) {
    errors.requirementRows = requirementErrors;
  }

  if (Object.keys(errors).length > 0) return { input: null, errors };

  return {
    input: {
      missionId: normalizedMissionId,
      namaSquad: normalizedName,
      deskripsiSquad: normalizedDescription,
      kapasitasAnggota: capacity as number,
      requirements: normalizedRequirements,
    },
    errors: null,
  };
}

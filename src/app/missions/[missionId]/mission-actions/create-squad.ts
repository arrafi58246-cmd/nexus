import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { UUID_PATTERN, type DatabaseError } from "./shared";
import type {
  CreateSquadErrorCode,
  CreateSquadInput,
  CreateSquadResult,
} from "./types";

const SMALLINT_MAX = 32767;

const SAFE_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  onboardingRequired: "Lengkapi onboarding sebelum membuat Squad.",
  accountNotEligible: "Akun Anda tidak dapat membuat Squad.",
  invalidInput: "Data Squad yang diberikan tidak valid.",
  missionNotFound: "Mission tidak ditemukan.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  capacityBelowMinimum: "Kapasitas Squad di bawah minimum Mission.",
  capacityAboveMaximum: "Kapasitas Squad melebihi maksimum Mission.",
  individualMission: "Mission individu tidak menggunakan alur Create Squad.",
  limitsUnavailable: "Batas anggota Mission belum tersedia.",
  activeSquadConflict: "Anda sudah memiliki Squad aktif pada Mission ini.",
  databaseError: "Squad belum dapat dibuat. Silakan coba lagi.",
} as const;

const RPC_TRIGGER_MESSAGES = {
  missionNotFound: "Mission not found",
  missionClosed:
    "A new Squad cannot be created after the Mission registration deadline",
  activeSquadConflict:
    "A user may have only one active Squad membership per Mission",
  capacityBelowMinimum: "Squad capacity is below the Mission minimum",
  capacityAboveMaximum: "Squad capacity is above the Mission maximum",
  individualMission: "Individual Missions do not support Squads",
  limitsUnavailable: "Mission team size limits are not configured",
} as const;

type NormalizedCreateSquadInput = {
  missionId: string;
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: number;
  requirements: Array<{
    primary_class_id: number;
    slot_dibutuhkan: number;
  }>;
};

function failure(
  code: CreateSquadErrorCode,
  message: string,
): CreateSquadResult {
  return { success: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  );
}

function normalizeInput(input: unknown): NormalizedCreateSquadInput | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "missionId",
      "namaSquad",
      "deskripsiSquad",
      "kapasitasAnggota",
      "requirements",
    ]) ||
    typeof input.missionId !== "string" ||
    typeof input.namaSquad !== "string" ||
    typeof input.deskripsiSquad !== "string" ||
    typeof input.kapasitasAnggota !== "number" ||
    !Number.isInteger(input.kapasitasAnggota) ||
    input.kapasitasAnggota < 2 ||
    input.kapasitasAnggota > SMALLINT_MAX ||
    !Array.isArray(input.requirements) ||
    input.requirements.length === 0
  ) {
    return null;
  }

  const missionId = input.missionId.trim().toLocaleLowerCase("en-US");
  const namaSquad = input.namaSquad.trim();
  const deskripsiSquad = input.deskripsiSquad.trim();

  if (
    !UUID_PATTERN.test(missionId) ||
    namaSquad.length === 0 ||
    deskripsiSquad.length === 0
  ) {
    return null;
  }

  const primaryClassIds = new Set<number>();
  const requirements: NormalizedCreateSquadInput["requirements"] = [];
  let totalSlots = 0;

  for (const requirement of input.requirements) {
    if (
      !isRecord(requirement) ||
      !hasExactKeys(requirement, ["primaryClassId", "slots"]) ||
      typeof requirement.primaryClassId !== "number" ||
      !Number.isSafeInteger(requirement.primaryClassId) ||
      typeof requirement.slots !== "number" ||
      !Number.isInteger(requirement.slots) ||
      requirement.slots <= 0 ||
      requirement.slots > SMALLINT_MAX ||
      primaryClassIds.has(requirement.primaryClassId)
    ) {
      return null;
    }

    primaryClassIds.add(requirement.primaryClassId);
    totalSlots += requirement.slots;
    requirements.push({
      primary_class_id: requirement.primaryClassId,
      slot_dibutuhkan: requirement.slots,
    });
  }

  if (totalSlots !== input.kapasitasAnggota - 1) return null;

  return {
    missionId,
    namaSquad,
    deskripsiSquad,
    kapasitasAnggota: input.kapasitasAnggota,
    requirements,
  };
}

function mapRpcError(error: DatabaseError): CreateSquadResult {
  if (error.code === "P0001") {
    if (error.message === RPC_TRIGGER_MESSAGES.missionNotFound) {
      return failure("MISSION_NOT_FOUND", SAFE_MESSAGES.missionNotFound);
    }

    if (error.message === RPC_TRIGGER_MESSAGES.missionClosed) {
      return failure(
        "MISSION_REGISTRATION_CLOSED",
        SAFE_MESSAGES.missionClosed,
      );
    }

    if (error.message === RPC_TRIGGER_MESSAGES.activeSquadConflict) {
      return failure(
        "ACTIVE_SQUAD_CONFLICT",
        SAFE_MESSAGES.activeSquadConflict,
      );
    }
  }

  if (error.message === RPC_TRIGGER_MESSAGES.capacityBelowMinimum) {
    return failure(
      "CAPACITY_BELOW_MISSION_MINIMUM",
      SAFE_MESSAGES.capacityBelowMinimum,
    );
  }

  if (error.message === RPC_TRIGGER_MESSAGES.capacityAboveMaximum) {
    return failure(
      "CAPACITY_ABOVE_MISSION_MAXIMUM",
      SAFE_MESSAGES.capacityAboveMaximum,
    );
  }

  if (error.message === RPC_TRIGGER_MESSAGES.individualMission) {
    return failure("INDIVIDUAL_MISSION", SAFE_MESSAGES.individualMission);
  }

  if (error.message === RPC_TRIGGER_MESSAGES.limitsUnavailable) {
    return failure(
      "MISSION_LIMITS_UNAVAILABLE",
      SAFE_MESSAGES.limitsUnavailable,
    );
  }

  if (error.code === "42501") {
    return failure("ACCOUNT_NOT_ELIGIBLE", SAFE_MESSAGES.accountNotEligible);
  }

  if (error.code === "23505") {
    return failure("ACTIVE_SQUAD_CONFLICT", SAFE_MESSAGES.activeSquadConflict);
  }

  if (
    error.code === "22003" ||
    error.code === "22023" ||
    error.code === "22P02" ||
    error.code === "23503" ||
    error.code === "23514"
  ) {
    return failure("INVALID_INPUT", SAFE_MESSAGES.invalidInput);
  }

  return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
}

export async function createSquad(
  input: CreateSquadInput,
): Promise<CreateSquadResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return failure("AUTH_REQUIRED", SAFE_MESSAGES.authRequired);
  }

  const normalizedInput = normalizeInput(input);
  if (!normalizedInput) {
    return failure("INVALID_INPUT", SAFE_MESSAGES.invalidInput);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_class_id, status_akun, role_app")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  if (!profile || profile.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE") {
    return failure("ACCOUNT_NOT_ELIGIBLE", SAFE_MESSAGES.accountNotEligible);
  }

  if (profile.primary_class_id === null) {
    return failure("ONBOARDING_REQUIRED", SAFE_MESSAGES.onboardingRequired);
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("min_anggota_tim, max_anggota_tim")
    .eq("mission_id", normalizedInput.missionId)
    .maybeSingle();

  if (missionError) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  if (!mission) {
    return failure("MISSION_NOT_FOUND", SAFE_MESSAGES.missionNotFound);
  }

  if (mission.min_anggota_tim === null || mission.max_anggota_tim === null) {
    return failure(
      "MISSION_LIMITS_UNAVAILABLE",
      SAFE_MESSAGES.limitsUnavailable,
    );
  }

  if (mission.max_anggota_tim === 1) {
    return failure("INDIVIDUAL_MISSION", SAFE_MESSAGES.individualMission);
  }

  if (normalizedInput.kapasitasAnggota < mission.min_anggota_tim) {
    return failure(
      "CAPACITY_BELOW_MISSION_MINIMUM",
      SAFE_MESSAGES.capacityBelowMinimum,
    );
  }

  if (normalizedInput.kapasitasAnggota > mission.max_anggota_tim) {
    return failure(
      "CAPACITY_ABOVE_MISSION_MAXIMUM",
      SAFE_MESSAGES.capacityAboveMaximum,
    );
  }

  const { data: squadId, error: rpcError } = await supabase.rpc(
    "create_squad",
    {
      p_mission_id: normalizedInput.missionId,
      p_nama_squad: normalizedInput.namaSquad,
      p_deskripsi_squad: normalizedInput.deskripsiSquad,
      p_kapasitas_anggota: normalizedInput.kapasitasAnggota,
      p_requirements: normalizedInput.requirements,
    },
  );

  if (rpcError) return mapRpcError(rpcError);

  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId)) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  revalidatePath(`/missions/${normalizedInput.missionId}`);
  revalidatePath("/my-squad");
  revalidatePath("/");
  return { success: true, squadId };
}


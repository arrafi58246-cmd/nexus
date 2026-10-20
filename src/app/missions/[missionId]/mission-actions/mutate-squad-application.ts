import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { UUID_PATTERN, type DatabaseError } from "./shared";
import type {
  SquadApplicationDecision,
  SquadApplicationMutationErrorCode,
  SquadApplicationMutationResult,
} from "./types";

const APPLICATION_MUTATION_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  accountInactive: "Akun ACTIVE diperlukan untuk mengelola aplikasi Squad.",
  invalidInput: "Data aplikasi Squad tidak valid.",
  applicationNotFound: "Aplikasi Squad tidak ditemukan.",
  cancelNotAllowed: "Anda hanya dapat membatalkan aplikasi milik sendiri.",
  decideNotAllowed:
    "Hanya Ketua Squad terkait yang dapat memutuskan aplikasi ini.",
  alreadyDecided: "Aplikasi ini sudah tidak berstatus Pending.",
  squadLocked: "Squad sudah tidak menerima anggota baru.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  squadFull: "Kapasitas Squad sudah penuh.",
  applicantInactive: "Akun pelamar sudah tidak ACTIVE.",
  activeMembership:
    "Pelamar sudah memiliki membership ACTIVE pada Mission ini.",
  concurrencyConflict:
    "Aplikasi berubah karena proses lain. Muat ulang lalu coba kembali.",
  databaseError: "Aplikasi Squad belum dapat diproses. Silakan coba lagi.",
} as const;

const APPLICATION_MUTATION_DATABASE_MESSAGES = {
  authRequired: "Not authorized",
  accountInactive: "Account is not active",
  applicationRequired: "Application is required",
  applicationNotFound: "Application not found",
  cancelNotAllowed:
    "Only the applicant or admin may cancel this application",
  decideNotAllowed:
    "Only the Squad leader or admin may decide this application",
  cancelAlreadyDecided: "Only a PENDING application can be cancelled",
  decideAlreadyDecided: "Only PENDING applications can be decided",
  invalidDecision: "Decision must be ACCEPTED or REJECTED",
  squadNotFound: "Squad not found",
  squadLocked: "The Squad is no longer open for recruitment",
  missionNotFound: "Mission not found",
  missionClosed: "The Mission registration deadline has passed",
  squadFull: "The Squad is already full",
  applicantInactive: "Applicant account is not active",
  activeMembership:
    "Applicant already has an active Squad for this Mission",
} as const;

function applicationMutationFailure(
  code: SquadApplicationMutationErrorCode,
  message: string,
): SquadApplicationMutationResult {
  return { success: false, code, message };
}

function mapApplicationMutationError(
  error: DatabaseError,
  operation: "cancel" | "decide",
): SquadApplicationMutationResult {
  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.authRequired) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicationRequired ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.invalidDecision ||
    error.code === "22023" ||
    error.code === "22P02"
  ) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.accountInactive) {
    return applicationMutationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MUTATION_MESSAGES.accountInactive,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicationNotFound ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadNotFound ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.missionNotFound
  ) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.cancelNotAllowed ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.decideNotAllowed
  ) {
    return applicationMutationFailure(
      "NOT_ALLOWED",
      operation === "cancel"
        ? APPLICATION_MUTATION_MESSAGES.cancelNotAllowed
        : APPLICATION_MUTATION_MESSAGES.decideNotAllowed,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.cancelAlreadyDecided ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.decideAlreadyDecided
  ) {
    return applicationMutationFailure(
      "ALREADY_DECIDED",
      APPLICATION_MUTATION_MESSAGES.alreadyDecided,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadLocked) {
    return applicationMutationFailure(
      "SQUAD_LOCKED",
      APPLICATION_MUTATION_MESSAGES.squadLocked,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.missionClosed) {
    return applicationMutationFailure(
      "MISSION_REGISTRATION_CLOSED",
      APPLICATION_MUTATION_MESSAGES.missionClosed,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadFull) {
    return applicationMutationFailure(
      "SQUAD_FULL",
      APPLICATION_MUTATION_MESSAGES.squadFull,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicantInactive) {
    return applicationMutationFailure(
      "APPLICANT_INACTIVE",
      APPLICATION_MUTATION_MESSAGES.applicantInactive,
    );
  }

  if (
    error.code === "23505" ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.activeMembership
  ) {
    return applicationMutationFailure(
      "ACTIVE_MEMBERSHIP",
      APPLICATION_MUTATION_MESSAGES.activeMembership,
    );
  }

  if (error.code === "40P01" || error.code === "40001") {
    return applicationMutationFailure(
      "CONCURRENCY_CONFLICT",
      APPLICATION_MUTATION_MESSAGES.concurrencyConflict,
    );
  }

  if (error.code === "42501") {
    return applicationMutationFailure(
      "NOT_ALLOWED",
      operation === "cancel"
        ? APPLICATION_MUTATION_MESSAGES.cancelNotAllowed
        : APPLICATION_MUTATION_MESSAGES.decideNotAllowed,
    );
  }

  return applicationMutationFailure(
    "DATABASE_ERROR",
    APPLICATION_MUTATION_MESSAGES.databaseError,
  );
}

function normalizeApplicationId(applicationId: unknown): string | null {
  if (typeof applicationId !== "string") return null;

  const normalized = applicationId.trim().toLocaleLowerCase("en-US");
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export async function cancelSquadApplication(
  applicationId: string,
): Promise<SquadApplicationMutationResult> {
  const normalizedApplicationId = normalizeApplicationId(applicationId);

  if (!normalizedApplicationId) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  const { data: application, error: applicationQueryError } = await supabase
    .from("squad_applications")
    .select("mission_id")
    .eq("application_id", normalizedApplicationId)
    .maybeSingle();

  if (applicationQueryError) {
    return applicationMutationFailure(
      "DATABASE_ERROR",
      APPLICATION_MUTATION_MESSAGES.databaseError,
    );
  }

  if (!application) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  const { error } = await supabase.rpc("cancel_squad_application", {
    p_application_id: normalizedApplicationId,
  });

  if (error) return mapApplicationMutationError(error, "cancel");

  revalidatePath(`/missions/${application.mission_id}`);
  return { success: true };
}

export async function decideSquadApplication(
  applicationId: string,
  decision: SquadApplicationDecision,
): Promise<SquadApplicationMutationResult> {
  const normalizedApplicationId = normalizeApplicationId(applicationId);

  if (
    !normalizedApplicationId ||
    (decision !== "ACCEPTED" && decision !== "REJECTED")
  ) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  const { data: application, error: applicationQueryError } = await supabase
    .from("squad_applications")
    .select("mission_id")
    .eq("application_id", normalizedApplicationId)
    .maybeSingle();

  if (applicationQueryError) {
    return applicationMutationFailure(
      "DATABASE_ERROR",
      APPLICATION_MUTATION_MESSAGES.databaseError,
    );
  }

  if (!application) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  const { error } = await supabase.rpc("decide_squad_application", {
    p_application_id: normalizedApplicationId,
    p_decision: decision,
  });

  if (error) return mapApplicationMutationError(error, "decide");

  revalidatePath(`/missions/${application.mission_id}`);
  return { success: true };
}

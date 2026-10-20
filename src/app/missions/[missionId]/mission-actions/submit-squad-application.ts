import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { UUID_PATTERN, type DatabaseError } from "./shared";
import type {
  SubmitSquadApplicationErrorCode,
  SubmitSquadApplicationResult,
} from "./types";

const APPLICATION_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  accountInactive: "Akun Anda tidak dapat mengajukan permintaan Join.",
  studentRequired: "Join Squad hanya tersedia untuk mahasiswa aktif.",
  onboardingRequired: "Lengkapi onboarding sebelum mengajukan Join Squad.",
  invalidInput: "Squad yang dipilih tidak valid.",
  squadNotFound: "Squad tidak ditemukan.",
  missionNotFound: "Mission tidak ditemukan.",
  squadLocked: "Squad ini sudah tidak menerima aplikasi.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  ownSquad: "Anda tidak dapat mengajukan Join ke Squad sendiri.",
  activeMembership: "Anda sudah menjadi anggota Squad pada Mission ini.",
  duplicatePending: "Anda sudah mengajukan Join ke Squad ini.",
  pendingLimit: "Anda sudah mencapai batas 3 aplikasi Pending pada Mission ini.",
  databaseError: "Permintaan Join belum dapat dikirim. Silakan coba lagi.",
} as const;

const APPLICATION_DATABASE_MESSAGES = {
  authRequired: "Not authorized",
  squadRequired: "Squad is required",
  accountInactive: "Account is not active",
  onboardingRequired: "Onboarding must be completed before applying to a Squad",
  squadNotFound: "Squad not found",
  missionNotFound: "Mission not found",
  squadLocked: "This Squad is not accepting applications",
  missionClosed: "The Mission registration deadline has passed",
  ownSquad: "You cannot apply to your own Squad",
  activeMembership: "You already have an active Squad for this Mission",
  duplicatePending: "You already have a pending application for this Squad",
  pendingLimit:
    "A user may have at most 3 pending Squad applications per Mission",
} as const;

function applicationFailure(
  code: SubmitSquadApplicationErrorCode,
  message: string,
): SubmitSquadApplicationResult {
  return { success: false, code, message };
}

function mapApplicationError(error: DatabaseError): SubmitSquadApplicationResult {
  if (error.message === APPLICATION_DATABASE_MESSAGES.authRequired) {
    return applicationFailure("AUTH_REQUIRED", APPLICATION_MESSAGES.authRequired);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadRequired) {
    return applicationFailure("INVALID_INPUT", APPLICATION_MESSAGES.invalidInput);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.accountInactive) {
    return applicationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MESSAGES.accountInactive,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.onboardingRequired) {
    return applicationFailure(
      "ONBOARDING_REQUIRED",
      APPLICATION_MESSAGES.onboardingRequired,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadNotFound) {
    return applicationFailure("SQUAD_NOT_FOUND", APPLICATION_MESSAGES.squadNotFound);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.missionNotFound) {
    return applicationFailure(
      "MISSION_NOT_FOUND",
      APPLICATION_MESSAGES.missionNotFound,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadLocked) {
    return applicationFailure("SQUAD_LOCKED", APPLICATION_MESSAGES.squadLocked);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.missionClosed) {
    return applicationFailure(
      "MISSION_REGISTRATION_CLOSED",
      APPLICATION_MESSAGES.missionClosed,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.ownSquad) {
    return applicationFailure("OWN_SQUAD", APPLICATION_MESSAGES.ownSquad);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.activeMembership) {
    return applicationFailure(
      "ACTIVE_MEMBERSHIP",
      APPLICATION_MESSAGES.activeMembership,
    );
  }

  if (
    error.code === "23505" ||
    error.message === APPLICATION_DATABASE_MESSAGES.duplicatePending
  ) {
    return applicationFailure(
      "DUPLICATE_PENDING",
      APPLICATION_MESSAGES.duplicatePending,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.pendingLimit) {
    return applicationFailure(
      "PENDING_LIMIT_REACHED",
      APPLICATION_MESSAGES.pendingLimit,
    );
  }

  if (error.code === "42501") {
    return applicationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MESSAGES.accountInactive,
    );
  }

  return applicationFailure("DATABASE_ERROR", APPLICATION_MESSAGES.databaseError);
}

export async function submitSquadApplication(
  squadId: string,
): Promise<SubmitSquadApplicationResult> {
  if (typeof squadId !== "string") {
    return applicationFailure("INVALID_INPUT", APPLICATION_MESSAGES.invalidInput);
  }

  const normalizedSquadId = squadId.trim().toLocaleLowerCase("en-US");

  if (!UUID_PATTERN.test(normalizedSquadId)) {
    return applicationFailure("INVALID_INPUT", APPLICATION_MESSAGES.invalidInput);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationFailure("AUTH_REQUIRED", APPLICATION_MESSAGES.authRequired);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_app, status_akun, primary_class_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    return applicationFailure("DATABASE_ERROR", APPLICATION_MESSAGES.databaseError);
  }
  if (!profile || profile.role_app !== "STUDENT") {
    return applicationFailure("STUDENT_REQUIRED", APPLICATION_MESSAGES.studentRequired);
  }
  if (profile.status_akun !== "ACTIVE") {
    return applicationFailure("ACCOUNT_INACTIVE", APPLICATION_MESSAGES.accountInactive);
  }
  if (profile.primary_class_id === null) {
    return applicationFailure("ONBOARDING_REQUIRED", APPLICATION_MESSAGES.onboardingRequired);
  }

  const { data: squad, error: squadError } = await supabase
    .from("squads")
    .select("mission_id")
    .eq("squad_id", normalizedSquadId)
    .maybeSingle();

  if (squadError) {
    return applicationFailure("DATABASE_ERROR", APPLICATION_MESSAGES.databaseError);
  }

  if (!squad) {
    return applicationFailure("SQUAD_NOT_FOUND", APPLICATION_MESSAGES.squadNotFound);
  }

  const { data: applicationId, error: applicationError } = await supabase.rpc(
    "submit_squad_application",
    { p_squad_id: normalizedSquadId },
  );

  if (applicationError) return mapApplicationError(applicationError);

  if (typeof applicationId !== "string" || !UUID_PATTERN.test(applicationId)) {
    return applicationFailure("DATABASE_ERROR", APPLICATION_MESSAGES.databaseError);
  }

  revalidatePath(`/missions/${squad.mission_id}`);
  return { success: true, applicationId };
}

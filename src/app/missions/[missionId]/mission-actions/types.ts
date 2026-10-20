export type CreateSquadRequirementInput = {
  primaryClassId: number;
  slots: number;
};

export type CreateSquadInput = {
  missionId: string;
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: number;
  requirements: CreateSquadRequirementInput[];
};

export type CreateSquadErrorCode =
  | "AUTH_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "ACCOUNT_NOT_ELIGIBLE"
  | "INVALID_INPUT"
  | "MISSION_NOT_FOUND"
  | "MISSION_REGISTRATION_CLOSED"
  | "CAPACITY_BELOW_MISSION_MINIMUM"
  | "CAPACITY_ABOVE_MISSION_MAXIMUM"
  | "INDIVIDUAL_MISSION"
  | "MISSION_LIMITS_UNAVAILABLE"
  | "ACTIVE_SQUAD_CONFLICT"
  | "DATABASE_ERROR";

export type CreateSquadResult =
  | { success: true; squadId: string }
  | {
      success: false;
      code: CreateSquadErrorCode;
      message: string;
    };

export type SubmitSquadApplicationErrorCode =
  | "AUTH_REQUIRED"
  | "STUDENT_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "ONBOARDING_REQUIRED"
  | "INVALID_INPUT"
  | "SQUAD_NOT_FOUND"
  | "MISSION_NOT_FOUND"
  | "SQUAD_LOCKED"
  | "MISSION_REGISTRATION_CLOSED"
  | "OWN_SQUAD"
  | "ACTIVE_MEMBERSHIP"
  | "DUPLICATE_PENDING"
  | "PENDING_LIMIT_REACHED"
  | "DATABASE_ERROR";

export type SubmitSquadApplicationResult =
  | { success: true; applicationId: string }
  | {
      success: false;
      code: SubmitSquadApplicationErrorCode;
      message: string;
    };

export type SquadApplicationDecision = "ACCEPTED" | "REJECTED";

export type SquadApplicationMutationErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "INVALID_INPUT"
  | "APPLICATION_NOT_FOUND"
  | "NOT_ALLOWED"
  | "ALREADY_DECIDED"
  | "SQUAD_LOCKED"
  | "MISSION_REGISTRATION_CLOSED"
  | "SQUAD_FULL"
  | "APPLICANT_INACTIVE"
  | "ACTIVE_MEMBERSHIP"
  | "CONCURRENCY_CONFLICT"
  | "DATABASE_ERROR";

export type SquadApplicationMutationResult =
  | { success: true }
  | {
      success: false;
      code: SquadApplicationMutationErrorCode;
      message: string;
    };

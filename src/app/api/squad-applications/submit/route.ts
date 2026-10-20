import {
  submitSquadApplication,
  type SubmitSquadApplicationResult,
} from "@/app/missions/[missionId]/actions";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonResult(result: SubmitSquadApplicationResult, status: number) {
  return Response.json(result, {
    status,
    headers: JSON_HEADERS,
  });
}

function statusFor(result: SubmitSquadApplicationResult) {
  if (result.success) return 201;

  switch (result.code) {
    case "INVALID_INPUT":
      return 400;
    case "AUTH_REQUIRED":
      return 401;
    case "STUDENT_REQUIRED":
    case "ACCOUNT_INACTIVE":
    case "ONBOARDING_REQUIRED":
    case "OWN_SQUAD":
      return 403;
    case "SQUAD_NOT_FOUND":
    case "MISSION_NOT_FOUND":
      return 404;
    case "SQUAD_LOCKED":
    case "MISSION_REGISTRATION_CLOSED":
    case "ACTIVE_MEMBERSHIP":
    case "DUPLICATE_PENDING":
    case "PENDING_LIMIT_REACHED":
      return 409;
    case "DATABASE_ERROR":
    default:
      return 500;
  }
}

function invalidInputResult(): SubmitSquadApplicationResult {
  return {
    success: false,
    code: "INVALID_INPUT",
    message: "Squad yang dipilih tidak valid.",
  };
}

function genericFailureResult(): SubmitSquadApplicationResult {
  return {
    success: false,
    code: "DATABASE_ERROR",
    message: "Permintaan Join belum dapat dikirim. Silakan coba lagi.",
  };
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return jsonResult(genericFailureResult(), 403);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.startsWith("application/json")) {
    return jsonResult(invalidInputResult(), 415);
  }

  try {
    const body: unknown = await request.json();
    const squadId =
      typeof body === "object" &&
      body !== null &&
      "squadId" in body &&
      typeof body.squadId === "string"
        ? body.squadId
        : "";

    const result = await submitSquadApplication(squadId);
    return jsonResult(result, statusFor(result));
  } catch (error) {
    console.error("[api/squad-applications/submit] failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResult(genericFailureResult(), 500);
  }
}

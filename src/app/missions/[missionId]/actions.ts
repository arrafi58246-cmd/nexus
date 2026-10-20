"use server";

import { createSquad as createSquadImplementation } from "./mission-actions/create-squad";
import {
  cancelSquadApplication as cancelSquadApplicationImplementation,
  decideSquadApplication as decideSquadApplicationImplementation,
} from "./mission-actions/mutate-squad-application";
import { submitSquadApplication as submitSquadApplicationImplementation } from "./mission-actions/submit-squad-application";
import type {
  CreateSquadInput,
  CreateSquadResult,
  SquadApplicationDecision,
  SquadApplicationMutationResult,
  SubmitSquadApplicationResult,
} from "./mission-actions/types";

export type {
  CreateSquadErrorCode,
  CreateSquadInput,
  CreateSquadRequirementInput,
  CreateSquadResult,
  SquadApplicationDecision,
  SquadApplicationMutationErrorCode,
  SquadApplicationMutationResult,
  SubmitSquadApplicationErrorCode,
  SubmitSquadApplicationResult,
} from "./mission-actions/types";

export async function createSquad(
  input: CreateSquadInput,
): Promise<CreateSquadResult> {
  return createSquadImplementation(input);
}

export async function submitSquadApplication(
  squadId: string,
): Promise<SubmitSquadApplicationResult> {
  return submitSquadApplicationImplementation(squadId);
}

export async function cancelSquadApplication(
  applicationId: string,
): Promise<SquadApplicationMutationResult> {
  return cancelSquadApplicationImplementation(applicationId);
}

export async function decideSquadApplication(
  applicationId: string,
  decision: SquadApplicationDecision,
): Promise<SquadApplicationMutationResult> {
  return decideSquadApplicationImplementation(applicationId, decision);
}

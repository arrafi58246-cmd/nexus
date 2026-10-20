import type { CompetitionResult, TierOption } from "@/app/squads/[squadId]/result/types";

export type ClaimRecord = {
  achievement_claim_id: string;
  nama_kompetisi: string;
  penyelenggara: string;
  achievement_date: string;
  submitted_tier_id: number;
  approved_tier_id: number | null;
  hasil_kompetisi: CompetitionResult;
  preview_xp: number;
  approved_xp: number | null;
  status_validation: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string | null;
  submitted_at: string;
  resubmission_count: number;
};

export type ClaimRule = {
  tier_id: number;
  hasil_kompetisi: CompetitionResult;
  legacy_xp: number;
};

export type { TierOption };

export const RESULT_OPTIONS = [
  { value: "PARTICIPANT", label: "Participant" },
  { value: "FINALIST", label: "Finalist" },
  { value: "JUARA_3", label: "Juara 3" },
  { value: "JUARA_2", label: "Juara 2" },
  { value: "JUARA_1", label: "Juara 1" },
] as const;

export type CompetitionResult = (typeof RESULT_OPTIONS)[number]["value"];

export type TierOption = {
  tier_id: number;
  kode_tier: string;
};

export type XpRule = {
  tier_id: number;
  hasil_kompetisi: CompetitionResult;
  verified_xp: number;
};

export type ResultRecord = {
  result_submission_id: string;
  hasil_kompetisi: CompetitionResult;
  submitted_tier_id: number;
  approved_tier_id: number | null;
  approved_hasil_kompetisi: CompetitionResult | null;
  preview_xp: number;
  approved_xp: number | null;
  status_validation: "PENDING" | "REJECTED" | "APPROVED";
  rejection_reason: string | null;
  submitted_at: string;
};

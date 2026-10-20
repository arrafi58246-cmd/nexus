export type SquadRole = "KETUA" | "ANGGOTA";

export type MembershipStatus =
  | "ACTIVE"
  | "LEFT"
  | "KICKED"
  | "ADMIN_REMOVED";

export type SquadStatus =
  | "OPEN_RECRUITMENT"
  | "FULL"
  | "FINALIZED"
  | "MISSION_COMPLETED"
  | "DISBANDED";

export type SquadMembershipRow = {
  squad_member_id: string;
  squad_id: string;
  mission_id: string;
  role_squad: SquadRole;
  status_member: MembershipStatus;
  joined_at: string;
  ended_at: string | null;
};

export type SquadRow = {
  squad_id: string;
  mission_id: string;
  nama_squad: string;
  kapasitas_anggota: number;
  status_squad: SquadStatus;
  completed_at: string | null;
};

export type MissionRow = {
  mission_id: string;
  nama_lomba: string;
  penyelenggara: string;
  cakupan_peserta: string;
  mode_lomba: string;
  biaya_pendaftaran: string;
  mission_tiers: unknown;
};

export type MissionResultRow = {
  result_submission_id: string;
  squad_id: string;
  hasil_kompetisi: string;
  status_validation: "PENDING" | "APPROVED" | "REJECTED";
};

export type MissionXpRow = {
  mission_result_submission_id: string | null;
  xp_amount: number;
  earned_at: string;
};

export type MySquadItem = {
  membershipId: string;
  squadId: string;
  missionId: string;
  squadName: string;
  missionName: string;
  organizer: string;
  tierCode: string | null;
  scope: string;
  mode: string;
  cost: string;
  capacity: number;
  activeMemberCount: number;
  squadStatus: SquadStatus;
  role: SquadRole;
  membershipStatus: MembershipStatus;
  joinedAt: string;
  historyDate: string | null;
  verifiedResult: string | null;
  earnedXp: number | null;
  xpEarnedAt: string | null;
};

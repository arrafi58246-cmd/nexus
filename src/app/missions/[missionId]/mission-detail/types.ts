import type { SquadApplicationDecisionItem } from "../SquadApplicationDecisionList";

export type MissionTier = {
  kode_tier: string | null;
  nama_tier: string | null;
};

export type MissionSquadLeader = {
  squad_id: string;
  nama_ketua: string | null;
};

export type LeaderPendingSquadApplication = {
  application_id: string;
  squad_id: string;
  applicant_name: string;
  primary_class_name: string | null;
  created_at: string;
};

export type MissionDetail = {
  mission_id: string;
  nama_lomba: string;
  penyelenggara: string;
  link_resmi: string | null;
  deadline_pendaftaran: string;
  deadline_lomba: string | null;
  tahun_lomba: number;
  kategori_lomba: string | null;
  cakupan_peserta: string | null;
  mode_lomba: string | null;
  min_anggota_tim: number | null;
  max_anggota_tim: number | null;
  biaya_pendaftaran: string | null;
  deskripsi_singkat: string | null;
  dokumen_path?: string | null;
  banner_path?: string | null;
};

export type SquadRequirement = {
  className: string;
  slots: number;
};

export type MissionSquad = {
  squad_id: string;
  nama_squad: string;
  deskripsi_squad: string | null;
  kapasitas_anggota: number;
  status_squad: string | null;
  ketua_id: string;
  active_members?: Array<{ count: number }>;
};

export type LeaderApplicationsBySquad = Map<
  string,
  SquadApplicationDecisionItem[]
>;

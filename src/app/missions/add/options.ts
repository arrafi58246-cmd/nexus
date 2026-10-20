export const ORGANIZERS = [
  ["PEMERINTAH_KEMENTERIAN", "Pemerintah / Kementerian"],
  ["BUMN", "BUMN"], ["SWASTA_BESAR", "Swasta besar"],
  ["UNIVERSITAS_NASIONAL", "Universitas nasional"],
  ["UNIVERSITAS_LOKAL_INTERNAL", "Universitas lokal / internal"],
  ["HIMPUNAN_UKM_KOMUNITAS", "Himpunan / UKM / komunitas"],
] as const;
export const CATEGORIES = [
  ["BUSINESS_MANAGEMENT", "Business & Management"],
  ["RESEARCH_SCIENTIFIC", "Research & Scientific"],
  ["TECHNOLOGY", "Technology"], ["CREATIVE_MEDIA", "Creative Media"],
  ["COMMUNICATION", "Communication"],
] as const;
export const SCOPES = [
  ["INTERNASIONAL", "Internasional"], ["NASIONAL", "Nasional"],
  ["REGIONAL", "Regional"], ["INTERNAL", "Internal"],
] as const;
export const MODES = [["ONLINE", "Online"], ["OFFLINE", "Offline"]] as const;
export const COSTS = [["GRATIS", "Gratis"], ["BERBAYAR", "Berbayar"]] as const;

export type MissionSubmission = {
  mission_submission_id: string;
  nama_lomba: string;
  penyelenggara: string;
  kategori_penyelenggara: string;
  link_resmi: string;
  deadline_pendaftaran: string;
  deadline_lomba: string;
  tahun_lomba: number;
  kategori_lomba: string;
  cakupan_peserta: string;
  mode_lomba: string;
  biaya_pendaftaran: string;
  min_anggota_tim: number;
  max_anggota_tim: number;
  deskripsi_singkat: string;
  dokumen_path: string;
  status_review: string;
  alasan_penolakan: string | null;
};

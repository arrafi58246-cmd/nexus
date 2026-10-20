export type Scope = "UNIVERSITAS" | "FAKULTAS" | "PROGRAM_STUDI";

export type LeaderboardEntry = {
  user_id: string;
  nama_lengkap: string;
  foto_profil_path: string | null;
  nama_program_studi: string;
  nama_fakultas: string;
  nama_class: string | null;
  seasonal_xp: number;
  rank_position: number;
  population_total: number;
  rank_name: string | null;
};

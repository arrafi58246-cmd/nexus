import type {
  MembershipStatus,
  SquadRole,
  SquadStatus,
} from "./types";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatEnumLabel(value: string): string {
  const label = value.trim().toLocaleLowerCase("id-ID").replaceAll("_", " ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

export function formatDate(value: string | null): string {
  if (!value) return "-";

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : "-";
}

export function formatRole(role: SquadRole): string {
  return role === "KETUA" ? "Ketua" : "Anggota";
}

export function formatMembershipStatus(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    ACTIVE: "Aktif",
    LEFT: "Keluar",
    KICKED: "Dikeluarkan",
    ADMIN_REMOVED: "Dihapus admin",
  };

  return labels[status];
}

export function formatSquadStatus(status: SquadStatus): string {
  const labels: Record<SquadStatus, string> = {
    OPEN_RECRUITMENT: "Open",
    FULL: "Locked",
    FINALIZED: "Finalized",
    MISSION_COMPLETED: "Mission Completed",
    DISBANDED: "Dibubarkan",
  };

  return labels[status];
}

export function getTierCode(relation: unknown): string | null {
  const relatedTier = Array.isArray(relation) ? relation[0] : relation;

  if (!relatedTier || typeof relatedTier !== "object") return null;
  if (!("kode_tier" in relatedTier)) return null;

  const code = relatedTier.kode_tier;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

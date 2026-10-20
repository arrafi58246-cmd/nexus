import type { MissionTier } from "./types";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const applicationDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function getRelatedTier(relation: unknown): MissionTier | null {
  if (Array.isArray(relation)) return (relation[0] as MissionTier) ?? null;
  if (relation && typeof relation === "object") return relation as MissionTier;
  return null;
}

export function formatEnumLabel(value: string | null): string {
  if (!value) return "-";

  const label = value.trim().toLocaleLowerCase("id-ID").replaceAll("_", " ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

export function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

export function formatApplicationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tidak tersedia"
    : applicationDateFormatter.format(date);
}

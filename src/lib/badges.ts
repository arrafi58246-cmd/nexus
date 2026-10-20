// Badge presentation rules shared by the profile pages and the Badge Chest.
// Colours follow the NEXUS badge bank: gold = Universitas, blue/violet = Fakultas,
// green/teal = Program Studi. The equipped badge also colours the avatar ring.

export type BadgeScope = "UNIVERSITAS" | "FAKULTAS" | "PROGRAM_STUDI";
export type RankTier =
  | "bronze" | "silver-1" | "silver-2" | "silver-3" | "gold" | "platinum" | "diamond";

export const UNIVERSITY_NAME = "Universitas Negeri Surabaya";

export const RANK_ICONS: Record<RankTier, string> = {
  bronze: "/ranks/bronze.png",
  "silver-1": "/ranks/silver-1.png",
  "silver-2": "/ranks/silver-2.png",
  "silver-3": "/ranks/silver-3.png",
  gold: "/ranks/gold.png",
  platinum: "/ranks/platinum.png",
  diamond: "/ranks/diamond.png",
};

export function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const SCOPES: readonly string[] = ["UNIVERSITAS", "FAKULTAS", "PROGRAM_STUDI"];

export type BadgeSource = {
  badgeName: string | null;
  scopeType: string | null;
  /** Fakultas / Program Studi name; not needed for Universitas. */
  scopeName: string | null;
  rankPosition: number | null;
  populationTotal: number | null;
};

export type BadgeView = {
  kind: "position" | "rank";
  scope: BadgeScope | null;
  tier: RankTier | null;
  /** Text shown inside the pill, e.g. "Fakultas Teknik No. 10". */
  label: string;
  /** Longer text for tooltips and screen readers. */
  detail: string;
};

/** Maps a rank name to its shield icon. Plain "Silver" is split by XP (300/600/999). */
export function rankTierFromName(name: string | null | undefined, xp?: number | null): RankTier | null {
  const text = (name ?? "").toLowerCase();
  if (text.includes("bronze")) return "bronze";
  if (text.includes("platinum")) return "platinum";
  if (text.includes("diamond")) return "diamond";
  if (text.includes("gold")) return "gold";
  if (text.includes("silver")) {
    if (/\b(iii|3)\b/.test(text)) return "silver-3";
    if (/\b(ii|2)\b/.test(text)) return "silver-2";
    if (/\b(i|1)\b/.test(text)) return "silver-1";
    if (typeof xp === "number") return xp >= 999 ? "silver-3" : xp >= 600 ? "silver-2" : "silver-1";
    return "silver-1";
  }
  return null;
}

export function describeBadge(source: BadgeSource): BadgeView | null {
  const population = source.populationTotal === null ? null
    : new Intl.NumberFormat("id-ID").format(source.populationTotal);

  if (source.scopeType && SCOPES.includes(source.scopeType) && source.rankPosition !== null) {
    const scope = source.scopeType as BadgeScope;
    const scopeName = scope === "UNIVERSITAS" ? UNIVERSITY_NAME : source.scopeName;
    const label = `${scopeName ?? source.badgeName ?? "Leaderboard"} No. ${source.rankPosition}`;
    return {
      kind: "position", scope, tier: null, label,
      detail: population ? `${label} dari ${population} peserta` : label,
    };
  }
  if (source.badgeName) {
    return {
      kind: "rank", scope: null, tier: rankTierFromName(source.badgeName),
      label: source.badgeName, detail: source.badgeName,
    };
  }
  return null;
}

const STOP_WORDS = new Set(["dan", "&", "of", "the", "dari", "untuk"]);

/** "Fakultas Ekonomika dan Bisnis" → "FEB". */
export function facultyAbbreviation(name: string): string {
  const letters = name.split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .map((word) => word.charAt(0).toUpperCase()).join("");
  return letters.length >= 2 ? letters : name;
}

/** CSS modifier for the avatar ring and any other element tinted by the badge. */
export function badgeTone(view: BadgeView | null): string {
  if (!view) return "none";
  if (view.scope === "UNIVERSITAS") return "univ";
  if (view.scope === "FAKULTAS") return "fakultas";
  if (view.scope === "PROGRAM_STUDI") return "prodi";
  return view.tier ?? "none";
}

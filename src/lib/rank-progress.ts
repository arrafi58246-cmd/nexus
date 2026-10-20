export type RankRule = { rank_name: string; min_xp: number; max_xp: number | null };

export type RankProgress = {
  current: RankRule | null;
  next: RankRule | null;
  /** 0–100, progress inside the current rank band. */
  progress: number;
};

export function computeRank(xp: number, rules: RankRule[]): RankProgress {
  const ordered = [...rules].sort((a, b) => a.min_xp - b.min_xp);
  const current = [...ordered].reverse().find((rule) =>
    xp >= rule.min_xp && (rule.max_xp === null || xp <= rule.max_xp)) ?? null;
  const next = ordered.find((rule) => rule.min_xp > xp) ?? null;
  const progress = current ? next
    ? Math.max(0, Math.min(100, Math.floor(100 * (xp - current.min_xp) / (next.min_xp - current.min_xp))))
    : 100 : 0;
  return { current, next, progress };
}

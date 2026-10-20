const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function endorsementWindow(completedAt: string | null, now = Date.now()) {
  const start = completedAt === null ? NaN : Date.parse(completedAt);
  const end = start + WINDOW_MS;
  return {
    closesAt: Number.isFinite(end) ? new Date(end).toISOString() : null,
    windowOpen: Number.isFinite(start) && now >= start && now < end,
  };
}

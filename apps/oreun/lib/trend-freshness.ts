import type { HistoryPoint } from "./types";
export function isTrustedHistoryPoint(point: HistoryPoint) {
  const coverage = point.coverageRatio ?? 1; // legacy raw fixtures have no rollup ratio
  return point.playing != null && Number.isFinite(point.playing) && point.playing >= 0 && Number.isFinite(coverage) && coverage >= .7 && coverage <= 1;
}
export function historyFreshness(points: HistoryPoint[], now = new Date(), intervalMinutes = 60) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return { fresh: false, lastTrustedAt: null, ageMinutes: null, maxAgeMinutes: 0 };
  const trusted = points.filter(isTrustedHistoryPoint).map(p => new Date(p.at).getTime()).filter(t => Number.isFinite(t) && t <= nowMs + 60000);
  const last = trusted.length ? Math.max(...trusted) : null;
  // bucket_at is the START of a rollup, not the raw collection timestamp.
  const maxAgeMinutes = intervalMinutes * 2 + 5;
  const ageMinutes = last === null ? null : Math.max(0, (nowMs-last)/60000);
  return { fresh: ageMinutes !== null && ageMinutes <= maxAgeMinutes, lastTrustedAt: last === null ? null : new Date(last).toISOString(), ageMinutes, maxAgeMinutes };
}

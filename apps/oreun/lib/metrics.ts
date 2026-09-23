import type { HistoryPoint } from "./types";

const COVERAGE_MIN = 0.7;

function isTrusted(point: HistoryPoint) {
  return (
    point.playing != null &&
    point.coverageRatio != null &&
    point.coverageRatio >= COVERAGE_MIN
  );
}

export function changeForWindow(
  points: HistoryPoint[],
  hours: number,
  expectedIntervalMinutes = 60,
) {
  const trusted = [...points]
    .filter(isTrusted)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const now = trusted.at(-1);
  if (!now?.playing || hours <= 0) return null;

  const nowTime = new Date(now.at).getTime();
  if (!Number.isFinite(nowTime)) return null;

  const target = nowTime - hours * 3_600_000;
  const tolerance = Math.min(
    hours * 1_800_000,
    Math.max(30 * 60_000, expectedIntervalMinutes * 60_000 * 0.75),
  );

  const candidates = trusted
    .slice(0, -1)
    .map((point) => ({
      point,
      time: new Date(point.at).getTime(),
    }))
    .filter(
      ({ time }) =>
        Number.isFinite(time) &&
        time < nowTime &&
        Math.abs(time - target) <= tolerance,
    )
    .sort((a, b) => Math.abs(a.time - target) - Math.abs(b.time - target));

  const baseline = candidates[0]?.point.playing ?? null;
  if (baseline == null || baseline <= 0) return null;
  return (now.playing - baseline) / baseline;
}

import { isTrustedHistoryPoint } from "./trend-freshness";
import type { HistoryPoint } from "./types";

export type RecentRiseSignal = {
  windowHours: 1 | 6 | 24;
  relativeGrowth: number;
  absoluteGrowth: number;
  score: number;
};

function signalForWindow(
  points: HistoryPoint[],
  hours: 1 | 6 | 24,
  expectedIntervalMinutes: number,
) {
  const trusted = points
    .filter(isTrustedHistoryPoint)
    .map((point) => ({ ...point, time: new Date(point.at).getTime() }))
    .filter((point) => Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);
  const latest = trusted.at(-1);
  if (!latest || latest.playing == null) return null;

  const target = latest.time - hours * 3_600_000;
  const tolerance = Math.min(
    hours * 1_800_000,
    Math.max(30 * 60_000, expectedIntervalMinutes * 60_000 * 0.75),
  );
  const baseline = trusted
    .slice(0, -1)
    .map((point) => ({ point, distance: Math.abs(point.time - target) }))
    .filter(({ point, distance }) => point.time < latest.time && distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0]?.point;

  if (!baseline || baseline.playing == null || baseline.playing <= 0) return null;
  const absoluteGrowth = latest.playing - baseline.playing;
  const relativeGrowth = absoluteGrowth / baseline.playing;
  if (!(absoluteGrowth > 0 && relativeGrowth > 0)) return null;

  const sizeFactor = Math.min(
    1,
    Math.max(0.45, Math.log1p(latest.playing) / Math.log1p(250_000)),
  );
  const absoluteFactor = Math.tanh(
    absoluteGrowth / Math.max(2_000, baseline.playing * 0.08),
  );
  const score =
    (relativeGrowth * 100 * 0.7 + absoluteFactor * 30) * sizeFactor;

  return {
    windowHours: hours,
    relativeGrowth,
    absoluteGrowth,
    score: Math.round(score * 10) / 10,
  } satisfies RecentRiseSignal;
}

export function recentRiseSignal(
  points: HistoryPoint[],
  expectedIntervalMinutes = 60,
): RecentRiseSignal | null {
  // "상승 중" is intentionally responsive: use the shortest trustworthy
  // positive window first, then widen to 6H/24H when the latest hour does not
  // have a comparable observation.
  return (
    signalForWindow(points, 1, expectedIntervalMinutes) ??
    signalForWindow(points, 6, expectedIntervalMinutes) ??
    signalForWindow(points, 24, expectedIntervalMinutes)
  );
}

export function recentRiseBadge(signal: RecentRiseSignal) {
  const pct = (signal.relativeGrowth * 100).toFixed(1);
  return `${signal.windowHours}H +${pct}%`;
}

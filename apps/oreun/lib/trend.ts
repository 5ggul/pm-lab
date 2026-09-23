import { historyFreshness, isTrustedHistoryPoint } from "./trend-freshness";
import type { Confidence, HistoryPoint, TrendResult } from "./types";

const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, n));

export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function historyCoverage(
  points: HistoryPoint[],
  expectedIntervalMinutes = 60,
) {
  const intervalMs = Math.max(1, expectedIntervalMinutes) * 60_000;
  const ordered = points
    .map((point) => ({ ...point, time: new Date(point.at).getTime() }))
    .filter((point) => Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);

  if (!ordered.length) return { ratio: 0, expected: 0, observed: 0 };
  if (ordered.length === 1) {
    return {
      ratio:
        ordered[0].playing == null
          ? 0
          : Math.min(1, Math.max(0, ordered[0].coverageRatio ?? 1)),
      expected: 1,
      observed:
        ordered[0].playing == null
          ? 0
          : Math.min(1, Math.max(0, ordered[0].coverageRatio ?? 1)),
    };
  }

  const first = ordered[0].time;
  const last = ordered[ordered.length - 1].time;
  const expected = Math.max(1, Math.floor((last - first) / intervalMs + 1e-6) + 1);
  const occupied = new Map<number, number>();

  for (const point of ordered) {
    if (point.playing == null) continue;
    const slot = Math.round((point.time - first) / intervalMs);
    if (slot < 0 || slot >= expected) continue;
    const pointCoverage = Math.min(
      1,
      Math.max(0, point.coverageRatio ?? 1),
    );
    occupied.set(slot, Math.max(occupied.get(slot) ?? 0, pointCoverage));
  }

  const observed = [...occupied.values()].reduce((sum, value) => sum + value, 0);
  return {
    ratio: Math.min(1, observed / expected),
    expected,
    observed,
  };
}

export function computeTrend(
  universeId: number,
  points: HistoryPoint[],
  updatedAt: string | null,
  now = new Date(),
  expectedIntervalMinutes = 60,
): TrendResult {
  const ordered = points.map(p => ({...p, playing: p.playing != null && Number.isFinite(p.playing) && p.playing >= 0 ? p.playing : null})).filter(p => Number.isFinite(new Date(p.at).getTime()) && new Date(p.at).getTime() <= now.getTime() + 60000).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const valid = ordered.filter(isTrustedHistoryPoint);
  const freshness = historyFreshness(ordered, now, expectedIntervalMinutes);
  const coverage = historyCoverage(ordered, expectedIntervalMinutes).ratio;

  if (valid.length < 8 || coverage < 0.7 || !freshness.fresh) {
    return {
      universeId,
      score: null,
      eligible: false,
      confidence: "insufficient",
      calculationVersion: "trend_v1_2",
      components: {
        absolute: 0,
        relative: 0,
        baseline: 0,
        coverage: coverage * 100,
        update: 0,
        interest: null,
      },
      metrics: {
        baseline: null,
        recent: null,
        coverageRatio: coverage,
        lastTrustedAt: freshness.lastTrustedAt,
        relativeGrowth: null,
        absoluteMomentum: null,
      },
      reason: valid.length >= 8 && !freshness.fresh ? "최근 관측을 확인하지 못했습니다." : "데이터 수집 중",
    };
  }

  const split = Math.max(1, Math.floor(valid.length * 0.6));
  const baseline = median(valid.slice(0, split).map((point) => point.playing!))!;
  const recent = median(valid.slice(split).map((point) => point.playing!))!;
  const absolute = recent - baseline;
  const relative = absolute / Math.max(baseline, 500);

  const absoluteScore = clamp(
    50 + 50 * Math.tanh(absolute / Math.max(3000, baseline * 0.18)),
  );
  const clippedRelative = Math.max(-0.8, Math.min(3, relative));
  const relativeScore = clamp(((clippedRelative + 0.2) / 1.2) * 100);
  const baselineScore = clamp(
    (Math.log1p(baseline) / Math.log1p(250000)) * 100,
  );
  const coverageScore = clamp(coverage * 100);
  const updatedMs = updatedAt ? new Date(updatedAt).getTime() : NaN;
  const daysSinceUpdate = Number.isFinite(updatedMs) ? Math.max(0, (now.getTime() - updatedMs) / 86_400_000) : 365;
  const updateScore = clamp(100 * Math.exp(-daysSinceUpdate / 30));

  // Internal interest remains disabled until unique-actor data exists.
  const weighted =
    (absoluteScore * 0.3 +
      relativeScore * 0.25 +
      baselineScore * 0.15 +
      coverageScore * 0.1 +
      updateScore * 0.1) /
    0.9;

  const confidence: Confidence =
    coverage >= 0.9 ? "high" : coverage >= 0.7 ? "medium" : "low";

  return {
    universeId,
    score: Math.round(weighted * 10) / 10,
    eligible: true,
    confidence,
    calculationVersion: "trend_v1_2",
    components: {
      absolute: absoluteScore,
      relative: relativeScore,
      baseline: baselineScore,
      coverage: coverageScore,
      update: updateScore,
      interest: null,
    },
    metrics: {
      baseline,
      recent,
      coverageRatio: coverage,
      lastTrustedAt: freshness.lastTrustedAt,
      relativeGrowth: relative,
      absoluteMomentum: absolute,
    },
    reason:
      absolute > 0
        ? "최근 플레이 인원 모멘텀이 기준 구간보다 높습니다."
        : "최근 모멘텀이 기준 구간보다 낮습니다.",
  };
}

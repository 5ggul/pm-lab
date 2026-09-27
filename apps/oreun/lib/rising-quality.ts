import type { RecentRiseSignal } from "./recent-rise";
import type { GameView, TrendResult } from "./types";

export function isPublicRisingCandidate(
  game: GameView,
  trend: TrendResult,
  signal: RecentRiseSignal | null,
) {
  if (!trend.eligible || !signal) return false;
  if (trend.confidence === "low" || trend.confidence === "insufficient") return false;
  if (game.playing == null || game.playing < 5_000) return false;
  if (signal.absoluteGrowth < 1_000) return false;
  if (signal.relativeGrowth > 2) return false;
  return true;
}

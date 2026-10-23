import type { GameView, HistoryPoint } from "./types";

export function previewFixtureEnabled() {
  return process.env.R1_PREVIEW_FIXTURES === "1";
}

export function getPreviewFixtureHistory(
  game: GameView,
  now = new Date(),
): HistoryPoint[] {
  if (!previewFixtureEnabled() || game.playing == null) return [];

  const points: HistoryPoint[] = [];
  const hash = (game.universeId % 23) - 11;
  const slope = hash / 80;
  const base = Math.max(1, game.playing / (1 + slope));

  for (let i = 0; i <= 28; i++) {
    // QA-only missing-row fixture. It verifies that both Trend coverage and the
    // SVG chart treat a collection gap as missing data instead of bridging it.
    if (game.universeId === 6035872082 && i === 20) continue;

    const t = i / 28;
    const at = new Date(now.getTime() - (28 - i) * 6 * 3_600_000);
    const wave = Math.sin(i * 1.3 + (game.universeId % 7)) * 0.035;
    const playing = Math.max(0, Math.round(base * (1 + slope * t + wave)));
    points.push({ at: at.toISOString(), playing });
  }

  points[points.length - 1] = { at: now.toISOString(), playing: game.playing };
  return points;
}

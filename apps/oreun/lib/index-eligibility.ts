import type { GameView, HistoryPoint } from "./types";
import { changeForWindow } from "./metrics";
import { getPersistentHistories } from "./repository/supabase-public";
import { getPublishedCodes, getPublishedGuides, isFreshCodeCheck } from "./content/queries";
import { getQuestionFeed } from "./community/queries";

const NON_EDITORIAL_SUMMARY_PHRASES = [
  "기록합니다",
  "추적합니다",
  "수집 후보입니다",
  "현재 플레이 규모를 확인합니다",
];

export type GameIndexEligibility = {
  eligible: boolean;
  reasons: string[];
};

export function hasIndependentGameSummary(game: GameView) {
  const text = game.descriptionKo?.trim();
  return Boolean(
    text &&
      !NON_EDITORIAL_SUMMARY_PHRASES.some((phrase) => text.includes(phrase)),
  );
}

export function evaluateGameIndexEligibility(
  game: GameView,
  evidence: {
    history: HistoryPoint[];
    hasIndexableGuide: boolean;
    hasFreshCode: boolean;
    hasAnsweredQuestion: boolean;
  },
): GameIndexEligibility {
  const reasons: string[] = [];
  if (game.indexState !== "indexable") reasons.push("db-index-state");
  if (!(game.heroImageUrl || game.thumbnailUrl)) reasons.push("game-image");
  if (!hasIndependentGameSummary(game)) reasons.push("independent-summary");

  const currentReady =
    game.regionalAvailability === "restricted_kr"
      ? Boolean(game.fallbackReason || game.availabilityNote)
      : game.freshnessState === "fresh" && game.playing != null;
  if (!currentReady) reasons.push("current-state");

  if (changeForWindow(evidence.history, 168, 60) == null) {
    reasons.push("seven-day-baseline");
  }

  if (
    !evidence.hasIndexableGuide &&
    !evidence.hasFreshCode &&
    !evidence.hasAnsweredQuestion
  ) {
    reasons.push("independent-content");
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function getGameIndexEligibility(game: GameView) {
  if (game.indexState !== "indexable") {
    return { eligible: false, reasons: ["db-index-state"] } satisfies GameIndexEligibility;
  }

  const [histories, guides, codes, questions] = await Promise.all([
    getPersistentHistories([game.universeId], 216).catch(() => null),
    getPublishedGuides(game.universeId).catch(() => []),
    getPublishedCodes(game.universeId).catch(() => []),
    getQuestionFeed({ gameUniverseId: game.universeId, limit: 100 }).catch(() => []),
  ]);

  return evaluateGameIndexEligibility(game, {
    history: histories?.get(game.universeId) ?? [],
    hasIndexableGuide: guides.some((guide) => guide.index_state === "indexable"),
    hasFreshCode: codes.some(
      (code) => code.code_status === "active" && isFreshCodeCheck(code),
    ),
    hasAnsweredQuestion: questions.some((question) => question.answer_count > 0),
  });
}

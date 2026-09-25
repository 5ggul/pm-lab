import type { Metadata } from "next";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import { getGameCatalog } from "@/lib/catalog";
import { getPreviewFixtureHistory, previewFixtureEnabled } from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";
import { changeForWindow } from "@/lib/metrics";
import { historyFreshness } from "@/lib/trend-freshness";
import { risingEmptyState } from "@/lib/rising-empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "상승 중인 게임",
  description: "최근 관측에서 플레이 인원이 늘어난 Roblox 게임을 확인합니다.",
  alternates: { canonical: "/rising" },
};

export default async function Rising() {
  const games = await getGameCatalog();
  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  let historyReadFailed = false;
  try {
    persistentHistories = await getPersistentHistories(games.map(game => game.universeId), 168);
  } catch {
    historyReadFailed = true;
  }
  const now = new Date();
  const evaluated = games.map(game => {
    const storedHistory = persistentHistories?.get(game.universeId);
    const usingStoredHistory = Boolean(storedHistory?.length);
    const history = usingStoredHistory ? storedHistory! : getPreviewFixtureHistory(game);
    const interval = usingStoredHistory ? 60 : previewFixtureEnabled() ? 360 : 60;
    return {
      game,
      change24h: historyFreshness(history, now, interval).fresh ? changeForWindow(history, 24, interval) : null,
      trend: computeTrend(game.universeId, history, game.sourceUpdatedAt, now, interval),
    };
  });
  const rows = evaluated
    .filter(({ trend }) => trend.eligible && (trend.metrics.relativeGrowth ?? 0) > 0 && (trend.metrics.absoluteMomentum ?? 0) > 0)
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0));
  const empty = risingEmptyState(
    evaluated.map(row => row.trend),
    historyReadFailed || (persistentHistories === null && !previewFixtureEnabled()),
  );
  const risingUniverseIds = new Set(rows.map(({ game }) => game.universeId));
  const fallbackRows = games
    .filter(game => game.playing != null && game.freshnessState !== "unavailable" && (game.heroImageUrl || game.thumbnailUrl) && !risingUniverseIds.has(game.universeId))
    .sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1))
    .slice(0, 8);
  const displayFallback = rows.length === 0;

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <div className="media-page-head">
          <h1>상승 중</h1>
          <span>최근 인원 변화와 플레이 규모를 함께 반영한 순서입니다.</span>
        </div>
        {displayFallback && (
          <div className="rising-fallback-note" data-trend-state={empty.kind} role="status">
            <strong>지금은 상승 판정 대신 인기 게임을 보여드려요.</strong>
            <span>{empty.message} 현재 플레이 인원이 확인되는 게임을 대신 정렬했습니다.</span>
          </div>
        )}
        <div className="visual-card-grid visual-card-grid-3">
          {(rows.length ? rows : fallbackRows).map((row, index) => {
            const game = "game" in row ? row.game : row;
            const trend = "trend" in row ? row.trend : null;
            const change24h = "change24h" in row ? row.change24h : undefined;
            return (
              <GameVisualCard
                key={game.universeId}
                game={game}
                rank={index + 1}
                change24h={change24h}
                badge={displayFallback ? "지금 인기" : trend?.score == null ? "상승 확인" : "상승 " + trend.score.toFixed(0)}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}

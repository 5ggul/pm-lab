import type { Metadata } from "next";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import { getGameCatalog } from "@/lib/catalog";
import { getPreviewFixtureHistory, previewFixtureEnabled } from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";
import { recentRiseBadge, recentRiseSignal } from "@/lib/recent-rise";
import { risingEmptyState } from "@/lib/rising-empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "최근 상승 신호",
  description: "1H·6H·24H 중 비교 가능한 최근 관측에서 플레이 인원이 늘어난 Roblox 게임을 확인합니다.",
  alternates: { canonical: "/rising" },
  robots: { index: false, follow: true },
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
  const latestFetchedAt = games.map(game => game.fetchedAt).filter(Boolean).sort().at(-1);
  const evaluated = games.map(game => {
    const storedHistory = persistentHistories?.get(game.universeId);
    const usingStoredHistory = Boolean(storedHistory?.length);
    const history = usingStoredHistory ? storedHistory! : getPreviewFixtureHistory(game);
    const interval = usingStoredHistory ? 60 : previewFixtureEnabled() ? 360 : 60;
    return {
      game,
      trend: computeTrend(game.universeId, history, game.sourceUpdatedAt, now, interval),
      recentRise: recentRiseSignal(history, interval),
    };
  });
  const rows = evaluated
    .filter((row) => row.trend.eligible && row.recentRise != null)
    .sort((a, b) => (b.recentRise?.score ?? 0) - (a.recentRise?.score ?? 0));
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
          <div>
            <h1>최근 상승 신호</h1>
            <span>1H·6H·24H 중 비교 가능한 최근 관측과 플레이 규모를 함께 반영합니다.</span>
          </div>
          {latestFetchedAt && <span className="rising-data-stamp"><b>최신 데이터</b>{new Date(latestFetchedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}
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
            const recentRise = "recentRise" in row ? row.recentRise : null;
            return (
              <GameVisualCard
                key={game.universeId}
                game={game}
                rank={index + 1}
                badge={displayFallback ? "지금 인기" : recentRise ? recentRiseBadge(recentRise) : "상승 확인"}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}

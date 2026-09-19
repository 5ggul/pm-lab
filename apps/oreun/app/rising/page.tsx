import type { Metadata } from "next";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import { getGameCatalog } from "@/lib/catalog";
import {
  getPreviewFixtureHistory,
  previewFixtureEnabled,
} from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "급상승 게임",
  description: "Roblox 게임의 최근 플레이어 변화와 데이터 커버리지를 함께 확인합니다.",
  alternates: { canonical: "/rising" },
};

export default async function Rising() {
  const games = await getGameCatalog();
  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  try {
    persistentHistories = await getPersistentHistories(
      games.map((game) => game.universeId),
      168,
    );
  } catch {
    persistentHistories = null;
  }

  const rows = games
    .map((game) => {
      const storedHistory = persistentHistories?.get(game.universeId);
      const usingStoredHistory = Boolean(storedHistory?.length);
      const history = usingStoredHistory
        ? storedHistory!
        : getPreviewFixtureHistory(game);
      const interval = usingStoredHistory
        ? 60
        : previewFixtureEnabled()
          ? 360
          : 60;
      return {
        game,
        trend: computeTrend(
          game.universeId,
          history,
          game.sourceUpdatedAt,
          new Date(),
          interval,
        ),
      };
    })
    .filter(({ trend }) => trend.eligible)
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0));

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <div className="media-page-head">
          <h1>급상승</h1>
          <span>최근 변화가 충분히 확인된 게임만</span>
        </div>

        {rows.length ? (
          <div className="visual-card-grid visual-card-grid-3">
            {rows.map(({ game, trend }, index) => (
              <GameVisualCard
                key={game.universeId}
                game={game}
                rank={index + 1}
                badge={
                  trend.metrics.relativeGrowth == null
                    ? "UP"
                    : (trend.metrics.relativeGrowth >= 0 ? "▲ " : "▼ ") +
                      Math.abs(trend.metrics.relativeGrowth * 100).toFixed(1) +
                      "%"
                }
              />
            ))}
          </div>
        ) : (
          <div className="media-empty">급상승 데이터 수집 중</div>
        )}
      </main>
    </>
  );
}

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
  title: "상승 중인 게임",
  description: "최근 관측에서 플레이 인원이 늘어난 Roblox 게임을 확인합니다.",
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
    .filter(({ trend }) => trend.eligible && (trend.metrics.relativeGrowth ?? 0) > 0 && (trend.metrics.absoluteMomentum ?? 0) > 0)
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0));

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <div className="media-page-head">
          <h1>상승 중</h1>
          <span>최근 구간에서 플레이 인원이 늘고 데이터가 충분한 게임</span>
        </div>

        {rows.length ? (
          <div className="visual-card-grid visual-card-grid-3">
            {rows.map(({ game, trend }, index) => (
              <GameVisualCard
                key={game.universeId}
                game={game}
                rank={index + 1}
                badge={trend.score == null ? undefined : "점수 " + trend.score.toFixed(0)}
              />
            ))}
          </div>
        ) : (
          <div className="media-empty">상승 데이터를 더 모으는 중</div>
        )}
      </main>
    </>
  );
}

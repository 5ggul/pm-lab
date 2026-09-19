import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import { getGameCatalog } from "@/lib/catalog";
import {
  getPreviewFixtureHistory,
  previewFixtureEnabled,
} from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";
import { compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "급상승 게임",
  description:
    "절대 모멘텀, 상대 성장, 기준 플레이 규모, 데이터 커버리지를 함께 보는 오름 급상승 순위입니다.",
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
        <div className="page-title">
          <h1>급상승</h1>
          <p>
            인기 순위와 별개입니다. 작은 기준값의 퍼센트 폭등이 전체 순위를
            지배하지 않도록 보정합니다.{" "}
            <Link href="/methodology">산정 기준 →</Link>
          </p>
        </div>

        {rows.length ? (
          <div className="trend-grid">
            {rows.map(({ game, trend }, index) => (
              <Link
                className="trend-card"
                href={`/game/${game.slug}`}
                key={game.universeId}
              >
                <div className="topline">
                  <span>
                    #{index + 1} · {trend.confidence}
                  </span>
                  <span>{compactNumber(game.playing)}명</span>
                </div>
                <h3>{game.nameKo}</h3>
                <div className="score">{trend.score}</div>
                <p>{trend.reason}</p>
                <p>
                  Coverage {(trend.metrics.coverageRatio * 100).toFixed(0)}% ·
                  계산 {trend.calculationVersion}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-data">
            <strong>아직 순위를 만들 수 없습니다.</strong>
            <p>
              최소 시계열 커버리지를 충족한 게임만 급상승 순위에 들어갑니다.
              {persistentHistories
                ? " 실제 Rollup을 수집 중입니다."
                : !previewFixtureEnabled()
                  ? " 현재 Preview는 실제 수집 연결 전이라 정상적으로 비어 있습니다."
                  : ""}
            </p>
          </div>
        )}
      </main>
    </>
  );
}

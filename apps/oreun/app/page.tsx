import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import { getGameCatalog } from "@/lib/catalog";
import {
  getPreviewFixtureHistory,
  previewFixtureEnabled,
} from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";
import { compactNumber, formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const games = await getGameCatalog();
  const live = games
    .filter(
      (game) =>
        game.playing != null && game.freshnessState !== "unavailable",
    )
    .sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1));
  const featured = live.filter((game) => game.heroImageUrl).slice(0, 3);
  const latestFetchedAt = live
    .map((game) => game.fetchedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  try {
    persistentHistories = await getPersistentHistories(
      games.map((game) => game.universeId),
      168,
    );
  } catch {
    persistentHistories = null;
  }

  const trends = games
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
    .filter(({ trend, game }) => trend.eligible && Boolean(game.heroImageUrl))
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0))
    .slice(0, 6);

  const recentlyUpdated = live
    .filter((game) => game.heroImageUrl && game.experienceUpdatedAt)
    .sort(
      (a, b) =>
        new Date(b.experienceUpdatedAt!).getTime() -
        new Date(a.experienceUpdatedAt!).getTime(),
    )
    .slice(0, 8);

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page media-home">
        <div className="media-page-head">
          <h1>지금 뜨는 게임</h1>
          <span>
            {latestFetchedAt ? "갱신 " + formatKstDateTime(latestFetchedAt) : ""}
          </span>
        </div>

        {featured.length > 0 && (
          <section className="spotlight-grid">
            {featured.map((game, index) => (
              <Link
                className={index === 0 ? "spotlight-card spotlight-main" : "spotlight-card"}
                href={"/game/" + game.slug}
                key={game.universeId}
              >
                <img
                  src={game.heroImageUrl!}
                  alt=""
                  width={768}
                  height={432}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
                <div className="spotlight-shade" />
                <div className="spotlight-copy">
                  <div className="spotlight-tags">
                    {game.genreL1 && <span>{game.genreL1}</span>}
                    {(game.mediaVideos?.length ?? 0) > 0 && <span>▶ VIDEO</span>}
                  </div>
                  <strong>{game.nameKo}</strong>
                  <b>{compactNumber(game.playing)}명</b>
                </div>
              </Link>
            ))}
          </section>
        )}

        <SearchBox games={games} />

        <section>
          <div className="section-head">
            <h2>실시간 TOP</h2>
            <Link href="/games">전체 보기 →</Link>
          </div>
          <div className="visual-card-grid">
            {live.slice(3, 15).map((game, index) => (
              <GameVisualCard
                key={game.universeId}
                game={game}
                rank={index + 4}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>급상승</h2>
            <Link href="/rising">전체 보기 →</Link>
          </div>
          {trends.length > 0 ? (
            <div className="visual-card-grid visual-card-grid-3">
              {trends.map(({ game, trend }, index) => (
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
        </section>

        {recentlyUpdated.length > 0 && (
          <section>
            <div className="section-head">
              <h2>최근 업데이트</h2>
            </div>
            <div className="visual-card-grid">
              {recentlyUpdated.map((game) => (
                <GameVisualCard
                  key={game.universeId}
                  game={game}
                  badge={
                    game.experienceUpdatedAt
                      ? new Date(game.experienceUpdatedAt).toLocaleDateString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                        })
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

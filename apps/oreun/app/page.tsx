import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import GameTable from "@/components/GameTable";
import FixtureBanner from "@/components/FixtureBanner";
import { getGameCatalog } from "@/lib/catalog";
import {
  getPreviewFixtureHistory,
  previewFixtureEnabled,
} from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const games = await getGameCatalog();
  const live = [...games].sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1));
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
    .filter(({ trend }) => trend.eligible)
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0))
    .slice(0, 4);

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <section className="hero">
          <div>
            <span className="eyebrow">OREUN · DATA PREVIEW</span>
            <h1>
              지금 어떤 게임이
              <br />
              뜨고 있을까?
            </h1>
            <p>
              현재 플레이 인원은 공개 Roblox 경험 데이터를 기록한 최근
              Snapshot을 우선 사용합니다. 과거 기록이 충분하지 않으면 증감률을
              만들지 않습니다.
            </p>
          </div>
          <div className="hero-side">
            <strong>
              {live.filter((game) => game.freshnessState === "fresh").length}
            </strong>
            <small>현재 fresh 상태 게임</small>
          </div>
        </section>

        <SearchBox games={games} />

        {trends.length > 0 ? (
          <section>
            <div className="section-head">
              <h2>급상승</h2>
              <Link href="/rising">전체 보기</Link>
            </div>
            <div className="trend-grid">
              {trends.map(({ game, trend }, index) => (
                <Link
                  className="trend-card"
                  key={game.universeId}
                  href={`/game/${game.slug}`}
                >
                  <div className="topline">
                    <span>#{index + 1}</span>
                    <span>{trend.confidence.toUpperCase()}</span>
                  </div>
                  <h3>{game.nameKo}</h3>
                  <div className="score">{trend.score}</div>
                  <p>{trend.reason}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="no-data">
            <strong>급상승 데이터 수집 중</strong>
            <p>
              오름은 실제 시간대와 Rollup coverage가 충분히 쌓이기 전에는
              급상승 점수를 만들지 않습니다.
              {!persistentHistories &&
                !previewFixtureEnabled() &&
                " 개발 Preview에서 R1_PREVIEW_FIXTURES=1일 때만 QA용 시계열을 볼 수 있습니다."}
            </p>
            <Link href="/methodology">산정 기준 보기 →</Link>
          </section>
        )}

        <GameTable games={live.slice(0, 10)} title="지금 플레이" />

        <div className="section-head">
          <h2>숫자를 믿을 수 있게</h2>
          <Link href="/methodology">산정 기준</Link>
        </div>
        <p style={{ color: "var(--muted)", maxWidth: 700 }}>
          오름은 현재값, Raw Snapshot, Rollup, 오름 계산값을 구분합니다. 갱신이
          늦으면 그대로 표시하고, 데이터가 없는 구간을 0명으로 채우지 않습니다.
        </p>
      </main>
    </>
  );
}

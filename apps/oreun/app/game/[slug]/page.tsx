import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import GameGlyph from "@/components/GameGlyph";
import HistoryChart from "@/components/HistoryChart";
import FreshnessBadge from "@/components/FreshnessBadge";
import FixtureBanner from "@/components/FixtureBanner";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getPreviewFixtureHistory, previewFixtureEnabled } from "@/lib/history";
import { changeForWindow } from "@/lib/metrics";
import { compactNumber, formatKstDateTime, pct, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  return {
    title: `${game.nameKo} 현재 플레이 인원·기록`,
    description: `${game.nameKo}의 현재 플레이 인원, 데이터 갱신 상태와 오름 Historical Data 수집 상태를 확인합니다.`,
    alternates: { canonical: `/game/${game.slug}` },
    robots:
      game.indexState === "indexable"
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [game, games] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
  ]);
  if (!game) notFound();

  const history = getPreviewFixtureHistory(game);
  const c1 = changeForWindow(history, 1);
  const c24 = changeForWindow(history, 24);
  const c7 = changeForWindow(history, 168);

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <section className="game-hero">
          <div className="game-search">
            <SearchBox games={games} />
          </div>
          <div className="breadcrumb">
            <Link href="/games">게임</Link> / {game.nameKo}
          </div>
          <div className="title-lockup">
            <GameGlyph name={game.nameKo} />
            <div>
              <h1>{game.nameKo}</h1>
              <div className="english-name">{game.name}</div>
            </div>
          </div>
          <div className="live-number">
            {game.playing == null
              ? "—"
              : `지금 ${compactNumber(game.playing)}명 플레이 중`}
          </div>
          <div className="live-meta">
            <span>
              {game.fetchedAt ? relativeTime(game.fetchedAt) : "확인 시각 없음"} 확인
            </span>
            <FreshnessBadge state={game.freshnessState} />
          </div>
          <div className="stats-strip">
            <div className="stat">
              <strong>{pct(c1)}</strong>
              <small>1시간</small>
            </div>
            <div className="stat">
              <strong>{pct(c24)}</strong>
              <small>24시간</small>
            </div>
            <div className="stat">
              <strong>{pct(c7)}</strong>
              <small>7일</small>
            </div>
          </div>
          <div className="actions">
            <a
              className="primary-action"
              href={`https://www.roblox.com/games/${game.rootPlaceId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Roblox에서 플레이 ↗
            </a>
          </div>
        </section>

        {game.freshnessState !== "fresh" && (
          <div className="callout">
            <strong>
              {game.freshnessState === "unavailable"
                ? "현재 데이터를 불러올 수 없습니다."
                : "현재 데이터 갱신이 지연되고 있습니다."}
            </strong>
            {game.sourceStatus === "fallback" && (
              <>
                <br />
                화면의 현재값은 마지막으로 검증된 fallback snapshot이며 실시간
                수치가 아닙니다.
              </>
            )}
          </div>
        )}

        <div className="content-grid">
          <section>
            <div className="section-head">
              <h2>플레이 인원 기록</h2>
            </div>
            <HistoryChart
              points={history}
              expectedIntervalMinutes={previewFixtureEnabled() ? 360 : 60}
              updateAt={game.sourceUpdatedAt}
            />
            <div className="source-box">
              <strong>출처</strong> · 공개 Roblox 경험 데이터 기반
              <br />
              Provider: {game.sourceProvider} · fetched_at:{" "}
              {formatKstDateTime(game.fetchedAt)}
              <br />
              현재값:{" "}
              {game.sourceStatus === "live"
                ? "실시간 Provider 응답"
                : "fallback snapshot"}
            </div>
            <div className="section-head">
              <h2>게임 정보</h2>
            </div>
            <p>{game.descriptionKo}</p>
          </section>
          <aside className="aside-panel">
            <h3>현재 데이터</h3>
            <p>
              방문 {compactNumber(game.visits)}
              <br />
              즐겨찾기 {compactNumber(game.favorites)}
              <br />
              제작 {game.creatorName}
            </p>
            <h3>색인 상태</h3>
            <p>
              {game.indexState}. 과거 데이터와 고유 콘텐츠 조건을 충족하기
              전에는 자동 색인하지 않습니다.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}

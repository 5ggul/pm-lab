import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { toggleFollowAction } from "@/app/actions/community";
import SearchBox from "@/components/SearchBox";
import GameGlyph from "@/components/GameGlyph";
import HistoryChart from "@/components/HistoryChart";
import FreshnessBadge from "@/components/FreshnessBadge";
import FixtureBanner from "@/components/FixtureBanner";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getOwnFollow, getQuestionFeed, type QuestionFeedRow } from "@/lib/community/queries";
import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";
import {
  getPreviewFixtureHistory,
  previewFixtureEnabled,
} from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { changeForWindow } from "@/lib/metrics";
import {
  compactNumber,
  formatKstDateTime,
  pct,
  relativeTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const current =
    game.playing == null ? "현재 플레이 인원 확인 중" : `현재 ${compactNumber(game.playing)}명 플레이`;
  const checked = game.fetchedAt ? formatKstDateTime(game.fetchedAt) : "확인 시각 없음";
  const description = `${game.nameKo} · ${current} · 마지막 확인 ${checked}. 오름 Historical Data와 데이터 갱신 상태를 확인합니다.`;
  return {
    title: `${game.nameKo} 현재 플레이 인원·기록`,
    description,
    alternates: { canonical: `/game/${game.slug}` },
    openGraph: {
      type: "website",
      title: `${game.nameKo} 현재 플레이 인원·기록`,
      description,
      url: `/game/${game.slug}`,
      images: [{ url: `/game/${game.slug}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.nameKo} 현재 플레이 인원·기록`,
      description,
      images: [`/game/${game.slug}/opengraph-image`],
    },
    robots:
      isIndexingReleased() && game.indexState === "indexable"
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
  const [game, games, user, token] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!game) notFound();

  let communityQuestions: QuestionFeedRow[] = [];
  let following = false;
  try {
    communityQuestions = await getQuestionFeed({
      gameUniverseId: game.universeId,
      limit: 4,
    });
    if (user && token) {
      following = await getOwnFollow(token, user.id, game.universeId);
    }
  } catch {
    communityQuestions = [];
    following = false;
  }

  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  try {
    persistentHistories = await getPersistentHistories([game.universeId], 2160);
  } catch {
    persistentHistories = null;
  }

  const storedHistory = persistentHistories?.get(game.universeId);
  const usingStoredHistory = Boolean(storedHistory?.length);
  const history = usingStoredHistory
    ? storedHistory!
    : getPreviewFixtureHistory(game);
  const expectedIntervalMinutes = usingStoredHistory
    ? 60
    : previewFixtureEnabled()
      ? 360
      : 60;

  const c1 = changeForWindow(history, 1);
  const c24 = changeForWindow(history, 24);
  const c7 = changeForWindow(history, 168);

  const currentSource =
    game.sourceStatus === "live"
      ? "직접 Provider 응답"
      : game.sourceStatus === "stored"
        ? "오름 저장 Snapshot"
        : "fallback snapshot";

  const base =
    getPublicSiteUrl() ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const videoGameJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    alternateName: game.nameKo,
    description: game.descriptionKo,
    url: `${base}/game/${game.slug}`,
    image: game.thumbnailUrl ?? undefined,
    gamePlatform: "Roblox",
    author: {
      "@type": "Organization",
      name: game.creatorName,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "오름",
      url: base,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoGameJsonLd) }}
      />
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
            <GameGlyph name={game.nameKo} thumbnailUrl={game.thumbnailUrl} />
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
            <Link
              className="secondary-button"
              href={`/game/${game.slug}/questions`}
            >
              질문·답변
            </Link>
            <form action={toggleFollowAction}>
              <input type="hidden" name="universe_id" value={game.universeId} />
              <input type="hidden" name="game_slug" value={game.slug} />
              <button type="submit" className="secondary-button">
                {following ? "팔로우 중" : "팔로우"}
              </button>
            </form>
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
              expectedIntervalMinutes={expectedIntervalMinutes}
              updateAt={game.sourceUpdatedAt}
            />
            <div className="source-box">
              <strong>출처</strong> · 공개 Roblox 경험 데이터 기반
              <br />
              Provider: {game.sourceProvider} · fetched_at:{" "}
              {formatKstDateTime(game.fetchedAt)}
              <br />
              현재값: {currentSource}
              <br />
              시계열:{" "}
              {usingStoredHistory
                ? "오름 Hourly Rollup"
                : previewFixtureEnabled()
                  ? "개발용 Preview Fixture"
                  : "데이터 수집 중"}
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
              {game.indexState}. 과거 데이터와 고유 콘텐츠 조건을 충족하기 전에는
              자동 색인하지 않습니다.
            </p>
          </aside>
        </div>

        <section id="community" className="game-community">
          <div className="section-head">
            <h2>{game.nameKo} Q&A</h2>
            <Link href={`/game/${game.slug}/questions`}>
              전체 질문 보기 →
            </Link>
          </div>
          {communityQuestions.length ? (
            <div className="question-list compact-list">
              {communityQuestions.map((question) => (
                <article className="question-row" key={question.id}>
                  <div>
                    <h3>
                      <Link href={`/questions/${question.id}`}>
                        {question.title}
                      </Link>
                    </h3>
                    <div className="community-meta">
                      {question.author_name} · 답변 {question.answer_count}개
                    </div>
                  </div>
                  <span className="question-state">
                    {question.status === "answered"
                      ? "답변 채택"
                      : question.status === "closed"
                        ? "닫힘"
                        : "진행 중"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <strong>아직 등록된 질문이 없습니다.</strong>
              <p>
                <Link href={`/game/${game.slug}/questions`}>
                  첫 질문 남기기 →
                </Link>
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

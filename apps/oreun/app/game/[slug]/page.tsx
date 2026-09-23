import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { toggleFollowAction } from "@/app/actions/community";
import HistoryChart from "@/components/HistoryChart";
import FreshnessBadge from "@/components/FreshnessBadge";
import FixtureBanner from "@/components/FixtureBanner";
import GameMediaGallery from "@/components/GameMediaGallery";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getOwnFollow, getQuestionFeed, type QuestionFeedRow } from "@/lib/community/queries";
import { getPublishedCodes, getPublishedGuides, getUpdateEvents } from "@/lib/content/queries";
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";
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

const NON_EDITORIAL_SUMMARY_PHRASES = [
  "기록합니다",
  "추적합니다",
  "수집 후보입니다",
  "현재 플레이 규모를 확인합니다",
];

function verifiedEditorialSummary(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  return NON_EDITORIAL_SUMMARY_PHRASES.some((phrase) => text.includes(phrase))
    ? null
    : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const current =
    game.playing == null ? "현재 플레이 인원 확인 중" : "현재 " + compactNumber(game.playing) + "명 플레이";
  const checked = game.fetchedAt ? formatKstDateTime(game.fetchedAt) : "확인 시각 없음";
  const description = game.nameKo + " · " + current + " · 마지막 확인 " + checked;
  return {
    title: game.nameKo + " 현재 플레이 인원·기록",
    description,
    alternates: { canonical: "/game/" + game.slug },
    openGraph: {
      type: "website",
      title: game.nameKo + " 현재 플레이 인원·기록",
      description,
      url: "/game/" + game.slug,
      images: [{ url: "/game/" + game.slug + "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: game.nameKo + " 현재 플레이 인원·기록",
      description,
      images: ["/game/" + game.slug + "/opengraph-image"],
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

  const [publishedGuides, publishedCodes, updateEvents] = await Promise.all([
    getPublishedGuides(game.universeId).catch(() => []),
    getPublishedCodes(game.universeId).catch(() => []),
    getUpdateEvents(game.universeId, 20).catch(() => []),
  ]);

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

  const c1 = game.playing == null ? null : changeForWindow(history, 1, expectedIntervalMinutes);
  const c24 = game.playing == null ? null : changeForWindow(history, 24, expectedIntervalMinutes);
  const c7 = game.playing == null ? null : changeForWindow(history, 168, expectedIntervalMinutes);
  const base = getRenderingSiteUrl();
  const heroImage = game.heroImageUrl ?? game.thumbnailUrl;
  const robloxUrl = "https://www.roblox.com/games/" + game.rootPlaceId;
  const editorialSummary = verifiedEditorialSummary(game.descriptionKo);
  const officialDescription = game.description?.trim() || null;
  const isKrRestricted = game.regionalAvailability === "restricted_kr";

  const videoGameJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    alternateName: game.nameKo,
    description: game.description || game.descriptionKo,
    url: base + "/game/" + game.slug,
    image: heroImage ?? undefined,
    gamePlatform: "Roblox",
    author: {
      "@type": game.creatorType === "User" ? "Person" : "Organization",
      name: game.creatorName,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "로블잼",
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
      <main className="page media-game-page">
        <section className="media-game-hero">
          {heroImage && (
            <img
              className="media-game-hero-bg"
              src={heroImage}
              alt=""
              width={768}
              height={432}
              fetchPriority="high"
            />
          )}
          <div className="media-game-hero-shade" />
          <div className="media-game-hero-copy">
            <div className="media-game-tags">
              {game.genreL1 && <span>{game.genreL1}</span>}
              {game.genreL2 && <span>{game.genreL2}</span>}
              {(game.mediaVideos?.length ?? 0) > 0 && <span>▶ VIDEO</span>}
            </div>
            <h1>{game.nameKo}</h1>
            <div className="media-game-live">
              {isKrRestricted
                ? "한국 이용 제한"
                : game.playing == null
                  ? "현재 플레이 인원 확인 불가"
                  : compactNumber(game.playing) + "명 플레이 중"}
            </div>
            <div className="media-game-refresh">
              <FreshnessBadge state={game.freshnessState} />
              <span>{game.fetchedAt ? relativeTime(game.fetchedAt) : "확인 시각 없음"}</span>
            </div>
            <div className="actions">
              <a
                className="primary-action"
                href={robloxUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {isKrRestricted ? "Roblox 게임 페이지 보기 ↗" : "Roblox에서 플레이 ↗"}
              </a>
              <Link className="secondary-button" href={"/game/" + game.slug + "/guides"}>공략</Link>
              <Link className="secondary-button" href={"/game/" + game.slug + "/questions"}>
                질문
              </Link>
              <Link className="secondary-button" href={"/game/" + game.slug + "/party"}>
                파티
              </Link>
              <form action={toggleFollowAction}>
                <input type="hidden" name="universe_id" value={game.universeId} />
                <input type="hidden" name="game_slug" value={game.slug} />
                <button type="submit" className="secondary-button">
                  {following ? "팔로우 중" : "팔로우"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="media-fact-strip">
          <div>
            <strong title={game.visits == null ? undefined : game.visits.toLocaleString("ko-KR") + "회"}>
              {compactNumber(game.visits)}
            </strong>
            <small>방문</small>
          </div>
          <div>
            <strong title={game.favorites == null ? undefined : game.favorites.toLocaleString("ko-KR") + "회"}>
              {compactNumber(game.favorites)}
            </strong>
            <small>즐겨찾기</small>
          </div>
          <div><strong>{game.maxPlayers == null ? "—" : game.maxPlayers + "명"}</strong><small>최대 인원</small></div>
          <div><strong>{game.creatorName}</strong><small>제작자{game.creatorVerified ? " ✓" : ""}</small></div>
          <div><strong>{game.experienceUpdatedAt ? new Date(game.experienceUpdatedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "—"}</strong><small>업데이트</small></div>
        </div>

        {game.freshnessState !== "fresh" && (
          <div className="callout">
            {game.fallbackReason ??
              (game.freshnessState === "unavailable"
                ? "Roblox 공개 API에서 현재 플레이 인원을 확인할 수 없습니다."
                : "현재값 갱신이 지연되고 있습니다.")}
          </div>
        )}

        <div className="media-detail-grid">
          <section>
            {editorialSummary && (
              <>
                <div className="section-head">
                  <h2>게임 소개</h2>
                </div>
                <p className="game-editorial-summary">{editorialSummary}</p>
                <div className="game-editorial-source">
                  <span>Roblox 게임 설명</span>
                  <a href={robloxUrl} target="_blank" rel="noopener noreferrer">
                    원문 보기 ↗
                  </a>
                  {game.fetchedAt && (
                    <small>데이터 확인 {formatKstDateTime(game.fetchedAt)}</small>
                  )}
                </div>
              </>
            )}

            {(game.mediaImages?.length ?? 0) + (game.mediaVideos?.length ?? 0) > 0 && (
              <>
                <div className="section-head">
                  <h2>미디어</h2>
                  <span>
                    {game.mediaImages?.length ?? 0} images · {game.mediaVideos?.length ?? 0} videos
                  </span>
                </div>
                <GameMediaGallery
                  universeId={game.universeId}
                  heroImageUrl={game.heroImageUrl}
                  robloxUrl={robloxUrl}
                  images={game.mediaImages ?? []}
                  videos={game.mediaVideos ?? []}
                />
              </>
            )}

            <div className="section-head">
              <h2>플레이어 추이</h2>
              <span>
                1H {pct(c1)} · 24H {pct(c24)} · 7D {pct(c7)}
              </span>
            </div>
            {isKrRestricted && (
              <p className="game-editorial-summary">
                현재 한국 리전에서는 이용 제한 상태입니다. 아래 그래프는 제한 상태가 확인되기 전까지
                정상적으로 관측된 과거 구간만 참고용으로 보여줍니다.
              </p>
            )}
            <HistoryChart
              points={history}
              expectedIntervalMinutes={expectedIntervalMinutes}
              updateAt={game.sourceUpdatedAt}
            />

            {updateEvents.length > 0 && (
              <>
                <div className="section-head">
                  <h2>최근 업데이트</h2>
                  <Link href={"/game/" + game.slug + "/updates"}>전체 기록 →</Link>
                </div>
                <div className="compact-update-list">
                  {updateEvents
                    .filter((event) => event.event_kind === "provider_update_detected")
                    .slice(0, 3)
                    .map((event) => (
                      <Link href={"/game/" + game.slug + "/updates"} key={event.id}>
                        <strong>업데이트 시각 변경 감지</strong>
                        <span>{formatKstDateTime(event.source_updated_at)}</span>
                      </Link>
                    ))}
                </div>
              </>
            )}

            {officialDescription && (
              <>
                <div className="section-head">
                  <h2>공식 게임 설명</h2>
                </div>
                <p className="official-game-description">{officialDescription}</p>
              </>
            )}
          </section>

          <aside className="media-detail-aside">
            <div>
              <strong>장르</strong>
              <p>{[game.genreL1, game.genreL2].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <div>
              <strong>제작</strong>
              <p>{game.creatorName}{game.creatorVerified ? " ✓" : ""}</p>
            </div>
            <div>
              <strong>출시</strong>
              <p>{game.experienceCreatedAt ? new Date(game.experienceCreatedAt).toLocaleDateString("ko-KR") : "—"}</p>
            </div>
            <div>
              <strong>데이터</strong>
              <p>
                Roblox 공개 API
                <br />
                {formatKstDateTime(game.fetchedAt)}
              </p>
            </div>
          </aside>
        </div>

        <section className="game-content-hub">
          <div className="section-head">
            <h2>더 보기</h2>
          </div>
          <div className="content-link-grid">
            {publishedCodes.length > 0 && (
              <Link className="content-link-card" href={"/game/" + game.slug + "/codes"}>
                
                <strong>코드</strong>
                <small>
                  {publishedCodes.filter((code) => code.code_status === "active").length}개 활성
                </small>
              </Link>
            )}
            {publishedGuides.length > 0 && (
              <Link className="content-link-card" href={"/game/" + game.slug + "/guides"}>
                
                <strong>공략</strong>
                <small>{publishedGuides.length}개 공개</small>
              </Link>
            )}
            {updateEvents.length > 0 && (
              <Link className="content-link-card" href={"/game/" + game.slug + "/updates"}>
                
                <strong>업데이트</strong>
                <small>
                  {updateEvents.filter((event) => event.event_kind === "provider_update_detected").length}개 감지
                </small>
              </Link>
            )}
            <Link className="content-link-card" href={"/game/" + game.slug + "/party"}>
              
              <strong>파티 모집</strong>
              <small>같이 플레이할 사람 찾기</small>
            </Link>
          </div>
        </section>

        <section id="community" className="game-community">
          <div className="section-head">
            <h2>질문</h2>
            <Link href={"/game/" + game.slug + "/questions"}>전체 보기 →</Link>
          </div>
          {communityQuestions.length ? (
            <div className="question-list compact-list">
              {communityQuestions.map((question) => (
                <article className="question-row" key={question.id}>
                  <div>
                    <h3>
                      <Link href={"/questions/" + question.id}>{question.title}</Link>
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
              <strong>첫 질문을 남겨보세요.</strong>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

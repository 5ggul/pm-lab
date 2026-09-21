import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import GameMediaGallery from "@/components/GameMediaGallery";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuide,
} from "@/lib/content/queries";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { compactNumber, formatKstDateTime } from "@/lib/format";
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; guideSlug: string }>;
}): Promise<Metadata> {
  const { slug, guideSlug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const guide = await getPublishedGuide(game.universeId, guideSlug).catch(
    () => null,
  );
  if (!guide) return {};

  const ready =
    isIndexingReleased() &&
    game.indexState === "indexable" &&
    guide.index_state === "indexable";

  return {
    title: guide.title,
    description: guide.summary,
    alternates: {
      canonical: `/game/${game.slug}/guides/${guide.slug}`,
    },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string; guideSlug: string }>;
}) {
  const { slug, guideSlug } = await params;
  const [game, games] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
  ]);
  if (!game) notFound();

  const [guide, sources] = await Promise.all([
    getPublishedGuide(game.universeId, guideSlug).catch(() => null),
    getContentSources(game.universeId).catch(() => []),
  ]);
  if (!guide) notFound();
  const source = guide.source_id
    ? sources.find((row) => row.id === guide.source_id)
    : null;
  const paragraphs = guide.body
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const heroImage = game.heroImageUrl ?? game.thumbnailUrl;
  const robloxUrl = "https://www.roblox.com/games/" + game.rootPlaceId;
  const officialMediaCount =
    (game.mediaImages?.length ?? 0) + (game.mediaVideos?.length ?? 0);
  const base = getRenderingSiteUrl();
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    datePublished: guide.published_at ?? guide.created_at,
    dateModified: guide.updated_at,
    mainEntityOfPage:
      base + "/game/" + game.slug + "/guides/" + guide.slug,
    image: heroImage ? [heroImage] : undefined,
    about: {
      "@type": "VideoGame",
      name: game.nameKo,
      url: base + "/game/" + game.slug,
      gamePlatform: "Roblox",
    },
    citation: source?.source_url,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Header games={games} />
      <main className="page guide-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> /{" "}
          <Link href={`/game/${game.slug}/guides`}>가이드</Link>
        </div>

        <article className="guide-article">
          <header className="guide-hero">
            {heroImage && (
              <img
                className="guide-hero-image"
                src={heroImage}
                alt=""
                width={768}
                height={432}
                fetchPriority="high"
              />
            )}
            <div className="guide-hero-shade" />
            <div className="guide-hero-copy">
              <span className="eyebrow">
                {game.nameKo} · {getGuideTypeLabel(guide.guide_type)}
              </span>
              <h1>{guide.title}</h1>
              <p className="lead">{guide.summary}</p>
            </div>
          </header>

          <div className="guide-trust-strip">
            <div>
              <strong>공식 출처</strong>
              <small>{source ? source.label : "Roblox 공개 메타데이터"}</small>
            </div>
            <div>
              <strong>{formatKstDateTime(guide.reviewed_at ?? guide.updated_at)}</strong>
              <small>내용 검수</small>
            </div>
            <div>
              <strong>{officialMediaCount.toLocaleString("ko-KR")}개</strong>
              <small>공식 미디어</small>
            </div>
          </div>

          <section className="guide-answer">
            <span>핵심 답</span>
            <p>{guide.summary}</p>
          </section>

          <section className="guide-data-context">
            <div className="section-head">
              <h2>지금 확인되는 게임 정보</h2>
              <span>Roblox 공개 데이터</span>
            </div>
            <div className="status-grid">
              <div className="status-cell">
                <strong>
                  {game.freshnessState === "fresh" && game.playing != null
                    ? compactNumber(game.playing)
                    : "확인 불가"}
                </strong>
                <span>현재 접속자</span>
              </div>
              <div className="status-cell">
                <strong>
                  {game.maxPlayers != null
                    ? game.maxPlayers.toLocaleString("ko-KR")
                    : "—"}
                </strong>
                <span>서버 최대 인원</span>
              </div>
              <div className="status-cell">
                <strong>{game.genreL2 ?? game.genreL1 ?? game.genre ?? "—"}</strong>
                <span>공식 장르</span>
              </div>
              <div className="status-cell">
                <strong>{compactNumber(game.visits)}</strong>
                <span>누적 방문</span>
              </div>
            </div>
            <div className="source-box">
              <strong>데이터 기준</strong>
              <br />
              현재값 수집 {formatKstDateTime(game.fetchedAt || null)} · 공식 Experience
              업데이트 {formatKstDateTime(
                game.experienceUpdatedAt ?? game.sourceUpdatedAt,
              )}
              <br />
              <Link href={`/game/${game.slug}/updates`}>업데이트 감지 기록 보기 →</Link>
            </div>
          </section>

          {officialMediaCount > 0 && (
            <section className="guide-media-section">
              <div className="section-head">
                <h2>공식 이미지·영상</h2>
                <span>Roblox Experience 미디어</span>
              </div>
              <GameMediaGallery
                universeId={game.universeId}
                heroImageUrl={game.heroImageUrl}
                robloxUrl={robloxUrl}
                images={game.mediaImages ?? []}
                videos={game.mediaVideos ?? []}
                maxItems={6}
              />
            </section>
          )}

          <section className="guide-reading">
            <div className="section-head">
              <h2>공식 정보로 보는 핵심 포인트</h2>
              <span>{paragraphs.length}개 포인트</span>
            </div>
            <div className="guide-body">
              {paragraphs.map((paragraph, index) => (
                <section className="guide-point" key={index}>
                  <span>
                    POINT {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{paragraph}</p>
                </section>
              ))}
            </div>
          </section>

          <aside className="source-box guide-source-box">
            <strong>검수 기준</strong>
            <p>
              Roblox 공식 Experience 설명과 공개 메타데이터에서 직접 확인할
              수 있는 내용만 사용합니다. 경험담·티어·확률·시세처럼 별도
              검증이 필요한 정보는 추정해서 넣지 않습니다.
            </p>
            <div>
              마지막 편집 {formatKstDateTime(guide.updated_at)}
              {source && (
                <>
                  <br />
                  출처 확인 {formatKstDateTime(source.last_checked_at)} ·{" "}
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {source.label} ↗
                  </a>
                </>
              )}
            </div>
          </aside>

          <div className="guide-actions">
            <Link className="secondary-button" href={`/game/${game.slug}`}>
              {game.nameKo} 데이터 보기
            </Link>
            <a
              className="primary-action"
              href={robloxUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Roblox에서 플레이 ↗
            </a>
          </div>
        </article>
      </main>
    </>
  );
}

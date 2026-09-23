import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import GameMediaGallery from "@/components/GameMediaGallery";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuide,
  resolveGuideSource,
} from "@/lib/content/queries";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { publicGuideParagraphs } from "@/lib/content/public-guide";
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
  const guide = await getPublishedGuide(game.universeId, guideSlug).catch(() => null);
  if (!guide) return {};
  const description = publicGuideParagraphs(guide.body)[0] ?? guide.summary;
  const ready =
    isIndexingReleased() &&
    game.indexState === "indexable" &&
    guide.index_state === "indexable";
  const url = `/game/${game.slug}/guides/${guide.slug}`;
  const image = game.heroImageUrl ?? game.thumbnailUrl ?? undefined;

  return {
    title: guide.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: guide.title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: guide.title,
      description,
      images: image ? [image] : undefined,
    },
    robots: ready ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string; guideSlug: string }>;
}) {
  const { slug, guideSlug } = await params;
  const [game, games] = await Promise.all([getGameBySlug(slug), getGameCatalog()]);
  if (!game) notFound();

  const [guide, sources] = await Promise.all([
    getPublishedGuide(game.universeId, guideSlug).catch(() => null),
    getContentSources(game.universeId).catch(() => []),
  ]);
  if (!guide) notFound();

  const source = resolveGuideSource(guide, sources);
  const paragraphs = publicGuideParagraphs(guide.body);
  const heroImage = game.heroImageUrl ?? game.thumbnailUrl;
  const robloxUrl = "https://www.roblox.com/games/" + game.rootPlaceId;
  const officialMediaCount =
    (game.mediaImages?.length ?? 0) + (game.mediaVideos?.length ?? 0);
  const base = getRenderingSiteUrl();
  const pageUrl = base + "/game/" + game.slug + "/guides/" + guide.slug;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: paragraphs[0] ?? guide.summary,
    datePublished: guide.published_at ?? guide.created_at,
    dateModified: guide.updated_at,
    mainEntityOfPage: pageUrl,
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
          <Link href={`/game/${game.slug}/guides`}>공략</Link>
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
              <span className="eyebrow">{game.nameKo} · {getGuideTypeLabel(guide.guide_type)}</span>
              <h1>{guide.title}</h1>
            </div>
          </header>

          <div className="guide-trust-strip">
            <div>
              <strong>출처</strong>
              <small>{source ? source.label : "Roblox 게임 페이지"}</small>
            </div>
            <div>
              <strong>{formatKstDateTime(guide.reviewed_at ?? guide.updated_at)}</strong>
              <small>확인</small>
            </div>
            <div>
              <strong>{officialMediaCount.toLocaleString("ko-KR")}개</strong>
              <small>이미지·영상</small>
            </div>
          </div>

          <section className="guide-reading">
            <div className="guide-body plain-guide-body">
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </section>

          <section className="guide-question-next" aria-label="공략 다음 행동">
            <p>이 내용으로 해결되지 않았나요?</p>
            <Link className="secondary-button" href={`/game/${game.slug}/questions`}>{game.nameKo} 질문하기</Link>
          </section>

          {officialMediaCount > 0 && (
            <section className="guide-media-section">
              <div className="section-head"><h2>이미지·영상</h2></div>
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

          <section className="guide-data-context">
            <div className="section-head"><h2>현재 게임 정보</h2></div>
            <div className="status-grid">
              <div className="status-cell">
                <strong>{game.freshnessState === "fresh" && game.playing != null ? compactNumber(game.playing) : "확인 불가"}</strong>
                <span>플레이 인원</span>
              </div>
              <div className="status-cell">
                <strong>{game.maxPlayers != null ? game.maxPlayers.toLocaleString("ko-KR") : "—"}</strong>
                <span>서버 최대 인원</span>
              </div>
              <div className="status-cell">
                <strong>{game.genreL2 ?? game.genreL1 ?? game.genre ?? "—"}</strong>
                <span>장르</span>
              </div>
              <div className="status-cell">
                <strong>{compactNumber(game.visits)}</strong>
                <span>누적 방문</span>
              </div>
            </div>
            <div className="source-box">
              현재값 {formatKstDateTime(game.fetchedAt || null)} · 업데이트{" "}
              {formatKstDateTime(game.experienceUpdatedAt ?? game.sourceUpdatedAt)}
            </div>
          </section>

          <section className="guide-next-section">
            <div className="section-head"><h2>관련 메뉴</h2></div>
            <div className="guide-next-grid">
              <Link href={`/game/${game.slug}`}>
                <strong>게임 정보</strong>
                <small>현재 인원과 기록 보기</small>
              </Link>
              <Link href={`/game/${game.slug}/updates`}>
                <strong>업데이트</strong>
                <small>업데이트 시각 기록 보기</small>
              </Link>
              <Link href={`/game/${game.slug}/questions`}>
                <strong>질문하기</strong>
                <small>이 글로 해결되지 않은 내용 묻기</small>
              </Link>
            </div>
          </section>

          <aside className="source-box guide-source-box">
            <strong>출처</strong>
            <div>
              {source ? (
                <a href={source.source_url} target="_blank" rel="noopener noreferrer nofollow">
                  {source.label} ↗
                </a>
              ) : (
                "Roblox 게임 페이지"
              )}
              <br />
              내용 확인 {formatKstDateTime(guide.reviewed_at ?? guide.updated_at)} · 마지막 수정{" "}
              {formatKstDateTime(guide.updated_at)}
            </div>
          </aside>

          <div className="guide-actions">
            <Link className="secondary-button" href={`/game/${game.slug}/questions`}>
              {game.nameKo} 질문하기
            </Link>
            <a className="primary-action" href={robloxUrl} target="_blank" rel="noopener noreferrer">
              Roblox에서 플레이 ↗
            </a>
          </div>
        </article>
      </main>
    </>
  );
}

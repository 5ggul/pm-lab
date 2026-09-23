import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuides,
  resolveGuideSource,
} from "@/lib/content/queries";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const guides = await getPublishedGuides(game.universeId).catch(() => []);
  const ready =
    isIndexingReleased() &&
    game.indexState === "indexable" &&
    guides.some((guide) => guide.index_state === "indexable");

  return {
    title: `${game.nameKo} 공략`,
    description: `${game.nameKo} 기본 조작과 시작 방법을 확인하세요.`,
    alternates: { canonical: `/game/${game.slug}/guides` },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function GameGuidesPage({
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

  const [guides, sources] = await Promise.all([
    getPublishedGuides(game.universeId).catch(() => []),
    getContentSources(game.universeId).catch(() => []),
  ]);
  const heroImage = game.heroImageUrl ?? game.thumbnailUrl;
  const mediaImages = game.mediaImages ?? [];
  const videoCount = game.mediaVideos?.length ?? 0;
  const officialMediaCount =
    mediaImages.length + (game.mediaVideos?.length ?? 0);

  return (
    <>
      <Header games={games} />
      <main className="page content-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 공략
        </div>
        <div className="page-title">
          <h1>{game.nameKo} 공략</h1>
          <p>기본 조작과 시작 방법을 모았습니다. 출처와 확인일은 각 글에서 확인할 수 있습니다.</p>
        </div>

        <div className="guide-filter-result">
          <strong>{guides.length}개</strong>
          <span>공식 미디어 {officialMediaCount.toLocaleString("ko-KR")}개 연결</span>
        </div>

        {guides.length ? (
          <div className="guide-visual-grid">
            {guides.map((guide, index) => {
              const source = resolveGuideSource(guide, sources);
              const coverImage =
                (mediaImages.length > 0
                  ? mediaImages[index % mediaImages.length]?.url
                  : null) ?? heroImage;

              return (
                <article className="guide-visual-card" key={guide.id}>
                  <Link
                    className="guide-visual-cover"
                    href={`/game/${game.slug}/guides/${guide.slug}`}
                  >
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt=""
                        width={768}
                        height={432}
                        loading="lazy"
                      />
                    )}
                    <span>{game.nameKo}</span>
                    {videoCount > 0 && <b>▶ VIDEO</b>}
                  </Link>

                  <div className="guide-visual-copy">
                    <small>{getGuideTypeLabel(guide.guide_type)}</small>
                    <h2>
                      <Link href={`/game/${game.slug}/guides/${guide.slug}`}>
                        {guide.title}
                      </Link>
                    </h2>
                    <p>{guide.body.split(/\n\s*\n/)[0]?.trim() || guide.summary}</p>

                    <div className="guide-card-source">
                      {source ? (
                        <>
                          출처 확인 {formatKstDateTime(source.last_checked_at)} ·{" "}
                          <a
                            href={source.source_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                          >
                            {source.label} ↗
                          </a>
                        </>
                      ) : (
                        <>
                          확인{" "}
                          {formatKstDateTime(
                            guide.reviewed_at ?? guide.updated_at,
                          )}{" "}
                          · Roblox 공개 정보
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="no-data"><strong>아직 공개된 공략이 없습니다.</strong></div>
        )}
      </main>
    </>
  );
}

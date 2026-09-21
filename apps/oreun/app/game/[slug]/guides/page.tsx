import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuides,
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
    title: `${game.nameKo} 공략·가이드`,
    description: `${game.nameKo} 공략과 문제 해결 가이드를 검증 출처와 공식 이미지·영상과 함께 정리합니다.`,
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
  const sourceById = new Map(sources.map((source) => [source.id, source]));
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
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 가이드
        </div>
        <div className="page-title">
          <span className="eyebrow">EDITORIAL GUIDES</span>
          <h1>{game.nameKo} 공략·가이드</h1>
          <p>
            출처를 확인한 편집 콘텐츠만 공개합니다. 공식 Experience 설명과
            공개 메타데이터, 이미지·영상을 함께 보면서 핵심 내용을 확인할 수
            있습니다.
          </p>
        </div>

        <div className="guide-filter-result">
          <strong>{guides.length}개 가이드</strong>
          <span>공식 미디어 {officialMediaCount.toLocaleString("ko-KR")}개 연결</span>
        </div>

        {guides.length ? (
          <div className="guide-visual-grid">
            {guides.map((guide, index) => {
              const source = guide.source_id
                ? sourceById.get(guide.source_id)
                : null;
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
                    <p>{guide.summary}</p>

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
                          내용 검수{" "}
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
          <div className="no-data">
            <strong>아직 공개된 가이드가 없습니다.</strong>
            <p>
              데이터만으로 알 수 없는 플레이 팁을 자동으로 만들어 채우지
              않습니다.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

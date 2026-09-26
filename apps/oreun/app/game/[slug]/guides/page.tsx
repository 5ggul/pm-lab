import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ResilientGameImage from "@/components/ResilientGameImage";
import CommunityGuideComposer from "@/components/CommunityGuideComposer";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuides,
  resolveGuideSource,
} from "@/lib/content/queries";
import {
  getCommunityGuideFeed,
  getCommunityPermissions,
} from "@/lib/community/queries";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { writeAccess } from "@/lib/community/experience-model";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { publicGuideExcerpt } from "@/lib/content/public-guide";
import { formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";
import { getGameIndexEligibility } from "@/lib/index-eligibility";

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
  const parentReady = isIndexingReleased()
    ? (await getGameIndexEligibility(game)).eligible
    : false;
  const ready =
    parentReady &&
    guides.some((guide) => guide.index_state === "indexable");

  return {
    title: `${game.nameKo} 공략`,
    description: `${game.nameKo} 공식 확인 공략과 유저 공략을 함께 확인하세요.`,
    alternates: { canonical: `/game/${game.slug}/guides` },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function GameGuidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ write?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [game, games, user, token] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!game) notFound();

  const [guides, sources, communityGuides] = await Promise.all([
    getPublishedGuides(game.universeId).catch(() => []),
    getContentSources(game.universeId).catch(() => []),
    getCommunityGuideFeed({ gameUniverseId: game.universeId, limit: 40 }).catch(
      () => [],
    ),
  ]);
  const permissions = token
    ? await getCommunityPermissions(token).catch(() => null)
    : null;
  const access = writeAccess(Boolean(user && token), permissions);

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

        <div className="page-title guide-page-title">
          <div>
            <h1>{game.nameKo} 공략</h1>
            <p>
              공식 확인 공략과 플레이어가 직접 공유한 공략을 함께 볼 수 있어요.
            </p>
          </div>
          <Link
            className="primary-button"
            href={`/game/${game.slug}/guides?write=1#write`}
          >
            내 공략 올리기
          </Link>
        </div>

        <CommunityGuideComposer
          games={games}
          userId={user?.id ?? null}
          access={access}
          presetGameSlug={game.slug}
          open={query.write === "1"}
          next={`/game/${game.slug}/guides?write=1#write`}
        />

        <div className="guide-filter-result">
          <strong>{guides.length + communityGuides.length}개</strong>
          <span>
            공식 {guides.length} · 유저 {communityGuides.length} · 공식 미디어{" "}
            {officialMediaCount.toLocaleString("ko-KR")}개
          </span>
        </div>

        {communityGuides.length > 0 && (
          <section className="community-guide-section">
            <div className="section-head">
              <h2>유저 공략</h2>
              <span>플레이어가 직접 공유한 방법</span>
            </div>
            <div className="community-guide-grid">
              {communityGuides.map((guide) => (
                <Link
                  className="community-guide-card"
                  href={"/guides/community/" + guide.id}
                  key={guide.id}
                >
                  <div className="community-guide-card-meta">
                    <span>유저 공략</span>
                    <small>{getGuideTypeLabel(guide.guide_type)}</small>
                  </div>
                  <strong>{guide.title}</strong>
                  <p>{guide.body}</p>
                  <small>
                    {guide.author_name} · {formatKstDateTime(guide.created_at)}
                  </small>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="official-guide-section">
          <div className="section-head">
            <h2>공식 확인 공략</h2>
            <span>출처와 확인일이 있는 편집 공략</span>
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
                      <ResilientGameImage
                        sources={[
                          coverImage,
                          game.heroImageUrl,
                          game.thumbnailUrl,
                        ]}
                        name={game.nameKo}
                        width={768}
                        height={432}
                      />
                      <span>{game.nameKo}</span>
                      {videoCount > 0 && <b>▶ VIDEO</b>}
                    </Link>

                    <div className="guide-visual-copy">
                      <small>{getGuideTypeLabel(guide.guide_type)}</small>
                      <h2>
                        <Link
                          href={`/game/${game.slug}/guides/${guide.slug}`}
                        >
                          {guide.title}
                        </Link>
                      </h2>
                      <p>{publicGuideExcerpt(guide.body, guide.summary)}</p>

                      <div className="guide-card-source">
                        {source ? (
                          <>
                            출처 확인{" "}
                            {formatKstDateTime(source.last_checked_at)} ·{" "}
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
          ) : communityGuides.length === 0 ? (
            <div className="community-empty-state">
              <strong>아직 공략이 없습니다.</strong>
              <p>첫 유저 공략을 직접 올려보세요.</p>
              <Link
                className="primary-button"
                href={`/game/${game.slug}/guides?write=1#write`}
              >
                첫 공략 올리기
              </Link>
            </div>
          ) : (
            <div className="no-data">
              <strong>공식 확인 공략은 아직 없습니다.</strong>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

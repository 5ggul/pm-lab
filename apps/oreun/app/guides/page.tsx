import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import ResilientGameImage from "@/components/ResilientGameImage";
import CommunityGuideComposer from "@/components/CommunityGuideComposer";
import { getGameCatalog } from "@/lib/catalog";
import {
  getPublicGuideCatalog,
  getContentSources,
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
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공략",
  description:
    "실제 플레이에 바로 쓰는 Roblox 공식·유저 공략을 함께 확인합니다.",
  alternates: { canonical: "/guides" },
  robots: isIndexingReleased()
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; write?: string }>;
}) {
  const [games, params, user, token, publishedGuides, sources, communityGuides] =
    await Promise.all([
      getGameCatalog(),
      searchParams,
      getCurrentUser(),
      getCurrentAccessToken(),
      getPublicGuideCatalog().catch(() => null),
      getContentSources().catch(() => []),
      getCommunityGuideFeed({ limit: 60 }).catch(() => []),
    ]);

  const permissions = token
    ? await getCommunityPermissions(token).catch(() => null)
    : null;
  const access = writeAccess(Boolean(user && token), permissions);
  const gameByUniverse = new Map(
    games.map((game) => [Number(game.universeId), game]),
  );

  const allRows = (publishedGuides ?? []).flatMap((guide) => {
    const game = gameByUniverse.get(Number(guide.universe_id));
    const source = resolveGuideSource(guide, sources);
    return game && source ? [{ guide, game, source }] : [];
  });

  const q = (params.q ?? "").trim().toLocaleLowerCase("ko-KR");
  const type = (params.type ?? "").trim();
  const allowedTypes = new Set([
    "",
    "beginner",
    "mechanic",
    "progression",
    "troubleshooting",
    "faq",
    "guide",
  ]);
  const selectedType = allowedTypes.has(type) ? type : "";

  const exactGameUniverseIds = new Set(
    q
      ? games
          .filter((game) =>
            [game.nameKo, game.name, ...(game.aliases ?? [])].some(
              (value) => value.trim().toLocaleLowerCase("ko-KR") === q,
            ),
          )
          .map((game) => Number(game.universeId))
      : [],
  );

  const rows = allRows.filter(({ guide, game }) => {
    if (selectedType && guide.guide_type !== selectedType) return false;
    if (!q) return true;
    if (exactGameUniverseIds.size > 0) {
      return exactGameUniverseIds.has(Number(game.universeId));
    }
    return [
      guide.title,
      guide.summary,
      game.nameKo,
      game.name,
      ...(game.aliases ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(q);
  });

  const communityRows = communityGuides.filter((guide) => {
    if (selectedType && guide.guide_type !== selectedType) return false;
    if (!q) return true;
    if (exactGameUniverseIds.size > 0) {
      return exactGameUniverseIds.has(Number(guide.game_universe_id));
    }
    return [guide.title, guide.body, guide.game_name_ko]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(q);
  });

  const base = getRenderingSiteUrl();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "로블잼 공략",
    itemListElement: rows.map(({ guide, game }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      url: base + "/game/" + game.slug + "/guides/" + guide.slug,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <Header games={games} />
      <main className="page content-page">
        <div className="page-title guide-page-title">
          <div>
            <h1>공략</h1>
            <p>
              공식 확인 공략과 플레이어가 직접 쓴 공략을 함께 봅니다. 직접
              알아낸 방법도 바로 공유할 수 있어요.
            </p>
          </div>
          <Link className="primary-button" href="/guides?write=1#write">
            내 공략 올리기
          </Link>
        </div>

        <CommunityGuideComposer
          games={games}
          userId={user?.id ?? null}
          access={access}
          open={params.write === "1"}
          next="/guides?write=1#write"
        />

        <form className="guide-filter-bar" method="get">
          <label>
            <span>검색</span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="게임명 · 공략 제목 검색"
            />
          </label>
          <label>
            <span>유형</span>
            <select name="type" defaultValue={selectedType}>
              <option value="">전체</option>
              <option value="beginner">입문</option>
              <option value="mechanic">조작·규칙</option>
              <option value="progression">성장</option>
              <option value="troubleshooting">문제 해결</option>
              <option value="faq">FAQ</option>
              <option value="guide">일반</option>
            </select>
          </label>
          <button className="secondary-button" type="submit">
            필터 적용
          </button>
          {(q || selectedType) && (
            <Link className="text-button" href="/guides">
              초기화
            </Link>
          )}
        </form>

        <div className="guide-filter-result">
          <strong>{rows.length + communityRows.length}개</strong>
          <span>
            공식 {rows.length} · 유저 {communityRows.length}
          </span>
        </div>

        {communityRows.length > 0 && (
          <section className="community-guide-section">
            <div className="section-head">
              <h2>유저 공략</h2>
              <span>플레이어가 직접 공유한 방법</span>
            </div>
            <div className="community-guide-grid">
              {communityRows.map((guide) => (
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
                    {guide.game_name_ko} · {guide.author_name} ·{" "}
                    {formatKstDateTime(guide.created_at)}
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

          {publishedGuides === null ? (
            <div className="callout" role="alert">
              공략 목록을 불러오지 못했습니다. <a href="/guides">다시 확인</a>
            </div>
          ) : rows.length > 0 ? (
            <div className="guide-visual-grid">
              {rows.map(({ guide, game, source }) => {
                const heroImage = game.heroImageUrl ?? game.thumbnailUrl;
                const videoCount = game.mediaVideos?.length ?? 0;
                return (
                  <article className="guide-visual-card" key={guide.id}>
                    <Link
                      className="guide-visual-cover"
                      href={"/game/" + game.slug + "/guides/" + guide.slug}
                    >
                      <ResilientGameImage
                        sources={[
                          heroImage,
                          ...(game.mediaImages ?? []).map((image) => image.url),
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
                          href={
                            "/game/" + game.slug + "/guides/" + guide.slug
                          }
                        >
                          {guide.title}
                        </Link>
                      </h2>
                      <p>{publicGuideExcerpt(guide.body, guide.summary)}</p>
                      <div className="guide-card-source">
                        출처 확인 {formatKstDateTime(source.last_checked_at)} ·{" "}
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          Roblox 공식 페이지 ↗
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="community-empty-state">
              <strong>조건에 맞는 공식 공략이 없습니다.</strong>
              <p>검색어나 유형을 바꾸거나 유저 공략을 확인해 보세요.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

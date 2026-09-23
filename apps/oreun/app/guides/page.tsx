import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import {
  VERIFIED_EDITORIAL_GUIDES,
  VERIFIED_EDITORIAL_SOURCES,
} from "@/lib/content/verified-guides";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { formatKstDateTime } from "@/lib/format";
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공략",
  description:
    "Roblox 게임별 기본 조작과 시작 방법을 모았습니다.",
  alternates: { canonical: "/guides" },
  robots: isIndexingReleased()
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const [games, params] = await Promise.all([getGameCatalog(), searchParams]);
  const gameByUniverse = new Map(
    games.map((game) => [Number(game.universeId), game]),
  );
  const sourceById = new Map(
    VERIFIED_EDITORIAL_SOURCES.map((source) => [source.id, source]),
  );
  const allRows = VERIFIED_EDITORIAL_GUIDES.flatMap((guide) => {
    const game = gameByUniverse.get(Number(guide.universe_id));
    const source = sourceById.get(guide.source_id);
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
  const base = getRenderingSiteUrl();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "오름 공략",
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
        <div className="page-title">
          <h1>공략</h1>
          <p>게임별 기본 조작과 시작 방법을 찾을 수 있습니다. 출처와 확인일은 각 글에서 확인하세요.</p>
        </div>

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
          <strong>{rows.length}개</strong>
          <span>전체 {allRows.length}개</span>
        </div>

        {rows.length > 0 ? (
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
                  {heroImage && (
                    <img
                      src={heroImage}
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
                    <Link href={"/game/" + game.slug + "/guides/" + guide.slug}>
                      {guide.title}
                    </Link>
                  </h2>
                  <p>{guide.body.split(/\n\s*\n/)[0]?.trim() || guide.summary}</p>
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
            <strong>조건에 맞는 공략이 없습니다.</strong>
            <p>검색어나 유형을 바꾸거나 전체 목록으로 돌아가세요.</p>
            <div className="button-row">
              <Link className="secondary-button" href="/guides">
                전체 공략 보기
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

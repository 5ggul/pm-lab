import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import {
  VERIFIED_EDITORIAL_GUIDES,
  VERIFIED_EDITORIAL_SOURCES,
} from "@/lib/content/verified-guides";
import { formatKstDateTime } from "@/lib/format";
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "검증 가이드",
  description:
    "Roblox 공식 Experience 설명과 공개 메타데이터에서 직접 확인한 조작·입문 가이드만 모아 봅니다.",
  alternates: { canonical: "/guides" },
  robots: isIndexingReleased()
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default async function GuidesPage() {
  const games = await getGameCatalog();
  const gameByUniverse = new Map(
    games.map((game) => [Number(game.universeId), game]),
  );
  const sourceById = new Map(
    VERIFIED_EDITORIAL_SOURCES.map((source) => [source.id, source]),
  );
  const rows = VERIFIED_EDITORIAL_GUIDES.flatMap((guide) => {
    const game = gameByUniverse.get(Number(guide.universe_id));
    const source = sourceById.get(guide.source_id);
    return game && source ? [{ guide, game, source }] : [];
  });
  const base = getRenderingSiteUrl();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "오름 검증 가이드",
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
          <span className="eyebrow">VERIFIED EDITORIAL</span>
          <h1>검증 가이드</h1>
          <p>
            Roblox 공식 Experience 설명과 공개 메타데이터에서 직접 확인할 수
            있는 내용만 편집합니다. 경험담, 티어, 확률, 시세처럼 별도 검증이
            필요한 정보는 자동으로 채우지 않습니다.
          </p>
        </div>

        <div className="guide-list">
          {rows.map(({ guide, game, source }) => (
            <article className="guide-row" key={guide.id}>
              <span>
                {game.nameKo} · {guide.guide_type}
              </span>
              <h2>
                <Link href={"/game/" + game.slug + "/guides/" + guide.slug}>
                  {guide.title}
                </Link>
              </h2>
              <p>{guide.summary}</p>
              <small>
                출처 확인 {formatKstDateTime(source.last_checked_at)} ·{" "}
                <a
                  href={source.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Roblox 공식 페이지 ↗
                </a>
              </small>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}

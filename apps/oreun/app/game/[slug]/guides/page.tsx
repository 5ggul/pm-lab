import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getPublishedGuides } from "@/lib/content/queries";
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
    description: `${game.nameKo} 공략과 문제 해결 가이드를 검증 출처와 함께 정리합니다.`,
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

  const guides = await getPublishedGuides(game.universeId).catch(() => []);

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
            출처를 확인한 편집 콘텐츠만 공개합니다. 실제 플레이를 하지 않은
            경험담을 만들어 쓰지 않습니다.
          </p>
        </div>

        {guides.length ? (
          <div className="guide-list">
            {guides.map((guide) => (
              <article className="guide-row" key={guide.id}>
                <span>{guide.guide_type}</span>
                <h2>
                  <Link href={`/game/${game.slug}/guides/${guide.slug}`}>
                    {guide.title}
                  </Link>
                </h2>
                <p>{guide.summary}</p>
                <small>
                  업데이트 {formatKstDateTime(guide.updated_at)} ·{" "}
                  {guide.index_state}
                </small>
              </article>
            ))}
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

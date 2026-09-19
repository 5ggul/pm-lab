import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedGuide,
} from "@/lib/content/queries";
import { formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";

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

  return (
    <>
      <Header games={games} />
      <main className="page content-page guide-detail">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> /{" "}
          <Link href={`/game/${game.slug}/guides`}>가이드</Link>
        </div>
        <article>
          <span className="eyebrow">{guide.guide_type.toUpperCase()}</span>
          <h1>{guide.title}</h1>
          <p className="lead">{guide.summary}</p>
          <div className="source-box">
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
          <div className="guide-body">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>
      </main>
    </>
  );
}

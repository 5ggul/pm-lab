import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { getCommunityGuide } from "@/lib/community/queries";
import { getGuideTypeLabel } from "@/lib/content/guide-labels";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "유저 공략",
  robots: { index: false, follow: true },
};

export default async function CommunityGuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [guide, games] = await Promise.all([
    getCommunityGuide(id),
    getGameCatalog(),
  ]);
  if (!guide) notFound();

  return (
    <>
      <Header games={games} />
      <main className="page content-page community-guide-detail">
        <div className="breadcrumb">
          <Link href="/guides">공략</Link> /{" "}
          <Link href={"/game/" + guide.game_slug + "/guides"}>
            {guide.game_name_ko}
          </Link>{" "}
          / 유저 공략
        </div>

        <div className="community-guide-detail-head">
          <div className="community-guide-badges">
            <span>유저 공략</span>
            <span>{getGuideTypeLabel(guide.guide_type)}</span>
          </div>
          <h1>{guide.title}</h1>
          <p>
            <Link href={"/u/" + guide.author_handle}>
              {guide.author_name}
            </Link>{" "}
            · {formatKstDateTime(guide.created_at)}
          </p>
        </div>

        <article className="community-guide-body">
          {guide.body
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </article>

        <div className="guide-next-grid community-guide-next">
          <Link href={"/game/" + guide.game_slug + "/guides"}>
            <strong>{guide.game_name_ko} 공략 더 보기</strong>
            <span>공식·유저 공략 함께 보기 →</span>
          </Link>
          <Link href={"/game/" + guide.game_slug + "/questions"}>
            <strong>막힌 부분 질문하기</strong>
            <span>질문답변으로 이동 →</span>
          </Link>
        </div>
      </main>
    </>
  );
}

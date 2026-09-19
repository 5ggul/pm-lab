import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getUpdateEvents } from "@/lib/content/queries";
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
  const events = await getUpdateEvents(game.universeId, 20).catch(() => []);
  const hasDetectedChange = events.some(
    (event) => event.event_kind === "provider_update_detected",
  );
  const ready =
    isIndexingReleased() &&
    game.indexState === "indexable" &&
    hasDetectedChange;

  return {
    title: `${game.nameKo} 업데이트 기록`,
    description: `${game.nameKo}의 Roblox 공개 데이터 업데이트 시각 변화를 오름이 관측한 기록입니다.`,
    alternates: { canonical: `/game/${game.slug}/updates` },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function GameUpdatesPage({
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

  const events = await getUpdateEvents(game.universeId, 100).catch(() => []);

  return (
    <>
      <Header games={games} />
      <main className="page content-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 업데이트
        </div>
        <div className="page-title">
          <span className="eyebrow">UPDATE OBSERVATIONS</span>
          <h1>{game.nameKo} 업데이트 기록</h1>
          <p>
            패치노트를 추측하지 않습니다. Roblox 공개 경험 데이터의
            업데이트 시각이 실제로 바뀐 것을 오름 Collector가 관측한
            기록입니다.
          </p>
        </div>

        <div className="callout">
          <strong>“업데이트 감지”는 패치 내용 자체를 뜻하지 않습니다.</strong>
          <br />
          무엇이 바뀌었는지는 공식 게임 페이지나 개발자 공지를 별도로 확인해야
          합니다.
        </div>

        {events.length ? (
          <div className="update-timeline">
            {events.map((event) => (
              <article className="update-event" key={event.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>
                    {event.event_kind === "provider_update_detected"
                      ? "업데이트 시각 변경 감지"
                      : "수집 시작 기준점"}
                  </strong>
                  <p>
                    Roblox updated:{" "}
                    {formatKstDateTime(event.source_updated_at)}
                    <br />
                    오름 최초 관측:{" "}
                    {formatKstDateTime(event.first_observed_at)}
                  </p>
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    Roblox 게임 페이지 ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="no-data">
            <strong>아직 기록된 업데이트 시각이 없습니다.</strong>
          </div>
        )}
      </main>
    </>
  );
}

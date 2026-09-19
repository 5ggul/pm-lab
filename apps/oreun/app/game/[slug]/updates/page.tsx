import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getUpdateEvents } from "@/lib/content/queries";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { compactNumber, formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";
import type { HistoryPoint } from "@/lib/types";

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
    title: game.nameKo + " 업데이트 기록",
    description: game.nameKo + "의 Roblox 업데이트 시각 변경과 당시 플레이어 추이를 확인합니다.",
    alternates: { canonical: "/game/" + game.slug + "/updates" },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

function observationAround(
  observedAt: string,
  points: HistoryPoint[],
) {
  const center = new Date(observedAt).getTime();
  const trusted = points
    .filter(
      (point) =>
        point.playing != null &&
        point.coverageRatio != null &&
        point.coverageRatio >= 0.7,
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const before = trusted
    .filter((point) => {
      const time = new Date(point.at).getTime();
      return time <= center && center - time <= 6 * 3_600_000;
    })
    .at(-1);
  const after = trusted.find((point) => {
    const time = new Date(point.at).getTime();
    return time >= center + 3_600_000 && time - center <= 6 * 3_600_000;
  });

  if (!before || !after || !before.playing || !after.playing) return null;
  return {
    before,
    after,
    delta: ((after.playing - before.playing) / before.playing) * 100,
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

  const [events, histories] = await Promise.all([
    getUpdateEvents(game.universeId, 100).catch(() => []),
    getPersistentHistories([game.universeId], 2160).catch(() => null),
  ]);
  const history = histories?.get(game.universeId) ?? [];

  return (
    <>
      <Header games={games} />
      <main className="page content-page">
        <div className="breadcrumb">
          <Link href={"/game/" + game.slug}>{game.nameKo}</Link> / 업데이트
        </div>
        <div className="page-title">
          <h1>{game.nameKo} 업데이트 기록</h1>
          <p>Roblox의 게임 업데이트 시각이 바뀐 때를 오름이 처음 확인한 기록입니다.</p>
        </div>

        {events.length ? (
          <div className="update-timeline">
            {events.map((event) => {
              const observation =
                event.event_kind === "provider_update_detected"
                  ? observationAround(event.first_observed_at, history)
                  : null;
              return (
                <article
                  className="update-event"
                  id={"event-" + event.id}
                  key={event.id}
                >
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {event.event_kind === "provider_update_detected"
                        ? "업데이트 시각 변경"
                        : "관측 시작"}
                    </strong>
                    <p>
                      Roblox 업데이트 시각: {formatKstDateTime(event.source_updated_at)}
                      <br />
                      처음 확인: {formatKstDateTime(event.first_observed_at)}
                    </p>

                    {observation && (
                      <div className="update-player-change">
                        <span>
                          감지 전 {compactNumber(observation.before.playing)}명
                        </span>
                        <strong>
                          {observation.delta >= 0 ? "▲ " : "▼ "}
                          {Math.abs(observation.delta).toFixed(1)}%
                        </strong>
                        <span>
                          감지 후 {compactNumber(observation.after.playing)}명
                        </span>
                        <small>
                          수집 신뢰도 70% 이상 관측값만 사용 · 원인 관계를 뜻하지 않음
                        </small>
                      </div>
                    )}

                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      Roblox 게임 페이지 ↗
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="no-data">
            <strong>아직 확인된 업데이트 이력이 없습니다.</strong>
          </div>
        )}
      </main>
    </>
  );
}

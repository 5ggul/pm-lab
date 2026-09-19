import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import GameVisualCard from "@/components/GameVisualCard";
import UpdateRadarFilters from "@/components/UpdateRadarFilters";
import { getGameCatalog } from "@/lib/catalog";
import {
  getRecentUpdateEvents,
  type GameUpdateEvent,
} from "@/lib/content/queries";
import { formatKstDateTime, relativeTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

const EVENT_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function generateMetadata(): Promise<Metadata> {
  const events = await getRecentUpdateEvents(EVENT_LIMIT).catch(() => []);
  const distinctGames = new Set(events.map((event) => Number(event.universe_id)));
  const ready =
    isIndexingReleased() &&
    events.length >= 10 &&
    distinctGames.size >= 3;

  return {
    title: "Roblox 업데이트 감지",
    description:
      "Roblox 게임의 업데이트 시각 변경을 오름이 처음 확인한 순서대로 모아 봅니다.",
    alternates: { canonical: "/updates" },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

function validTime(iso: string) {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function windowedEvents(events: GameUpdateEvent[], now: Date) {
  if (!events.length) {
    return {
      label: "수집 중",
      events,
    };
  }

  if (events.length >= EVENT_LIMIT) {
    return {
      label: "최근 1,000건 기준",
      events,
    };
  }

  const oldest = Math.min(
    ...events.map((event) => validTime(event.first_observed_at)).filter(Boolean),
  );
  const fullDay = oldest > 0 && now.getTime() - oldest >= DAY_MS;

  if (!fullDay) {
    return {
      label: "수집 시작 이후",
      events,
    };
  }

  const cutoff = now.getTime() - DAY_MS;
  return {
    label: "최근 24시간",
    events: events.filter(
      (event) => validTime(event.first_observed_at) >= cutoff,
    ),
  };
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; hours?: string }>;
}) {
  const [games, events, params] = await Promise.all([
    getGameCatalog(),
    getRecentUpdateEvents(EVENT_LIMIT).catch(() => []),
    searchParams,
  ]);
  const now = new Date();
  const gameByUniverse = new Map(
    games.map((game) => [game.universeId, game]),
  );
  const scoped = windowedEvents(events, now);
  const selectedGame =
    params.game && games.some((game) => game.slug === params.game)
      ? params.game
      : "all";
  const selectedHours = ["1", "3", "6", "all"].includes(params.hours ?? "")
    ? params.hours!
    : "default";
  const sourceEvents = selectedHours === "all" ? events : scoped.events;
  const hourCutoff =
    selectedHours === "default" || selectedHours === "all"
      ? null
      : now.getTime() - Number(selectedHours) * 60 * 60 * 1000;
  const filteredEvents = sourceEvents.filter((event) => {
    const game = gameByUniverse.get(Number(event.universe_id));
    if (!game) return false;
    if (selectedGame !== "all" && game.slug !== selectedGame) return false;
    if (
      hourCutoff != null &&
      validTime(event.first_observed_at) < hourCutoff
    ) {
      return false;
    }
    return true;
  });

  const detectedGameOptions = [...new Set(
    events
      .map((event) => Number(event.universe_id))
      .filter((universeId) => gameByUniverse.has(universeId)),
  )]
    .map((universeId) => gameByUniverse.get(universeId)!)
    .sort((a, b) => a.nameKo.localeCompare(b.nameKo, "ko"));

  const counts = new Map<
    number,
    { count: number; latest: GameUpdateEvent }
  >();
  for (const event of filteredEvents) {
    const universeId = Number(event.universe_id);
    if (!gameByUniverse.has(universeId)) continue;
    const current = counts.get(universeId);
    if (!current) {
      counts.set(universeId, { count: 1, latest: event });
      continue;
    }
    current.count += 1;
    if (
      validTime(event.first_observed_at) >
      validTime(current.latest.first_observed_at)
    ) {
      current.latest = event;
    }
  }

  const frequent = [...counts.entries()]
    .map(([universeId, value]) => ({
      game: gameByUniverse.get(universeId)!,
      ...value,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        validTime(b.latest.first_observed_at) -
          validTime(a.latest.first_observed_at),
    )
    .slice(0, 8);

  const latestEvents = filteredEvents
    .map((event) => ({
      event,
      game: gameByUniverse.get(Number(event.universe_id)),
    }))
    .filter(
      (
        row,
      ): row is {
        event: GameUpdateEvent;
        game: NonNullable<typeof row.game>;
      } => Boolean(row.game),
    )
    .slice(0, 40);

  const latestObservedAt = latestEvents[0]?.event.first_observed_at ?? null;

  return (
    <>
      <Header games={games} />
      <main className="page update-radar-page">
        <div className="page-title">
          <h1>업데이트 감지</h1>
          <p>
            Roblox 게임의 업데이트 시각이 바뀐 순간을 오름이 확인한 기록입니다.
          </p>
        </div>

        <div className="update-radar-summary">
          <div>
            <strong>{filteredEvents.length.toLocaleString("ko-KR")}</strong>
            <small>
              {selectedHours === "default"
                ? scoped.label
                : selectedHours === "all"
                  ? "수집 전체"
                  : `최근 ${selectedHours}시간`} 감지
            </small>
          </div>
          <div>
            <strong>{counts.size.toLocaleString("ko-KR")}</strong>
            <small>감지 게임</small>
          </div>
          <div>
            <strong>
              {latestObservedAt ? relativeTime(latestObservedAt, now) : "—"}
            </strong>
            <small>마지막 감지</small>
          </div>
        </div>

        <UpdateRadarFilters
          games={detectedGameOptions.map((game) => ({
            slug: game.slug,
            name: game.nameKo,
          }))}
          selectedGame={selectedGame}
          selectedHours={selectedHours}
          defaultRangeLabel={scoped.label}
        />

        {frequent.length > 0 && (
          <section>
            <div className="section-head">
              <h2>변화가 자주 잡힌 게임</h2>
              <span className="section-note">
                {selectedGame !== "all"
                  ? games.find((game) => game.slug === selectedGame)?.nameKo ??
                    "선택 게임"
                  : selectedHours === "default"
                    ? scoped.label
                    : selectedHours === "all"
                      ? "수집 전체"
                      : `최근 ${selectedHours}시간`}
              </span>
            </div>
            <div className="visual-card-grid">
              {frequent.map(({ game, count }) => (
                <GameVisualCard
                  key={game.universeId}
                  game={game}
                  href={"/game/" + game.slug + "/updates"}
                  badge={count + "회 감지"}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="section-head">
            <h2>최근 감지 기록</h2>
            <span className="section-note">최신 40건</span>
          </div>

          {latestEvents.length ? (
            <div className="update-radar-feed">
              {latestEvents.map(({ game, event }) => (
                <Link
                  className="update-radar-row"
                  href={"/game/" + game.slug + "/updates"}
                  key={event.id}
                >
                  <div className="update-radar-name">
                    <strong>{game.nameKo}</strong>
                    <span>업데이트 시각 변경</span>
                  </div>
                  <div className="update-radar-time">
                    <span>
                      Roblox {formatKstDateTime(event.source_updated_at)}
                    </span>
                    <strong>
                      {relativeTime(event.first_observed_at, now)}
                    </strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <strong>아직 확인된 업데이트 변화가 없습니다.</strong>
            </div>
          )}
        </section>

        <div className="callout update-radar-note">
          감지 횟수는 Roblox의 업데이트 시각 값이 바뀐 것을 오름 수집기가
          확인한 횟수입니다. 패치 노트 개수나 업데이트 규모를 뜻하지 않습니다.
        </div>
      </main>
    </>
  );
}

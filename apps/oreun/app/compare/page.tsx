import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { compactNumber } from "@/lib/format";
import type { HistoryPoint } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "게임 비교",
  description: "Roblox 게임 2~4개의 현재 플레이, 장르, 최대 인원, 업데이트와 로블잼 Historical Data를 비교합니다.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: true },
};

function trusted24(points: HistoryPoint[]) {
  const cutoff = Date.now() - 24 * 3_600_000;
  const rows = (points ?? []).filter(
    (point) =>
      new Date(point.at).getTime() >= cutoff &&
      point.playing != null &&
      point.coverageRatio != null &&
      point.coverageRatio >= 0.7,
  );
  const coverage =
    rows.length > 0
      ? rows.reduce((sum, point) => sum + (point.coverageRatio ?? 0), 0) / rows.length
      : 0;
  const ready = rows.length >= 18 && coverage >= 0.7;
  if (!ready) return null;
  const values = rows.map((point) => point.playing!);
  return {
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    max: Math.max(...values),
    min: Math.min(...values),
    coverage,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ games?: string }>;
}) {
  const query = await searchParams;
  const allGames = await getGameCatalog();
  const requested = (query.games ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
  const selected = requested
    .map((slug) => allGames.find((game) => game.slug === slug))
    .filter((game): game is NonNullable<typeof game> => Boolean(game));

  const histories =
    selected.length > 0
      ? await getPersistentHistories(
          selected.map((game) => game.universeId),
          24,
        ).catch(() => null)
      : null;

  return (
    <>
      <Header games={allGames} />
      <main className="page">
        <div className="media-page-head">
          <h1>게임 비교</h1>
          <span>2~4개 게임</span>
        </div>

        {selected.length < 2 ? (
          <div className="media-empty">
            비교할 게임을 2개 이상 선택하세요.{" "}
            <Link href="/games">게임 탐색에서 선택 →</Link>
          </div>
        ) : (
          <div className="compare-matrix-wrap">
            <div
              className="compare-matrix"
              style={{
                gridTemplateColumns: "92px repeat(" + selected.length + ", minmax(0, 1fr))",
              }}
            >
              <div className="compare-label">게임</div>
              {selected.map((game) => (
                <Link className="compare-game-head" href={"/game/" + game.slug} key={game.universeId}>
                  {game.heroImageUrl && (
                    <img src={game.heroImageUrl} alt="" width={64} height={48} loading="lazy" />
                  )}
                  <strong>{game.nameKo}</strong>
                </Link>
              ))}

              <div className="compare-label">현재 플레이</div>
              {selected.map((game) => (
                <div key={game.universeId} title={game.playing == null ? undefined : game.playing.toLocaleString("ko-KR") + "명"}>
                  {game.playing == null ? "확인 불가" : compactNumber(game.playing) + "명"}
                </div>
              ))}

              <div className="compare-label">24H 평균</div>
              {selected.map((game) => {
                const stats = trusted24(histories?.get(game.universeId) ?? []);
                return <div key={game.universeId}>{stats ? compactNumber(stats.average) : "수집 중"}</div>;
              })}

              <div className="compare-label">24H 최고</div>
              {selected.map((game) => {
                const stats = trusted24(histories?.get(game.universeId) ?? []);
                return <div key={game.universeId}>{stats ? compactNumber(stats.max) : "수집 중"}</div>;
              })}

              <div className="compare-label">방문</div>
              {selected.map((game) => (
                <div key={game.universeId} title={game.visits == null ? undefined : game.visits.toLocaleString("ko-KR")}>
                  {compactNumber(game.visits)}
                </div>
              ))}

              <div className="compare-label">즐겨찾기</div>
              {selected.map((game) => (
                <div key={game.universeId} title={game.favorites == null ? undefined : game.favorites.toLocaleString("ko-KR")}>
                  {compactNumber(game.favorites)}
                </div>
              ))}

              <div className="compare-label">장르</div>
              {selected.map((game) => (
                <div key={game.universeId}>{[game.genreL1, game.genreL2].filter(Boolean).join(" · ") || "—"}</div>
              ))}

              <div className="compare-label">최대 인원</div>
              {selected.map((game) => (
                <div key={game.universeId}>{game.maxPlayers == null ? "—" : game.maxPlayers + "명"}</div>
              ))}

              <div className="compare-label">최근 업데이트</div>
              {selected.map((game) => (
                <div key={game.universeId}>
                  {game.experienceUpdatedAt
                    ? new Date(game.experienceUpdatedAt).toLocaleDateString("ko-KR")
                    : "—"}
                </div>
              ))}

              <div className="compare-label">공식 미디어</div>
              {selected.map((game) => (
                <div key={game.universeId}>
                  {(game.mediaImages?.length ?? 0) + " 이미지 · " + (game.mediaVideos?.length ?? 0) + " 영상"}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { previewFixtureEnabled } from "@/lib/history";
import { getCollectorOpsSummary } from "@/lib/repository/supabase-admin";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "데이터 상태 · 내부 Preview",
  robots: { index: false, follow: false },
};

function runStatusLabel(status: string) {
  return status === "success"
    ? "정상"
    : status === "partial"
      ? "부분 성공"
      : status === "rate_limited"
        ? "Rate limit"
        : status === "failed"
          ? "실패"
          : "실행 중";
}

export default async function DataStatus() {
  const games = await getGameCatalog();
  let ops: Awaited<ReturnType<typeof getCollectorOpsSummary>>;
  let opsError: string | null = null;

  try {
    ops = await getCollectorOpsSummary();
  } catch (error) {
    ops = {
      configured: true,
      latestRun: null,
      recentRuns: [],
      failingTargets: [],
    };
    opsError = error instanceof Error ? error.message : "운영 상태 조회 실패";
  }

  const gameMap = new Map(games.map((game) => [game.universeId, game]));
  const counts = {
    liveOrStored: games.filter(
      (game) => game.sourceStatus === "live" || game.sourceStatus === "stored",
    ).length,
    fresh: games.filter((game) => game.freshnessState === "fresh").length,
    stale: games.filter((game) => game.freshnessState === "stale").length,
    unavailable: games.filter(
      (game) => game.freshnessState === "unavailable",
    ).length,
  };
  const latest = ops.latestRun;

  return (
    <>
      <Header games={games} />
      <main className="page">
        <div className="page-title">
          <h1>Data Status</h1>
          <p>
            Preview 내부 운영 상태 · 검색엔진 색인 금지. Production에서는 관리자
            인증 뒤로 이동합니다.
          </p>
        </div>

        <div className="status-grid">
          <div className="status-cell">
            <strong>{counts.liveOrStored}</strong>
            <span>현재값 확보</span>
          </div>
          <div className="status-cell">
            <strong>{counts.fresh}</strong>
            <span>fresh</span>
          </div>
          <div className="status-cell">
            <strong>{counts.stale}</strong>
            <span>stale</span>
          </div>
          <div className="status-cell">
            <strong>{counts.unavailable}</strong>
            <span>unavailable</span>
          </div>
        </div>

        <div className="section-head">
          <h2>Persistent Collector</h2>
        </div>
        <div className="callout">
          DB:{" "}
          <strong>
            {ops.configured
              ? opsError
                ? "CONFIGURED · 상태 조회 오류"
                : "CONNECTED"
              : "NOT CONNECTED"}
          </strong>
          <br />
          Historical Fixture:{" "}
          <strong>
            {previewFixtureEnabled() ? "ON · 개발용" : "OFF · 기본값"}
          </strong>
        </div>

        {opsError && (
          <div className="callout">
            <strong>운영 상태 조회 실패</strong>
            <br />
            페이지 데이터는 fallback 경로로 계속 제공됩니다.
          </div>
        )}

        {latest ? (
          <>
            <div className="section-head">
              <h2>최근 Collector 실행</h2>
            </div>
            <div className="status-grid">
              <div className="status-cell">
                <strong>{runStatusLabel(latest.status)}</strong>
                <span>{formatKstDateTime(latest.finished_at ?? latest.started_at)}</span>
              </div>
              <div className="status-cell">
                <strong>{latest.requested_count}</strong>
                <span>요청</span>
              </div>
              <div className="status-cell">
                <strong>{latest.success_count}</strong>
                <span>저장 성공</span>
              </div>
              <div className="status-cell">
                <strong>{latest.failure_count}</strong>
                <span>실패</span>
              </div>
            </div>
            <p>
              Rate limit {latest.rate_limit_count} · latency p50{" "}
              {latest.latency_p50_ms ?? "—"}ms / p95{" "}
              {latest.latency_p95_ms ?? "—"}ms
            </p>
          </>
        ) : (
          <div className="no-data">
            <strong>아직 확인 가능한 ingestion run이 없습니다.</strong>
          </div>
        )}

        <div className="section-head">
          <h2>반복 실패 Target</h2>
        </div>
        {ops.failingTargets.length ? (
          <div className="game-table">
            {ops.failingTargets.map((target) => {
              const game = gameMap.get(target.universeId);
              return (
                <div className="search-result" key={target.universeId}>
                  <div>
                    <strong>{game?.nameKo ?? target.universeId}</strong>
                    <br />
                    <small>
                      {target.tier} · {target.cadenceMinutes}분 · 실패{" "}
                      {target.failureCount}회
                    </small>
                  </div>
                  <small>다음 {formatKstDateTime(target.nextDueAt)}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p>현재 반복 실패 target이 없습니다.</p>
        )}

        <div className="section-head">
          <h2>수집 원칙</h2>
        </div>
        <p>
          한 Game 실패는 다른 Snapshot을 rollback하지 않습니다. 데이터가 없으면
          0명으로 기록하지 않고, 반복 실패는 longtail backoff로 낮춥니다.
        </p>
      </main>
    </>
  );
}

import type { Metadata } from "next";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { previewFixtureEnabled } from "@/lib/history";
import { getSupabaseRestConfig } from "@/lib/db/supabase-rest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "데이터 상태 · 내부 Preview",
  robots: { index: false, follow: false },
};

export default async function DataStatus() {
  const games = await getGameCatalog();
  const persistentConfigured = getSupabaseRestConfig() !== null;
  const counts = {
    live: games.filter((game) => game.sourceStatus === "live").length,
    fresh: games.filter((game) => game.freshnessState === "fresh").length,
    stale: games.filter((game) => game.freshnessState === "stale").length,
    unavailable: games.filter((game) => game.freshnessState === "unavailable").length,
  };

  return (
    <>
      <Header games={games} />
      <main className="page">
        <div className="page-title">
          <h1>Data Status</h1>
          <p>
            Preview 내부 상태 화면 · 검색엔진 색인 금지. 실제 운영에서는 관리자
            인증 뒤로 이동합니다.
          </p>
        </div>

        <div className="status-grid">
          <div className="status-cell">
            <strong>{counts.live}</strong>
            <span>live provider</span>
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
          <h2>Collector 준비 상태</h2>
        </div>
        <p>
          Provider Adapter, lease claim, partial failure, 429 재예약, ingestion
          run, idempotent Snapshot, Hourly/Daily Rollup 실행 계층이 준비되어
          있습니다.
        </p>
        <div className="callout">
          Persistent DB:{" "}
          <strong>
            {persistentConfigured
              ? "CONFIGURED · 서버 전용 환경변수 감지"
              : "NOT CONNECTED · 코드만 준비됨"}
          </strong>
          <br />
          Historical Fixture:{" "}
          <strong>
            {previewFixtureEnabled() ? "ON · 개발용" : "OFF · 기본값"}
          </strong>
        </div>
        {!persistentConfigured && (
          <p>
            현재 Preview는 R1 전용 Supabase가 없으므로 기존 다른 프로젝트를
            사용하지 않습니다.
          </p>
        )}
      </main>
    </>
  );
}

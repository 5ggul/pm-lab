import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isIndexingReleased } from "@/lib/indexing";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { getIndexReadiness } from "@/lib/repository/supabase-admin";
import { formatKstDateTime } from "@/lib/format";
import { getGoogleAuthProviderStatus } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "출시 준비 상태 · 내부 Preview",
  robots: { index: false, follow: false },
};

export default async function LaunchReadinessPage() {
  if (isIndexingReleased()) notFound();
  const [games, googleProvider] = await Promise.all([
    getGameCatalog(),
    getGoogleAuthProviderStatus().catch(() => ({
      enabled: false,
      error: "provider status unavailable",
      status: 503,
    })),
  ]);
  let readiness: Awaited<ReturnType<typeof getIndexReadiness>> = [];
  let error: string | null = null;

  try {
    readiness = await getIndexReadiness();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "readiness query failed";
  }

  const gameMap = new Map(games.map((game) => [game.universeId, game]));
  const ready = readiness.filter((row) => row.dataReadyForIndexReview).length;
  const candidate = readiness.filter((row) => row.indexState === "candidate").length;

  return (
    <>
      <Header games={games} />
      <main className="page">
        <div className="page-title">
          <h1>Launch Readiness</h1>
          <p>
            노인덱스 해제 전 내부 검수용. 이 화면은 어떤 Game도 자동으로
            indexable로 바꾸지 않습니다.
          </p>
        </div>

        <div className="status-grid">
          <div className="status-cell">
            <strong>{games.length}</strong>
            <span>검증 Game</span>
          </div>
          <div className="status-cell">
            <strong>{candidate}</strong>
            <span>candidate</span>
          </div>
          <div className="status-cell">
            <strong>{ready}</strong>
            <span>데이터 기준 통과</span>
          </div>
          <div className="status-cell">
            <strong>{process.env.R1_PREVIEW_NO_INDEX === "0" ? "OFF" : "ON"}</strong>
            <span>Preview noindex</span>
          </div>
          <div className="status-cell">
            <strong>{googleProvider.enabled ? "READY" : "BLOCKED"}</strong>
            <span>Google Auth</span>
          </div>
        </div>

        {!googleProvider.enabled && (
          <div className="callout">
            <strong>Google 로그인 외부 설정 대기</strong>
            <br />
            Google Cloud Web OAuth Client와 Supabase Google provider가 활성화되면
            로그인 화면의 Google 버튼이 자동으로 열립니다. 앱 코드는 추가 수정
            없이 그대로 사용합니다.
          </div>
        )}

        {error && (
          <div className="callout">
            <strong>Readiness DB 조회 실패</strong>
            <br />
            {error}
          </div>
        )}

        <div className="section-head">
          <h2>Game별 색인 검토</h2>
        </div>
        {readiness.length ? (
          <div className="game-table">
            {readiness.map((row) => {
              const game = gameMap.get(row.universeId);
              const blockers = [
                !row.currentDataAvailable
                  ? row.freshnessState === "unavailable"
                    ? "공식 API 현재값 제한"
                    : "사용 가능한 현재값 없음"
                  : !row.currentDataRecent
                    ? "현재값 20분 초과"
                    : null,
                !row.hasEditorialDescription ? "설명 80자 미만" : null,
                !row.hasOfficialHero ? "공식 Hero 없음" : null,
                row.hourlyBuckets24h < 24
                  ? `24H bucket ${row.hourlyBuckets24h}/24`
                  : null,
                row.trustedHourlyBuckets24h < 18
                  ? `신뢰 bucket ${row.trustedHourlyBuckets24h}/18`
                  : null,
                row.avgCoverage24h < 0.7
                  ? `평균 coverage ${Math.round(row.avgCoverage24h * 100)}%`
                  : null,
              ].filter((value): value is string => Boolean(value));
              return (
                <div className="search-result" key={row.universeId}>
                  <div>
                    <strong>{game?.nameKo ?? row.slug}</strong>
                    <br />
                    <small>
                      {row.indexState} · 24H Hourly {row.hourlyBuckets24h}/24 ·
                      Trusted {row.trustedHourlyBuckets24h}/18 · Coverage{" "}
                      {Math.round(row.avgCoverage24h * 100)}% ·{" "}
                      {row.freshnessState ?? "unknown"}
                    </small>
                  </div>
                  <small>
                    {row.dataReadyForIndexReview ? "DATA READY" : "COLLECTING"}
                    <br />
                    {row.fetchedAt ? formatKstDateTime(row.fetchedAt) : "no snapshot"}
                    {!row.dataReadyForIndexReview && blockers.length > 0 && (
                      <>
                        <br />
                        {blockers.join(" · ")}
                      </>
                    )}
                    {!row.hasIndependentValue && (
                      <>
                        <br />
                        독립가치 신호 수집 중
                      </>
                    )}
                  </small>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data">
            <strong>DB 연결 전 또는 데이터 수집 초기 단계입니다.</strong>
          </div>
        )}

        <div className="section-head">
          <h2>최종 승인 때만 할 일</h2>
        </div>
        <ol>
          <li>사용자가 Preview를 직접 검수한다.</li>
          <li>운영 도메인과 NEXT_PUBLIC_SITE_URL을 확정한다.</li>
          <li>Google Auth가 READY인지 확인하고 실제 Google 계정 E2E를 완료한다.</li>
          <li>데이터·콘텐츠 기준을 통과한 Game만 indexable로 승격한다.</li>
          <li>R1_PREVIEW_NO_INDEX=0으로 전환한다.</li>
          <li>robots.txt와 sitemap.xml을 다시 확인한다.</li>
        </ol>
      </main>
    </>
  );
}

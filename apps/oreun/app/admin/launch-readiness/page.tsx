import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isIndexingReleased } from "@/lib/indexing";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import {
  getIndexReadiness,
  getReleaseAuthSummary,
  getReleaseContentSummary,
} from "@/lib/repository/supabase-admin";
import { formatKstDateTime } from "@/lib/format";
import { getGoogleAuthProviderStatus } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "출시 준비 상태 · 내부 Preview",
  robots: { index: false, follow: false },
};

export default async function LaunchReadinessPage() {
  if (isIndexingReleased()) notFound();
  const [games, googleProvider, authSummary, contentSummary] = await Promise.all([
    getGameCatalog(),
    getGoogleAuthProviderStatus().catch(() => ({
      enabled: false,
      error: "provider status unavailable",
      status: 503,
    })),
    getReleaseAuthSummary().catch(() => ({
      configured: false,
      googleIdentityCount: 0,
      activeAdminCount: 0,
      activeGoogleAdminCount: 0,
    })),
    getReleaseContentSummary().catch(() => ({
      configured: false,
      contentSources: 0,
      approvedPublishedGuides: 0,
      noindexGuides: 0,
      publishedCodes: 0,
      invalidPublishedCodes: 0,
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
  const googleOnlySignupHookConfirmed =
    process.env.R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM === "1";
  const googleE2EConfirmed = process.env.R1_GOOGLE_E2E_CONFIRM === "1";
  const communityE2EConfirmed =
    process.env.R1_COMMUNITY_E2E_CONFIRM === "1";

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

        <div className="status-grid launch-primary-grid">
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
          <h2>콘텐츠 Release Gate</h2>
        </div>
        <div className="status-grid release-content-grid">
          <div className="status-cell">
            <strong>{contentSummary.configured ? contentSummary.contentSources : "N/A"}</strong>
            <span>검증 Source</span>
          </div>
          <div className="status-cell">
            <strong>
              {contentSummary.configured
                ? contentSummary.approvedPublishedGuides
                : "N/A"}
            </strong>
            <span>승인·공개 Guide</span>
          </div>
          <div className="status-cell">
            <strong>{contentSummary.configured ? contentSummary.noindexGuides : "N/A"}</strong>
            <span>Guide noindex</span>
          </div>
          <div className="status-cell">
            <strong>
              {!contentSummary.configured
                ? "N/A"
                : contentSummary.invalidPublishedCodes === 0
                  ? "PASS"
                  : "BLOCK"}
            </strong>
            <span>
              Code integrity · 공개{" "}
              {contentSummary.configured ? contentSummary.publishedCodes : "N/A"}
            </span>
          </div>
        </div>

        {(!contentSummary.configured || !authSummary.configured) && (
          <div className="callout">
            <strong>Server-only release summary</strong>
            <br />
            공개 Workers Preview에는 Supabase server secret을 주입하지 않습니다.
            따라서 민감한 DB/Auth 집계는 N/A로 표시될 수 있으며, 실제 release
            판정은 server secret이 있는 환경에서 `npm run release:preflight`로
            수행합니다.
          </div>
        )}

        <div className="section-head">
          <h2>Auth Release Gate</h2>
        </div>
        <div className="status-grid release-auth-grid">
          <div className="status-cell">
            <strong>{googleProvider.enabled ? "READY" : "BLOCK"}</strong>
            <span>Google provider</span>
          </div>
          <div className="status-cell">
            <strong>{googleOnlySignupHookConfirmed ? "DONE" : "BLOCK"}</strong>
            <span>Google-only signup hook</span>
          </div>
          <div className="status-cell">
            <strong>{authSummary.configured ? authSummary.googleIdentityCount : "N/A"}</strong>
            <span>Google identity</span>
          </div>
          <div className="status-cell">
            <strong>
              {authSummary.configured
                ? authSummary.activeGoogleAdminCount
                : "N/A"}
            </strong>
            <span>Google-backed admin</span>
          </div>
          <div className="status-cell">
            <strong>{googleE2EConfirmed ? "DONE" : "BLOCK"}</strong>
            <span>Google browser E2E</span>
          </div>
          <div className="status-cell">
            <strong>{communityE2EConfirmed ? "DONE" : "BLOCK"}</strong>
            <span>2계정 browser E2E</span>
          </div>
        </div>

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
                    ? "수집 cadence 기준 현재값 초과"
                    : null,
                !row.hasEditorialDescription ? "설명 80자 미만" : null,
                !row.hasOfficialHero ? "공식 Hero 없음" : null,
                row.hourlyBuckets24h < 23
                  ? `24H bucket ${row.hourlyBuckets24h}/23`
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
                      {row.indexState} · 24H Hourly {row.hourlyBuckets24h}/23 ·
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
          <h2>남은 외부·실사용 Gate</h2>
        </div>
        <div className="launch-blocker-grid">
          <div>
            <strong>{googleProvider.enabled ? "READY" : "BLOCKED"}</strong>
            <span>Google OAuth provider</span>
            <small>Google Cloud Client + Supabase provider 설정</small>
          </div>
          <div>
            <strong>{googleOnlySignupHookConfirmed ? "DONE" : "MANUAL"}</strong>
            <span>신규가입 Google-only</span>
            <small>`R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM=1` 전 release 차단</small>
          </div>
          <div>
            <strong>
              {!authSummary.configured
                ? "SERVER"
                : authSummary.googleIdentityCount >= 1
                  ? "DONE"
                  : "BLOCK"}
            </strong>
            <span>실제 Google identity</span>
            <small>최소 1개 실제 Google 로그인 identity 필요</small>
          </div>
          <div>
            <strong>
              {!authSummary.configured
                ? "SERVER"
                : authSummary.activeGoogleAdminCount >= 1
                  ? "DONE"
                  : "BLOCK"}
            </strong>
            <span>Google 운영자</span>
            <small>만 14세 확인 + active Google-backed admin 필요</small>
          </div>
          <div>
            <strong>{googleE2EConfirmed ? "DONE" : "MANUAL"}</strong>
            <span>Google 실계정 E2E</span>
            <small>`R1_GOOGLE_E2E_CONFIRM=1` 전환 전 release 차단</small>
          </div>
          <div>
            <strong>{communityE2EConfirmed ? "DONE" : "MANUAL"}</strong>
            <span>2계정 브라우저 E2E</span>
            <small>`R1_COMMUNITY_E2E_CONFIRM=1` 전환 전 release 차단</small>
          </div>
          <div>
            <strong>LOCKED</strong>
            <span>운영 도메인·색인</span>
            <small>사용자 승인 전 domain/noindex/indexable 변경 금지</small>
          </div>
        </div>

        <div className="section-head">
          <h2>최종 승인 때만 할 일</h2>
        </div>
        <ol>
          <li>사용자가 Preview를 직접 검수한다.</li>
          <li>운영 도메인과 NEXT_PUBLIC_SITE_URL을 확정한다.</li>
          <li>Google Auth가 READY인지 확인하고 Google-only 신규가입 Hook을 실제 검증한다.</li>
          <li>실제 Google 계정 E2E를 완료한다.</li>
          <li>실제 Google 계정 2개로 커뮤니티 브라우저 E2E를 재확인한다.</li>
          <li>`npm run release:preflight`가 PASS인지 확인한다.</li>
          <li>데이터·콘텐츠 기준을 통과한 Game만 indexable로 승격한다.</li>
          <li>R1_PREVIEW_NO_INDEX=0으로 전환한다.</li>
          <li>robots.txt와 sitemap.xml을 다시 확인한다.</li>
        </ol>
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCommunityAnalyticsReadiness,
} from "@/lib/community-analytics/run";
import { getCommunityAnalyticsConfig } from "@/lib/community-analytics/open-cloud";
import { formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Community Analytics · 내부 Preview",
  robots: { index: false, follow: false },
};

export default async function CommunityAnalyticsPage() {
  await requireAdminPage("/admin/community-analytics");
  if (isIndexingReleased()) notFound();

  const games = await getGameCatalog();
  const feature = getCommunityAnalyticsConfig();
  let configured = false;
  let rows: Awaited<
    ReturnType<typeof getCommunityAnalyticsReadiness>
  >["rows"] = [];
  let error: string | null = null;

  try {
    const readiness = await getCommunityAnalyticsReadiness();
    configured = readiness.configured;
    rows = readiness.rows;
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "community analytics query failed";
  }

  const targets = rows.filter((row) => row.groupId !== null);
  const authorized = targets.filter(
    (row) => row.authorizationState === "authorized",
  ).length;
  const enabled = targets.filter((row) => row.enabled).length;
  const collected = targets.filter((row) => row.latestSnapshotAt).length;

  return (
    <>
      <Header games={games} />
      <main className="page">
        <div className="page-title">
          <h1>Community Analytics · 내부 Preview</h1>
          <p>
            Roblox Open Cloud Group Forum의 서버 전용 집계 수집 상태입니다.
            게시물·댓글 본문과 사용자 식별자는 저장하지 않습니다.
          </p>
        </div>

        <div className="status-grid">
          <div className="status-cell">
            <strong>{feature.enabled ? "ON" : "OFF"}</strong>
            <span>Feature flag · 기본 OFF</span>
          </div>
          <div className="status-cell">
            <strong>{feature.apiKey ? "SET" : "MISSING"}</strong>
            <span>Open Cloud server key</span>
          </div>
          <div className="status-cell">
            <strong>{authorized}</strong>
            <span>권한 검증 target</span>
          </div>
          <div className="status-cell">
            <strong>{collected}</strong>
            <span>실제 집계 확보</span>
          </div>
        </div>

        <div className="callout">
          <strong>Fail closed</strong>
          <br />
          기능 플래그, 서버 API Key, 검증된 Group target이 모두 있어야 수집합니다.
          Preview DB 연결: {configured ? "CONNECTED" : "NOT CONNECTED"} · 활성 target:{" "}
          {enabled}
        </div>

        {error && (
          <div className="callout danger">
            <strong>상태 조회 실패</strong>
            <br />
            {error}
          </div>
        )}

        <div className="section-head">
          <h2>검증된 Group target</h2>
          <Link href="/admin/data-status">Data Status</Link>
        </div>

        {targets.length ? (
          <div className="game-table">
            {targets.map((row) => (
              <div className="search-result" key={row.universeId}>
                <div>
                  <strong>{row.nameKo}</strong>
                  <br />
                  <small>
                    Group {row.groupId} · {row.authorizationState ?? "unverified"} ·{" "}
                    {row.enabled ? "ENABLED" : "DISABLED"}
                  </small>
                  {row.lastError && (
                    <>
                      <br />
                      <small>최근 오류: {row.lastError}</small>
                    </>
                  )}
                </div>
                <small>
                  검증{" "}
                  {row.lastVerifiedAt
                    ? formatKstDateTime(row.lastVerifiedAt)
                    : "—"}
                  <br />
                  집계{" "}
                  {row.latestSnapshotAt
                    ? formatKstDateTime(row.latestSnapshotAt)
                    : "아직 없음"}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">
            <strong>아직 승인된 Community Analytics target이 없습니다.</strong>
            <br />
            API Key나 Group ID를 임의로 만들지 않고 실제 권한 검증 후에만 등록합니다.
          </div>
        )}

        <div className="section-head">
          <h2>저장 범위</h2>
        </div>
        <p>
          Category·Post·Comment의 관측 개수, 스캔 범위, 잘림 여부, 수집 시각과
          출처만 저장합니다. Forum 본문·작성자·사용자 ID는 저장하지 않습니다.
          제한 또는 페이지네이션이 있으면 전체 총계로 표현하지 않고 관측치로
          취급합니다.
        </p>
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { moderateContentAction } from "@/app/actions/community";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  getCommunityPermissions,
  getModerationReports,
} from "@/lib/community/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Moderation Queue",
  robots: { index: false, follow: false },
};

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [user, token, games, params] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
    getGameCatalog(),
    searchParams,
  ]);
  if (!user || !token) redirect("/login?next=/admin/moderation");

  const permissions = await getCommunityPermissions(token);
  if (!["moderator", "admin"].includes(permissions.role ?? "")) redirect("/");

  const reports = await getModerationReports(token);

  return (
    <>
      <Header games={games} />
      <main className="page community-page">
        <div className="page-title">
          <h1>Moderation Queue</h1>
          <p>신고 → 검토 → 숨김/복원 → 처리 상태 기록 흐름입니다.</p>
        </div>

        {params.error && <div className="callout danger">{params.error}</div>}
        {params.saved && <div className="callout">운영 조치를 기록했습니다.</div>}

        <div className="moderation-list">
          {reports.length ? (
            reports.map((report) => (
              <article className="moderation-card" key={report.id}>
                <div className="community-meta">
                  {report.status.toUpperCase()} · {report.target_type} ·{" "}
                  {formatKstDateTime(report.created_at)}
                </div>
                <h2>{report.reason}</h2>
                <p>{report.details || "상세 설명 없음"}</p>
                <code>{report.target_id}</code>

                <form action={moderateContentAction} className="compact-form">
                  <input type="hidden" name="report_id" value={report.id} />
                  <input
                    type="hidden"
                    name="target_type"
                    value={report.target_type}
                  />
                  <input
                    type="hidden"
                    name="target_id"
                    value={report.target_id}
                  />
                  <label>
                    운영 메모
                    <input
                      name="reason"
                      maxLength={1000}
                      placeholder="조치 사유"
                    />
                  </label>
                  <div className="button-row">
                    {["question", "answer", "comment", "party", "post", "post_comment"].includes(
                      report.target_type,
                    ) && (
                      <>
                        <button
                          className="danger-button"
                          name="action"
                          value="hide"
                          type="submit"
                        >
                          콘텐츠 숨김
                        </button>
                        <button
                          className="secondary-button"
                          name="action"
                          value="restore"
                          type="submit"
                        >
                          복원
                        </button>
                      </>
                    )}
                    <button
                      className="primary-button"
                      name="action"
                      value="resolve_report"
                      type="submit"
                    >
                      신고 해결
                    </button>
                    <button
                      className="text-button"
                      name="action"
                      value="dismiss_report"
                      type="submit"
                    >
                      신고 기각
                    </button>
                  </div>
                </form>
              </article>
            ))
          ) : (
            <div className="no-data">현재 신고 큐가 비어 있습니다.</div>
          )}
        </div>
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import {
  approveCodeReviewAction,
  approveGuideReviewAction,
  archiveGuideAction,
  createCodeAction,
  createContentSourceAction,
  createGuideAction,
  expireCodeAction,
  publishCodeAction,
  publishGuideAction,
  rejectCodeReviewAction,
  rejectGuideReviewAction,
  reverifyCodeAction,
  submitCodeReviewAction,
  submitGuideReviewAction,
} from "@/app/actions/content";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import {
  getAdminCodes,
  getAdminGuides,
  getContentSources,
} from "@/lib/content/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Content Studio · 내부",
  robots: { index: false, follow: false },
};

export default async function ContentStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, token, games, params] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
    getGameCatalog(),
    searchParams,
  ]);
  if (!user || !token) redirect("/login?next=/admin/content");

  const permissions = await getCommunityPermissions(token);
  if (permissions.role !== "admin" || !permissions.active) redirect("/");

  const [sources, guides, codes] = await Promise.all([
    getContentSources(),
    getAdminGuides(token),
    getAdminCodes(token),
  ]);
  const gameMap = new Map(games.map((game) => [game.universeId, game]));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const saved = Object.keys(params).some(
    (key) =>
      key.endsWith("_saved") ||
      key.endsWith("_archived") ||
      key.endsWith("_expired") ||
      key.endsWith("_checked") ||
      key.endsWith("_requested") ||
      key.endsWith("_approved") ||
      key.endsWith("_rejected") ||
      key.endsWith("_published"),
  );

  return (
    <>
      <Header games={games} />
      <main className="page content-admin">
        <div className="page-title">
          <h1>Content Studio</h1>
          <p>
            출처 등록 → 초안 → 검토 요청 → 승인 → 공개 순서로 운영합니다.
            승인되지 않은 코드·가이드는 DB에서 published 상태로 바꿀 수 없습니다.
          </p>
        </div>

        {params.error && <div className="callout danger">{params.error}</div>}
        {saved && <div className="callout">변경 사항을 저장했습니다.</div>}

        <div className="editor-grid">
          <section className="panel">
            <h2>1. 출처 등록</h2>
            <form action={createContentSourceAction} className="stack-form">
              <label>
                게임
                <select name="universe_id" required>
                  <option value="">선택</option>
                  {games.map((game) => (
                    <option key={game.universeId} value={game.universeId}>
                      {game.nameKo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                출처 유형
                <select name="source_type" defaultValue="official_game_page">
                  <option value="official_game_page">공식 게임 페이지</option>
                  <option value="official_group">공식 그룹</option>
                  <option value="official_social">공식 소셜</option>
                  <option value="official_docs">공식 문서</option>
                  <option value="in_game_verified">게임 내 직접 확인</option>
                  <option value="other">기타</option>
                </select>
              </label>
              <label>
                출처 이름
                <input name="label" minLength={2} maxLength={120} required />
              </label>
              <label>
                HTTPS URL
                <input name="source_url" type="url" pattern="https://.*" required />
              </label>
              <button className="primary-button" type="submit">
                출처 저장
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>2. 코드 등록</h2>
            <form action={createCodeAction} className="stack-form">
              <label>
                게임
                <select name="universe_id" required>
                  <option value="">선택</option>
                  {games.map((game) => (
                    <option key={game.universeId} value={game.universeId}>
                      {game.nameKo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                검증 출처
                <select name="source_id" required>
                  <option value="">선택</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {gameMap.get(Number(source.universe_id))?.nameKo ?? "공통"} ·{" "}
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                코드
                <input name="code" maxLength={120} required />
              </label>
              <label>
                보상
                <input name="reward_text" maxLength={500} />
              </label>
              <label>
                상태
                <select name="code_status" defaultValue="active">
                  <option value="active">활성 확인</option>
                  <option value="expired">만료 확인</option>
                  <option value="unknown">재확인 필요</option>
                </select>
              </label>
              <label>
                메모
                <textarea name="notes" maxLength={1000} rows={3} />
              </label>
              <label className="check-line">
                <input name="submit_review" type="checkbox" />
                <span>저장 후 검토 요청</span>
              </label>
              <button className="primary-button" type="submit">
                코드 저장
              </button>
            </form>
          </section>
        </div>

        <section className="panel guide-editor">
          <h2>3. 가이드 등록</h2>
          <form action={createGuideAction} className="stack-form">
            <div className="editor-grid">
              <label>
                게임
                <select name="universe_id" required>
                  <option value="">선택</option>
                  {games.map((game) => (
                    <option key={game.universeId} value={game.universeId}>
                      {game.nameKo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                출처
                <select name="source_id" required>
                  <option value="">선택</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {gameMap.get(Number(source.universe_id))?.nameKo ?? "공통"} ·{" "}
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                유형
                <select name="guide_type" defaultValue="guide">
                  <option value="beginner">초보</option>
                  <option value="mechanic">시스템</option>
                  <option value="progression">성장</option>
                  <option value="troubleshooting">문제 해결</option>
                  <option value="faq">FAQ</option>
                  <option value="guide">일반 가이드</option>
                </select>
              </label>
              <label>
                URL slug
                <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
              </label>
            </div>
            <label>
              제목
              <input name="title" minLength={5} maxLength={120} required />
            </label>
            <label>
              요약
              <textarea name="summary" minLength={20} maxLength={400} rows={3} required />
            </label>
            <label>
              본문
              <textarea name="body" minLength={100} maxLength={20000} rows={12} required />
            </label>
            <label className="check-line">
              <input name="submit_review" type="checkbox" />
              <span>저장 후 검토 요청</span>
            </label>
            <button className="primary-button" type="submit">
              가이드 저장
            </button>
          </form>
        </section>

        <div className="section-head">
          <h2>가이드 상태</h2>
          <span>{guides.length}개</span>
        </div>
        <div className="admin-content-list">
          {guides.map((guide) => (
            <article className="admin-content-row" key={guide.id}>
              <div>
                <strong>
                  {gameMap.get(Number(guide.universe_id))?.nameKo ?? guide.universe_id} ·{" "}
                  {guide.title}
                </strong>
                <span>
                  {guide.content_status} · review:{guide.review_status} · {guide.index_state} ·{" "}
                  {formatKstDateTime(guide.updated_at)}
                </span>
                {guide.review_note && <span>검토 메모: {guide.review_note}</span>}
              </div>
              <div className="button-row">
                {(guide.review_status === "draft" || guide.review_status === "rejected") &&
                  guide.content_status !== "archived" && (
                    <form action={submitGuideReviewAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button className="secondary-button" type="submit">
                        검토 요청
                      </button>
                    </form>
                  )}
                {guide.review_status === "pending" && (
                  <>
                    <form action={approveGuideReviewAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button className="secondary-button" type="submit">
                        검토 승인
                      </button>
                    </form>
                    <form action={rejectGuideReviewAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button className="text-button" type="submit">
                        반려
                      </button>
                    </form>
                  </>
                )}
                {guide.review_status === "approved" &&
                  guide.content_status === "draft" && (
                    <form action={publishGuideAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <label className="check-line compact-check">
                        <input name="indexable" type="checkbox" />
                        <span>색인 후보</span>
                      </label>
                      <button className="primary-button" type="submit">
                        공개
                      </button>
                    </form>
                  )}
                {guide.content_status !== "archived" && (
                  <form action={archiveGuideAction}>
                    <input type="hidden" name="id" value={guide.id} />
                    <button className="text-button" type="submit">
                      보관
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="section-head">
          <h2>코드 상태</h2>
          <span>{codes.length}개</span>
        </div>
        <div className="admin-content-list">
          {codes.map((code) => {
            const source = code.source_id ? sourceMap.get(code.source_id) : null;
            return (
              <article className="admin-content-row" key={code.id}>
                <div>
                  <strong>
                    {gameMap.get(Number(code.universe_id))?.nameKo ?? code.universe_id} ·{" "}
                    <code>{code.code}</code>
                  </strong>
                  <span>
                    {code.visibility} · {code.code_status} · review:{code.review_status} ·{" "}
                    {source?.label ?? "출처 없음"} ·{" "}
                    {formatKstDateTime(code.last_checked_at)}
                  </span>
                  {code.review_note && <span>검토 메모: {code.review_note}</span>}
                </div>
                <div className="button-row">
                  <form action={reverifyCodeAction}>
                    <input type="hidden" name="id" value={code.id} />
                    <label className="check-line compact-check">
                      <input
                        name="active"
                        type="checkbox"
                        defaultChecked={code.code_status === "active"}
                      />
                      <span>활성</span>
                    </label>
                    <button className="secondary-button" type="submit">
                      재확인
                    </button>
                  </form>
                  {(code.review_status === "draft" || code.review_status === "rejected") &&
                    code.visibility !== "archived" && (
                      <form action={submitCodeReviewAction}>
                        <input type="hidden" name="id" value={code.id} />
                        <button className="secondary-button" type="submit">
                          검토 요청
                        </button>
                      </form>
                    )}
                  {code.review_status === "pending" && (
                    <>
                      <form action={approveCodeReviewAction}>
                        <input type="hidden" name="id" value={code.id} />
                        <button className="secondary-button" type="submit">
                          검토 승인
                        </button>
                      </form>
                      <form action={rejectCodeReviewAction}>
                        <input type="hidden" name="id" value={code.id} />
                        <button className="text-button" type="submit">
                          반려
                        </button>
                      </form>
                    </>
                  )}
                  {code.review_status === "approved" &&
                    code.visibility === "draft" && (
                      <form action={publishCodeAction}>
                        <input type="hidden" name="id" value={code.id} />
                        <button className="primary-button" type="submit">
                          공개
                        </button>
                      </form>
                    )}
                  {code.code_status !== "expired" && (
                    <form action={expireCodeAction}>
                      <input type="hidden" name="id" value={code.id} />
                      <button className="text-button" type="submit">
                        만료 처리
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

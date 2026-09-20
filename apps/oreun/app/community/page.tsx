import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { getQuestionFeed } from "@/lib/community/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "게임 Q&A",
  description: "게임별 질문과 답변을 모아보는 오름 커뮤니티입니다.",
  robots: { index: false, follow: true },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const [games, questions, params] = await Promise.all([
    getGameCatalog(),
    getQuestionFeed({ limit: 40 }),
    searchParams,
  ]);

  return (
    <>
      <Header games={games} />
      <main className="page community-page">
        <div className="page-title">
          <span className="eyebrow">GAME-CONTEXT Q&A</span>
          <h1>게임 Q&A</h1>
          <p>
            자유게시판보다 게임 문맥을 먼저 봅니다. 질문과 파티 모집은 각
            Game Hub에 연결되며 계정 거래·핵·개인정보·외부 연락처 공유는
            허용하지 않습니다.
          </p>
        </div>

        {params.error && <div className="callout danger">{params.error}</div>}
        {params.reported && <div className="callout">신고가 접수됐습니다.</div>}

        <div className="community-actions">
          <Link href="/games" className="secondary-button">
            게임에서 질문하기
          </Link>
          <Link href="/games" className="secondary-button">
            게임별 파티 찾기
          </Link>
          <Link href="/guidelines">가이드라인 →</Link>
        </div>

        <section className="question-list" aria-label="최근 질문">
          {questions.length ? (
            questions.map((question) => (
              <article className="question-row" key={question.id}>
                <div>
                  <Link
                    className="question-game"
                    href={`/game/${question.game_slug}/questions`}
                  >
                    {question.game_name_ko}
                  </Link>
                  <h2>
                    <Link href={`/questions/${question.id}`}>
                      {question.title}
                    </Link>
                  </h2>
                  <p>{question.body}</p>
                  <div className="community-meta">
                    {question.author_name} ·{" "}
                    {formatKstDateTime(question.created_at)}
                  </div>
                </div>
                <div className="question-counts">
                  <strong>{question.answer_count}</strong>
                  <span>답변</span>
                  <small>{question.comment_count} 댓글</small>
                </div>
              </article>
            ))
          ) : (
            <div className="community-empty-grid">
              <div className="community-empty-card">
                <span>01</span>
                <strong>게임을 먼저 고르세요</strong>
                <p>질문은 자유게시판이 아니라 각 게임 문맥에 연결됩니다.</p>
                <Link href="/games">게임 찾기 →</Link>
              </div>
              <div className="community-empty-card">
                <span>02</span>
                <strong>검증 가이드를 확인하세요</strong>
                <p>공식 Roblox 설명으로 답할 수 있는 내용은 먼저 가이드에서 확인할 수 있습니다.</p>
                <Link href="/guides">검증 가이드 →</Link>
              </div>
              <div className="community-empty-card">
                <span>03</span>
                <strong>같이 할 사람을 찾으세요</strong>
                <p>게임별 파티 모집은 외부 연락처 없이 오름 안에서 참여합니다.</p>
                <Link href="/games">게임별 파티 찾기 →</Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

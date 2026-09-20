import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { createQuestionAction } from "@/app/actions/community";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import {
  getCommunityPermissions,
  getQuestionFeed,
} from "@/lib/community/queries";
import { formatKstDateTime } from "@/lib/format";
import { getPublishedGuides } from "@/lib/content/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "게임 질문",
  robots: { index: false, follow: true },
};

export default async function GameQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [game, games, user, token] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!game) notFound();

  const [questions, permissions, guides] = await Promise.all([
    getQuestionFeed({ gameUniverseId: game.universeId, limit: 50 }),
    token ? getCommunityPermissions(token).catch(() => null) : null,
    getPublishedGuides(game.universeId).catch(() => []),
  ]);
  const canPost = Boolean(
    user &&
      token &&
      permissions?.active &&
      permissions.age_confirmed_14_plus,
  );

  return (
    <>
      <Header games={games} />
      <main className="page community-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 질문
        </div>
        <div className="page-title">
          <h1>{game.nameKo} Q&A</h1>
          <p>
            이 게임에 대한 질문과 답변만 모읍니다. 데이터 화면은{" "}
            <Link href={`/game/${game.slug}`}>Game Hub</Link>에서 확인합니다.
          </p>
        </div>

        {query.error && <div className="callout danger">{query.error}</div>}

        {canPost ? (
          <section className="panel ask-panel">
            <h2>질문하기</h2>
            <form action={createQuestionAction} className="stack-form">
              <input
                type="hidden"
                name="game_universe_id"
                value={game.universeId}
              />
              <input type="hidden" name="game_slug" value={game.slug} />
              <label>
                제목
                <input
                  name="title"
                  minLength={5}
                  maxLength={120}
                  required
                  placeholder="무엇이 궁금한가요?"
                />
              </label>
              <label>
                내용
                <textarea
                  name="body"
                  minLength={10}
                  maxLength={5000}
                  required
                  rows={6}
                  placeholder="상황을 구체적으로 적으면 답변하기 쉬워집니다."
                />
              </label>
              <button className="primary-button" type="submit">
                질문 등록
              </button>
            </form>
          </section>
        ) : (
          <div className="callout">
            <strong>질문 작성은 로그인 후 가능합니다.</strong>
            <br />
            만 14세 이상 확인이 완료된 활성 계정만 글을 작성할 수 있습니다.{" "}
            <Link href={`/login?next=/game/${game.slug}/questions`}>
              로그인 →
            </Link>
          </div>
        )}

        <div className="section-head">
          <h2>최근 질문</h2>
          <span>{questions.length}개</span>
        </div>
        <section className="question-list">
          {questions.length ? (
            questions.map((question) => (
              <article className="question-row" key={question.id}>
                <div>
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
            <div className="community-empty-state">
              <span className="eyebrow">FIRST QUESTION</span>
              <strong>{game.nameKo}의 첫 질문을 기다리고 있습니다.</strong>
              <p>
                실제로 막힌 상황을 구체적으로 적어 주세요. 존재하지 않는 질문이나
                답변을 채워 넣지 않습니다.
              </p>
              <div className="button-row">
                {guides.length > 0 && (
                  <Link
                    className="secondary-button"
                    href={"/game/" + game.slug + "/guides"}
                  >
                    먼저 검증 가이드 보기
                  </Link>
                )}
                <Link className="secondary-button" href={"/game/" + game.slug}>
                  게임 데이터 보기
                </Link>
                {!canPost && (
                  <Link
                    className="primary-button"
                    href={"/login?next=/game/" + game.slug + "/questions"}
                  >
                    로그인하고 질문하기
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

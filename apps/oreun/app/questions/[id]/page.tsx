import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ReportForm from "@/components/community/ReportForm";
import {
  acceptAnswerAction,
  closeQuestionAction,
  createAnswerAction,
  createCommentAction,
} from "@/app/actions/community";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  getAnswerComments,
  getAnswers,
  getCommunityPermissions,
  getQuestion,
  getQuestionComments,
} from "@/lib/community/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "질문",
  robots: { index: false, follow: true },
};

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [question, games, user, token] = await Promise.all([
    getQuestion(id),
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!question) notFound();

  const [answers, questionComments, permissions] = await Promise.all([
    getAnswers(question.id),
    getQuestionComments(question.id),
    token ? getCommunityPermissions(token).catch(() => null) : null,
  ]);
  const answerComments = await getAnswerComments(
    answers.map((answer) => answer.id),
  );
  const commentGroups = new Map<string, typeof answerComments>();
  for (const comment of answerComments) {
    if (!comment.answer_id) continue;
    const rows = commentGroups.get(comment.answer_id) ?? [];
    rows.push(comment);
    commentGroups.set(comment.answer_id, rows);
  }

  const canPost = Boolean(
    user &&
      token &&
      permissions?.active &&
      permissions.age_confirmed_14_plus,
  );
  const ownsQuestion = user?.id === question.author_id;

  return (
    <>
      <Header games={games} />
      <main className="page community-page">
        <div className="breadcrumb">
          <Link href={`/game/${question.game_slug}`}>
            {question.game_name_ko}
          </Link>{" "}
          /{" "}
          <Link href={`/game/${question.game_slug}/questions`}>Q&A</Link>
        </div>

        {query.error && <div className="callout danger">{query.error}</div>}
        {query.reported && <div className="callout">신고가 접수됐습니다.</div>}

        <article className="question-detail">
          <div className="community-meta">
            {question.status.toUpperCase()} · {question.author_name} ·{" "}
            {formatKstDateTime(question.created_at)}
          </div>
          <h1>{question.title}</h1>
          <p className="ugc-body">{question.body}</p>
          <div className="button-row">
            <ReportForm
              targetType="question"
              targetId={question.id}
              questionId={question.id}
            />
            {ownsQuestion && question.status !== "closed" && (
              <form action={closeQuestionAction}>
                <input type="hidden" name="question_id" value={question.id} />
                <button type="submit" className="text-button">
                  질문 닫기
                </button>
              </form>
            )}
          </div>
        </article>

        <section id="comments" className="thread-section">
          <div className="section-head">
            <h2>질문 댓글</h2>
            <span>{questionComments.length}개</span>
          </div>
          {questionComments.map((comment) => (
            <div className="comment-row" key={comment.id}>
              <div>
                <strong>{comment.author_name}</strong>
                <p>{comment.body}</p>
                <small>{formatKstDateTime(comment.created_at)}</small>
              </div>
              <ReportForm
                targetType="comment"
                targetId={comment.id}
                questionId={question.id}
              />
            </div>
          ))}
          {canPost && (
            <form action={createCommentAction} className="inline-comment-form">
              <input type="hidden" name="question_id" value={question.id} />
              <input
                name="body"
                minLength={2}
                maxLength={1500}
                required
                placeholder="질문에 댓글 남기기"
              />
              <button type="submit" className="secondary-button">
                댓글
              </button>
            </form>
          )}
        </section>

        <section id="answers" className="thread-section">
          <div className="section-head">
            <h2>답변</h2>
            <span>{answers.length}개</span>
          </div>

          {answers.length ? (
            answers.map((answer) => {
              const comments = commentGroups.get(answer.id) ?? [];
              return (
                <article
                  className={`answer-card ${answer.is_accepted ? "accepted" : ""}`}
                  key={answer.id}
                >
                  <div className="answer-topline">
                    <div>
                      <strong>{answer.author_name}</strong>
                      <span>{formatKstDateTime(answer.created_at)}</span>
                    </div>
                    {answer.is_accepted && (
                      <span className="accepted-badge">채택됨</span>
                    )}
                  </div>
                  <p className="ugc-body">{answer.body}</p>

                  <div className="button-row">
                    <ReportForm
                      targetType="answer"
                      targetId={answer.id}
                      questionId={question.id}
                    />
                    {ownsQuestion &&
                      !answer.is_accepted &&
                      question.status !== "closed" && (
                        <form action={acceptAnswerAction}>
                          <input
                            type="hidden"
                            name="question_id"
                            value={question.id}
                          />
                          <input
                            type="hidden"
                            name="answer_id"
                            value={answer.id}
                          />
                          <button type="submit" className="secondary-button">
                            답변 채택
                          </button>
                        </form>
                      )}
                  </div>

                  {comments.length > 0 && (
                    <div className="answer-comments">
                      {comments.map((comment) => (
                        <div className="comment-row compact" key={comment.id}>
                          <div>
                            <strong>{comment.author_name}</strong>
                            <p>{comment.body}</p>
                            <small>{formatKstDateTime(comment.created_at)}</small>
                          </div>
                          <ReportForm
                            targetType="comment"
                            targetId={comment.id}
                            questionId={question.id}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {canPost && question.status !== "closed" && (
                    <form
                      action={createCommentAction}
                      className="inline-comment-form"
                    >
                      <input
                        type="hidden"
                        name="question_id"
                        value={question.id}
                      />
                      <input type="hidden" name="answer_id" value={answer.id} />
                      <input
                        name="body"
                        minLength={2}
                        maxLength={1500}
                        required
                        placeholder="답변에 댓글"
                      />
                      <button type="submit" className="text-button">
                        댓글
                      </button>
                    </form>
                  )}
                </article>
              );
            })
          ) : (
            <div className="no-data">
              <strong>아직 답변이 없습니다.</strong>
            </div>
          )}

          {canPost && question.status !== "closed" ? (
            <section className="panel answer-form">
              <h2>답변 작성</h2>
              <form action={createAnswerAction} className="stack-form">
                <input type="hidden" name="question_id" value={question.id} />
                <label>
                  답변
                  <textarea
                    name="body"
                    minLength={2}
                    maxLength={5000}
                    rows={7}
                    required
                    placeholder="직접 확인한 방법이나 근거를 구체적으로 적어 주세요."
                  />
                </label>
                <button type="submit" className="primary-button">
                  답변 등록
                </button>
              </form>
            </section>
          ) : !user ? (
            <div className="callout">
              답변을 쓰려면{" "}
              <Link href={`/login?next=/questions/${question.id}`}>
                로그인
              </Link>
              이 필요합니다.
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

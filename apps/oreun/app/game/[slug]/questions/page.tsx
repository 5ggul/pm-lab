import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import CommunityAccess from "@/components/CommunityAccess";
import QuestionComposer from "@/components/QuestionComposer";
import QuestionFeedControls, { QuestionPagination } from "@/components/QuestionFeedControls";
import { submitQuestion } from "@/app/actions/community-experience";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import { getFilteredQuestions } from "@/lib/community/experience";
import { normalizeFeedFilters, writeAccess } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";
import { getPublishedGuides } from "@/lib/content/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "게임 질문", robots: { index: false, follow: true } };
export default async function GameQuestionsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; state?: string; page?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [game, games, user, token] = await Promise.all([getGameBySlug(slug), getGameCatalog(), getCurrentUser(), getCurrentAccessToken()]);
  if (!game) notFound();
  const filters = { ...normalizeFeedFilters(query), game: game.slug, scope: "all" as const };
  const [feed, permissions, guides] = await Promise.all([
    getFilteredQuestions(filters).then(result => ({ ...result, failed: false })).catch(() => ({ rows: [], hasNext: false, failed: true })),
    token ? getCommunityPermissions(token).catch(() => null) : null,
    getPublishedGuides(game.universeId).catch(() => []),
  ]);
  const access = writeAccess(Boolean(user && token), permissions);
  const path = `/game/${game.slug}/questions`;
  return <>
    <Header games={games} />
    <main className="page community-page">
      <div className="breadcrumb"><Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 질문</div>
      <div className="page-title"><h1>{game.nameKo} Q&A</h1><p>막힌 부분을 묻고 해결한 방법을 나누세요. 게임 정보는 <Link href={`/game/${game.slug}`}>게임 한눈에</Link>에서 볼 수 있습니다.</p></div>
      {query.error && <div className="callout danger" role="alert">{query.error.slice(0, 180)}</div>}
      {access === "ready" && user ? <QuestionComposer key={`${user.id}:${game.slug}`} userId={user.id} gameSlug={game.slug} universeId={game.universeId} initialRequestId={randomUUID()} action={submitQuestion} /> : <CommunityAccess access={access} next={path} />}
      <QuestionFeedControls path={path} filters={filters} showScope={false} />
      <div className="section-head"><h2>질문 목록</h2><span>이 페이지 {feed.rows.length}개</span></div>
      {feed.failed ? <div className="callout danger" role="alert">질문을 불러오지 못했습니다. <a href={path}>다시 확인하기</a></div> : <section className="question-list">
        {feed.rows.length ? feed.rows.map(question => <article className="question-row" key={question.id}>
          <div><h2><Link href={`/questions/${question.id}`}>{question.title}</Link></h2><p>{question.body}</p><div className="community-meta">{question.accepted_answer_id ? "해결됨 · " : ""}{question.author_name} · {formatKstDateTime(question.created_at)}</div></div>
          <div className="question-counts"><strong>{question.answer_count}</strong><span>답변</span><small>{question.comment_count} 댓글</small></div>
        </article>) : <div className="community-empty-state">
          <strong>{filters.state === "latest" && filters.page === 1 ? `${game.nameKo}의 첫 질문을 기다리고 있습니다.` : "이 조건에 맞는 질문이 없습니다."}</strong>
          <p>{filters.state === "unanswered" ? "현재 답변을 기다리는 열린 질문이 없습니다." : filters.state === "resolved" ? "답변이 채택되면 여기에서 다시 찾아볼 수 있습니다." : "궁금한 내용은 위에서 질문하고, 기본적인 진행 방법은 가이드에서 확인해 보세요."}</p>
          <div className="button-row">{guides.length > 0 && <Link className="secondary-button" href={`/game/${game.slug}/guides`}>먼저 검증 가이드 보기</Link>}<Link className="secondary-button" href={`/game/${game.slug}`}>게임 데이터 보기</Link>{filters.state !== "latest" && <Link className="secondary-button" href={path}>최근 질문 보기</Link>}</div>
        </div>}
      </section>}
      <QuestionPagination path={path} filters={filters} hasNext={feed.hasNext} />
    </main>
  </>;
}

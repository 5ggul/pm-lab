import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import QuestionFeedControls, { QuestionPagination } from "@/components/QuestionFeedControls";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getFilteredQuestions, getFollowingIds } from "@/lib/community/experience";
import { normalizeFeedFilters, feedHref } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";
import CommunityTiles from "@/components/CommunityTiles";
import PlayIcon from "@/components/PlayIcon";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 · 질문답변", description: "자유 톡과 게임별 질문답변을 이용하세요.", robots: { index: false, follow: true } };
export default async function CommunityPage({ searchParams }: {
  searchParams: Promise<{ error?: string; reported?: string; state?: string; game?: string; scope?: string; page?: string }>;
}) {
  const [games, params] = await Promise.all([getGameCatalog(), searchParams]);
  const filters = normalizeFeedFilters(params);
  const unknownGame = Boolean(filters.game && !games.some(game => game.slug === filters.game));
  let followingIds: number[] = [];
  let needsLogin = false;
  let failed = false;
  if (filters.scope === "following") {
    try {
      const [user, token] = await Promise.all([getCurrentUser(), getCurrentAccessToken()]);
      if (!user || !token) needsLogin = true;
      else followingIds = await getFollowingIds(token, user.id);
    } catch { failed = true; }
  }
  const feed = !needsLogin && !failed && !unknownGame ? await getFilteredQuestions(filters, followingIds).catch(() => { failed = true; return { rows: [], hasNext: false }; }) : { rows: [], hasNext: false };
  const returnPath = feedHref("/community", filters);
  const selectedGame = filters.game ? games.find(game => game.slug === filters.game) ?? null : null;
  const questionHref = selectedGame ? `/game/${selectedGame.slug}/questions` : "/games";
  const partyHref = selectedGame ? `/game/${selectedGame.slug}/party` : "/games";
  return <>
    <Header games={games} />
    <main className="page community-page">
      <div className="community-hero question-hero"><span className="community-kicker"><PlayIcon name="help"/> 질문답변</span><h1>막히면 묻고, 알면 알려줘요!</h1><p>로블잼 커뮤니티는 질문만 있는 곳이 아니에요. 자유 톡, 공략, 업데이트, 파티도 바로 오갈 수 있습니다.</p></div><nav className="community-switcher" aria-label="커뮤니티 메뉴"><Link href="/community/free">자유</Link><Link aria-current="page" href="/community">질문답변</Link><Link href="/guides">공략</Link><Link href="/updates">업데이트</Link><Link href="/games?intent=party">파티 모집</Link></nav><CommunityTiles/>
      {params.error && <div className="callout danger" role="alert">{params.error.slice(0,180)}</div>}
      {params.reported && <div className="callout" role="status">신고가 접수됐습니다.</div>}
      <div className="community-actions"><Link href={questionHref} className="secondary-button">{selectedGame ? `${selectedGame.nameKo}에 질문하기` : "게임 골라 질문하기"}</Link><Link href={partyHref} className="secondary-button">{selectedGame ? `${selectedGame.nameKo} 파티 찾기` : "게임 골라 파티 찾기"}</Link><Link href="/guidelines">이용규칙 →</Link></div>
      <QuestionFeedControls path="/community" filters={filters} games={games} />
      {failed ? <div className="callout danger" role="alert">질문을 불러오지 못했습니다. <a href={returnPath}>다시 확인하기</a></div> : needsLogin ? <div className="callout"><strong>내 관심 게임은 로그인 후 볼 수 있습니다.</strong><p>팔로우한 게임의 질문만 모아서 보여드립니다.</p><Link className="secondary-button" href={`/login?next=${encodeURIComponent(returnPath)}`}>Google 로그인</Link></div> : unknownGame ? <div className="no-data">선택한 게임을 찾지 못했습니다. <Link href="/community">모든 게임 보기</Link></div> : filters.scope === "following" && !followingIds.length ? <div className="no-data"><strong>아직 팔로우한 게임이 없습니다.</strong><p>관심 있는 게임을 팔로우하면 그 게임의 질문을 여기에서 볼 수 있습니다.</p><Link className="secondary-button" href="/games">관심 게임 고르기</Link></div> : <>
        <section className="question-list" aria-label="질문 목록">
          {feed.rows.length ? feed.rows.map(question => <article className="question-row" key={question.id}>
            <div><Link className="question-game" href={`/game/${question.game_slug}/questions`}>{question.game_name_ko}</Link><h2><Link href={`/questions/${question.id}`}>{question.title}</Link></h2><p>{question.body}</p><div className="community-meta">{question.accepted_answer_id ? "해결됨 · " : ""}{question.author_name} · {formatKstDateTime(question.created_at)}</div></div>
            <div className="question-counts"><strong>{question.answer_count}</strong><span>답변</span><small>{question.comment_count} 댓글</small></div>
          </article>) : filters.state !== "latest" || filters.game || filters.page > 1 ? <div className="no-data"><strong>이 조건에 맞는 질문이 없습니다.</strong><p>게임이나 질문 조건을 바꿔 보세요.</p><Link href="/community">전체 최근 질문 보기 →</Link></div> : <div className="community-empty-grid">
            <div className="community-empty-card"><span>01</span><strong>궁금한 게임을 고르세요</strong><p>게임 화면에서 질문을 쓰거나 먼저 올라온 질문을 볼 수 있습니다.</p><Link href="/games">게임 찾기 →</Link></div>
            <div className="community-empty-card"><span>02</span><strong>기본 진행 방법이 궁금한가요?</strong><p>공략에서 기본 조작과 시작 방법을 먼저 확인할 수 있습니다.</p><Link href="/guides">공략 보기 →</Link></div>
            <div className="community-empty-card"><span>03</span><strong>같이 할 사람을 찾으세요</strong><p>게임별 파티 모집에서 다른 이용자와 함께할 수 있습니다.</p><Link href="/games">게임별 파티 찾기 →</Link></div>
          </div>}
        </section>
        <QuestionPagination path="/community" filters={filters} hasNext={feed.hasNext} />
      </>}
    </main>
  </>;
}

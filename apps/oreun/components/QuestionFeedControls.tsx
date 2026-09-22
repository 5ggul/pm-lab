import Link from "next/link";
import { feedHref, type FeedFilters } from "@/lib/community/experience-model";
import styles from "./community-experience.module.css";
export default function QuestionFeedControls({ path, filters, games, showScope = true }: { path: string; filters: FeedFilters; games?: Array<{ slug: string; nameKo: string }>; showScope?: boolean }) {
  return <div className={styles.toolbar}>
    <nav aria-label="질문 보기" className={styles.tabs}>
      {([['latest', '최근 질문'], ['unanswered', '답변 없는 질문'], ['resolved', '해결된 질문']] as const).map(([state, label]) => <Link key={state} href={feedHref(path, { ...filters, state, page: 1 })} aria-current={filters.state === state ? "page" : undefined}>{label}</Link>)}
    </nav>
    {(games || showScope) && <form action={path} method="get" className={styles.filters}>
      <input type="hidden" name="state" value={filters.state} />
      {games ? <label>게임<select name="game" defaultValue={filters.game}><option value="">모든 게임</option>{games.map(game => <option key={game.slug} value={game.slug}>{game.nameKo}</option>)}</select></label> : filters.game && <input type="hidden" name="game" value={filters.game} />}
      {showScope && <label>관심 범위<select name="scope" defaultValue={filters.scope}><option value="all">전체 게임</option><option value="following">내 관심 게임</option></select></label>}
      <button type="submit" className="secondary-button">적용</button>
    </form>}
    {filters.state === "unanswered" && <p className={styles.note}>아직 공개 답변이 없는 열린 질문입니다. 답변이 등록되면 이 목록에서 빠집니다.</p>}
    {filters.state === "resolved" && <p className={styles.note}>질문자가 답변을 채택한 질문입니다.</p>}
  </div>;
}
export function QuestionPagination({ path, filters, hasNext }: { path: string; filters: FeedFilters; hasNext: boolean }) {
  if (filters.page === 1 && !hasNext) return null;
  return <nav aria-label="질문 페이지" className={styles.pagination}>
    {filters.page > 1 && <Link href={feedHref(path, { ...filters, page: filters.page - 1 })}>이전</Link>}
    <span>{filters.page}페이지</span>
    {hasNext && filters.page < 100 && <Link href={feedHref(path, { ...filters, page: filters.page + 1 })}>다음</Link>}
  </nav>;
}

import Link from "next/link";
import SearchBox from "./SearchBox";
import type { GameView } from "@/lib/types";

export default function Header({ games = [] }: { games?: GameView[] }) {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="오름 홈">
          <span className="brand-mark">오름</span>
          <span className="brand-sub">뜨는 게임의 기록</span>
        </Link>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          <Link href="/games">지금 플레이</Link>
          <Link href="/rising">급상승</Link>
          <Link href="/updates">업데이트</Link>
          <Link href="/guides">가이드</Link>
          <Link href="/compare">비교</Link>
          <Link href="/community">Q&A</Link>
          <Link href="/me">MY</Link>
        </nav>
      </div>
      {games.length > 0 && (
        <div className="header-search">
          <SearchBox games={games} compact />
        </div>
      )}
    </header>
  );
}

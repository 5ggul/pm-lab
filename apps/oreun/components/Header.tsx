import Link from "next/link";
import SearchBox from "./SearchBox";
import BrandMascot from "./BrandMascot";
import PlayIcon from "./PlayIcon";
import type { GameView } from "@/lib/types";

export default function Header({ games = [] }: { games?: GameView[] }) {
  return <header className="site-header">
    <div className="nav-shell">
      <Link prefetch={false} className="brand brand-roblejam" href="/" aria-label="로블잼 홈">
        <span className="brand-mascot-wrap"><BrandMascot className="brand-mascot"/></span>
        <span className="brand-copy"><span className="brand-mark">로블<span>잼</span></span><small>게임하는 친구들이 모이는 곳</small></span>
      </Link>
      <nav className="desktop-nav playful-nav" aria-label="주요 메뉴">
        <Link prefetch={false} href="/"><PlayIcon name="home"/>홈</Link>
        <Link prefetch={false} href="/community/free"><PlayIcon name="chat"/>자유</Link>
        <Link prefetch={false} href="/community"><PlayIcon name="help"/>질문답변</Link>
        <Link prefetch={false} href="/guides"><PlayIcon name="book"/>공략</Link>
        <Link prefetch={false} href="/updates"><PlayIcon name="megaphone"/>업데이트</Link>
        <Link prefetch={false} href="/codes"><PlayIcon name="code"/>코드</Link>
        <Link prefetch={false} href="/games?intent=party"><PlayIcon name="party"/>파티 모집</Link>
      </nav>
      <div className="header-account-links"><Link prefetch={false} href="/notifications" aria-label="알림"><span className="header-round-icon">●</span></Link><Link prefetch={false} href="/me" aria-label="내 정보"><PlayIcon name="user"/></Link></div>
      <details className="mobile-menu"><summary>메뉴 <span aria-hidden="true">☰</span></summary><nav aria-label="전체 메뉴"><Link prefetch={false} href="/community/free">자유</Link><Link prefetch={false} href="/community">질문답변</Link><Link prefetch={false} href="/guides">공략</Link><Link prefetch={false} href="/updates">업데이트</Link><Link prefetch={false} href="/codes">코드</Link><Link prefetch={false} href="/games?intent=party">파티 모집</Link><Link prefetch={false} href="/games">게임 찾기</Link><Link prefetch={false} href="/rising">상승 중</Link><Link prefetch={false} href="/compare">비교</Link><Link prefetch={false} href="/notifications">알림</Link></nav></details>
    </div>
    {games.length > 0 && <div className="header-search"><SearchBox games={games} compact /></div>}
  </header>;
}

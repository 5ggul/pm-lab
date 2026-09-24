import Link from "next/link";
import SearchBox from "./SearchBox";
import BrandMascot from "./BrandMascot";
import PlayIcon from "./PlayIcon";
import type { GameView } from "@/lib/types";

const primaryNav = [
  { href: "/", label: "홈", icon: "home" as const },
  { href: "/games", label: "게임 찾기", icon: "game" as const },
  { href: "/community/free", label: "자유", icon: "chat" as const },
  { href: "/community", label: "질문답변", icon: "help" as const },
  { href: "/guides", label: "공략", icon: "book" as const },
  { href: "/updates", label: "업데이트", icon: "megaphone" as const },
  { href: "/codes", label: "코드", icon: "code" as const },
  { href: "/games?intent=party", label: "파티 모집", icon: "party" as const },
];

export default function Header({ games = [] }: { games?: GameView[] }) {
  return (
    <header className="site-header roblejam-site-header">
      <div className="header-top-shell">
        <Link prefetch={false} className="brand brand-roblejam" href="/" aria-label="로블잼 홈">
          <span className="brand-mascot-wrap"><BrandMascot className="brand-mascot"/></span>
          <span className="brand-copy">
            <span className="brand-mark">로블<span>잼</span><i aria-hidden="true">♛</i></span>
            <small>게임하는 친구들이 모이는 곳!</small>
          </span>
        </Link>

        {games.length > 0 && (
          <div className="header-search header-search-inline">
            <SearchBox games={games} compact />
          </div>
        )}

        <div className="header-account-links header-actions">
          <Link prefetch={false} className="header-icon-button" href="/notifications" aria-label="알림">
            <PlayIcon name="megaphone"/>
          </Link>
          <Link prefetch={false} className="header-login-link" href="/login">로그인</Link>
          <Link prefetch={false} className="header-me-link" href="/me"><PlayIcon name="user"/>내 정보</Link>
        </div>

        <details className="mobile-menu">
          <summary aria-label="전체 메뉴"><span>메뉴</span><b aria-hidden="true">☰</b></summary>
          <nav aria-label="전체 메뉴">
            {primaryNav.map(item => <Link prefetch={false} key={item.href} href={item.href}><PlayIcon name={item.icon}/>{item.label}</Link>)}
            <Link prefetch={false} href="/rising"><PlayIcon name="rise"/>상승 중</Link>
            <Link prefetch={false} href="/compare"><PlayIcon name="game"/>비교</Link>
            <Link prefetch={false} href="/notifications"><PlayIcon name="megaphone"/>알림</Link>
            <Link prefetch={false} href="/login"><PlayIcon name="user"/>로그인</Link>
          </nav>
        </details>
      </div>

      <div className="header-nav-shell">
        <nav className="desktop-nav playful-nav" aria-label="주요 메뉴">
          {primaryNav.map((item, index) => (
            <Link prefetch={false} className={index === 0 ? "nav-home-pill" : undefined} key={item.href} href={item.href}>
              <PlayIcon name={item.icon}/><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

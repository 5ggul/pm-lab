import Link from "next/link";
import SearchBox from "./SearchBox";
import BrandMascot from "./BrandMascot";
import PlayIcon from "./PlayIcon";
import type { GameView } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth/session";

const primaryNav = [
  { href: "/", label: "홈", icon: "home" as const },
  { href: "/games", label: "게임 찾기", icon: "game" as const },
  { href: "/rising", label: "상승 중", icon: "rise" as const },
  { href: "/community/free", label: "자유", icon: "chat" as const },
  { href: "/community", label: "질문답변", icon: "help" as const },
  { href: "/guides", label: "공략", icon: "book" as const },
  { href: "/codes", label: "공짜 혜택", icon: "code" as const },
  { href: "/games?intent=party", label: "파티 모집", icon: "party" as const },
];

export default async function Header({ games = [] }: { games?: GameView[] }) {
  const user = await getCurrentUser();

  return (
    <header className="site-header roblejam-site-header">
      <div className="header-top-shell">
        <Link prefetch={false} className="brand brand-roblejam brand-v2" href="/" aria-label="로블잼 홈">
          <img
            className="brand-logo-v2 brand-mascot"
            src="/brand/roblejam-logo-approved.webp"
            alt="로블잼"
            width={560}
            height={187}
          />
          <noscript><BrandMascot className="brand-logo-fallback" /></noscript>
        </Link>

        <nav className="desktop-nav playful-nav header-inline-nav" aria-label="주요 메뉴">
          {primaryNav.map((item, index) => (
            <Link prefetch={false} className={index === 0 ? "nav-home-pill" : undefined} key={item.href} href={item.href}>
              <PlayIcon name={item.icon}/><span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {games.length > 0 && (
          <div className="header-search header-search-inline">
            <SearchBox games={games} compact />
          </div>
        )}

        <div className="header-account-links header-actions">
          {user ? (
            <>
              <Link prefetch={false} className="header-icon-button" href="/notifications" aria-label="알림">
                <PlayIcon name="megaphone" />
              </Link>
              <Link prefetch={false} className="header-me-link header-me-v2" href="/me">
                <img
                  className="header-profile-avatar"
                  src="/brand/roblejam-character-v3.webp"
                  alt=""
                  width={34}
                  height={34}
                />
                <span>내 정보</span>
              </Link>
            </>
          ) : (
            <Link prefetch={false} className="header-login-link" href="/login">로그인</Link>
          )}
        </div>

        <details className="mobile-menu">
          <summary aria-label="전체 메뉴"><span>메뉴</span><b aria-hidden="true">☰</b></summary>
          <nav aria-label="전체 메뉴">
            {primaryNav.map((item) => <Link prefetch={false} key={item.href} href={item.href}><PlayIcon name={item.icon}/>{item.label}</Link>)}
            <Link prefetch={false} href="/updates"><PlayIcon name="megaphone"/>업데이트</Link>
            <Link prefetch={false} href="/compare"><PlayIcon name="game"/>비교</Link>
            {user ? (
              <>
                <Link prefetch={false} href="/notifications"><PlayIcon name="megaphone"/>알림</Link>
                <Link prefetch={false} href="/me"><PlayIcon name="user"/>내 정보</Link>
              </>
            ) : (
              <Link prefetch={false} href="/login"><PlayIcon name="user"/>로그인</Link>
            )}
          </nav>
        </details>
      </div>

    </header>
  );
}

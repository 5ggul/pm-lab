import Link from "next/link";
export default function MobileNav(){return <nav className="mobile-nav" aria-label="모바일 메뉴"><Link href="/">홈</Link><Link href="/games">탐색</Link><span aria-disabled="true">글쓰기<span className="soon">후속</span></span><span aria-disabled="true">알림<span className="soon">후속</span></span><span aria-disabled="true">MY<span className="soon">후속</span></span></nav>}

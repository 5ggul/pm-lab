import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="모바일 메뉴">
      <Link href="/">홈</Link>
      <Link href="/games">탐색</Link>
      <Link href="/rising">급상승</Link>
      <Link href="/updates">업데이트</Link>
      <Link href="/guides">가이드</Link>
      <Link href="/community">Q&A</Link>
      <Link href="/me">MY</Link>
    </nav>
  );
}

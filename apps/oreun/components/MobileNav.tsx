import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="모바일 메뉴">
      <Link href="/">홈</Link>
      <Link href="/games">게임</Link>
      <Link href="/rising">상승</Link>
      <Link href="/updates">업데이트</Link>
      <Link href="/guides">공략</Link>
      <Link href="/community">질문</Link>
      <Link href="/me">내 정보</Link>
    </nav>
  );
}

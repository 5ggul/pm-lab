import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>오름</strong> · 뜨는 게임의 기록
      </div>
      <div className="footer-links">
        <Link href="/about">소개</Link>
        <Link href="/methodology">산정 기준</Link>
        <Link href="/community">게임 Q&A</Link>
        <Link href="/guides">검증 가이드</Link>
        <Link href="/guidelines">가이드라인</Link>
        <Link href="/privacy">개인정보</Link>
        <Link href="/youth">청소년보호</Link>
        <Link href="/terms">약관</Link>
        <Link href="/contact">연락처·오류 제보</Link>
        <Link href="/disclaimer">비제휴</Link>
      </div>
      <p>
        본 서비스는 Roblox Corporation과 제휴 또는 공식 관계가 없는 독립
        서비스입니다.
      </p>
    </footer>
  );
}

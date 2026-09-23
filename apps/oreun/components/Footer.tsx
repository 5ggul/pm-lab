export default function Footer() {
  // Footer destinations are ordinary links, not speculative RSC requests.
  // Policy pages should load only when opened; leaving a long form must not
  // launch or cancel a batch of unrelated privacy/terms prefetches in WebKit.
  return (
    <footer className="footer">
      <div>
        <strong>로블잼</strong> · 로블록스 게임 정보
      </div>
      <div className="footer-links">
        <a href="/about">소개</a>
        <a href="/methodology">산정 기준</a>
        <a href="/community">질문</a>
        <a href="/guides">공략</a>
        <a href="/guidelines">이용규칙</a>
        <a href="/privacy">개인정보</a>
        <a href="/youth">청소년보호</a>
        <a href="/terms">약관</a>
        <a href="/contact">연락처·오류 제보</a>
        <a href="/disclaimer">비제휴</a>
      </div>
      <p>
        본 서비스는 Roblox Corporation과 제휴 또는 공식 관계가 없는 독립
        서비스입니다.
      </p>
    </footer>
  );
}

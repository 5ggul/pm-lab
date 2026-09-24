import Link from "next/link";
import BrandMascot from "./BrandMascot";
import PlayIcon from "./PlayIcon";

export default function HomeBrandStrip({
  gameCount,
  liveCount,
  guideCount,
  openPartyCount,
  hasCommunityPosts,
}: {
  gameCount: number;
  liveCount: number;
  guideCount: number;
  openPartyCount: number;
  hasCommunityPosts: boolean;
}) {
  return (
    <section className="home-brand-strip" aria-label="로블잼 둘러보기">
      <div className="brand-promo-card">
        <BrandMascot className="brand-promo-mascot"/>
        <div>
          <span>ROBLEJAM</span>
          <strong>좋은 게임,<br/>좋은 친구들과 함께!</strong>
          <p>찾고, 묻고, 이야기하고, 같이 플레이해요.</p>
        </div>
      </div>

      <div className="real-stat-card">
        <strong>지금 확인할 수 있어요</strong>
        <div className="real-stat-grid">
          <div><PlayIcon name="game"/><b>{gameCount}</b><span>등록 게임</span></div>
          <div><PlayIcon name="rise"/><b>{liveCount}</b><span>현재값 확인</span></div>
          <div><PlayIcon name="book"/><b>{guideCount}</b><span>공개 공략</span></div>
          <div><PlayIcon name="party"/><b>{openPartyCount}</b><span>열린 파티</span></div>
        </div>
      </div>

      <div className="community-start-card">
        <span className="community-start-stars" aria-hidden="true">✦ ★ ✦</span>
        <strong>{hasCommunityPosts ? "오늘도 같이 떠들어요!" : "첫 자유 톡을 기다리고 있어요!"}</strong>
        <p>{hasCommunityPosts ? "게임 이야기부터 같이 할 친구 찾기까지, 부담 없이 들어오세요." : "게임 이야기, 자랑, 추천처럼 질문이 아닌 이야기도 자유롭게 남길 수 있어요."}</p>
        <Link prefetch={false} href="/community/free" className="community-start-cta">
          {hasCommunityPosts ? "커뮤니티 가기" : "자유 톡 시작하기"} <PlayIcon name="arrow"/>
        </Link>
      </div>
    </section>
  );
}

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
        <BrandMascot className="brand-promo-mascot" />
        <div>
          <span>ROBLEJAM</span>
          <strong>좋은 게임은<br/>좋은 친구와 함께!</strong>
          <p>찾고, 묻고, 이야기하고, 같이 플레이해요.</p>
        </div>
      </div>
      <div className="real-stat-card">
        <strong>지금 로블잼에는</strong>
        <div className="real-stat-grid">
          <div><PlayIcon name="game"/><b>{gameCount}</b><span>등록 게임</span></div>
          <div><PlayIcon name="rise"/><b>{liveCount}</b><span>현재값 확인</span></div>
          <div><PlayIcon name="book"/><b>{guideCount}</b><span>공개 공략</span></div>
          <div><PlayIcon name="party"/><b>{openPartyCount}</b><span>열린 파티</span></div>
        </div>
      </div>
      <div className="community-start-card">
        <span className="community-start-stars" aria-hidden="true">✦ ★ ✦</span>
        <strong>{hasCommunityPosts ? "오늘도 같이 떠들어요!" : "첫 자유 톡의 주인공이 되어보세요!"}</strong>
        <p>{hasCommunityPosts ? "게임 이야기부터 같이 할 친구 찾기까지." : "가짜 글로 채우지 않았어요. 진짜 이용자가 첫 분위기를 만들어요."}</p>
        <Link prefetch={false} href="/community/free" className="community-start-cta">
          {hasCommunityPosts ? "커뮤니티 가기" : "첫 자유글 쓰기"} <PlayIcon name="arrow"/>
        </Link>
      </div>
    </section>
  );
}

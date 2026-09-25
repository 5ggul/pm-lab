import type { GameView } from "@/lib/types";

export default function HeroWorld({ games }: { games: GameView[] }) {
  return (
    <div
      className="hero-world hero-world-approved"
      role="img"
      aria-label={games.length > 0 ? "로블잼 게임 월드와 추천 게임 분위기" : "로블잼 게임 월드"}
    >
      <img
        className="hero-world-approved-art"
        src="/brand/roblejam-hero-world.webp"
        alt=""
        width={860}
        height={568}
        loading="eager"
        fetchPriority="high"
      />
      <span className="hero-world-slogan" aria-hidden="true"><b>♛</b><strong>좋은 친구들과<br/>즐거운 게임!</strong></span>\n      <span className="hero-world-note" aria-hidden="true">로블잼에서 만나자!</span>\n      <span className="hero-world-approved-edge" aria-hidden="true"/>
    </div>
  );
}

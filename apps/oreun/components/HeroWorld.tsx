import type { GameView } from "@/lib/types";

export default function HeroWorld({ games }: { games: GameView[] }) {
  return (
    <div
      className="hero-world hero-world-approved"
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
      <span className="hero-world-approved-edge" aria-hidden="true"/>
    </div>
  );
}

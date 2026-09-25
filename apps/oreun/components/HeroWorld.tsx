import type { GameView } from "@/lib/types";

export default function HeroWorld({ games: _games }: { games: GameView[] }) {
  return (
    <div
      className="hero-world hero-world-v2 hero-world-approved"
      role="img"
      aria-label="로블잼 블루 게이머 마스코트가 있는 게임 세계"
    >
      <img
        className="hero-world-scene-art"
        src="/brand/roblejam-hero-approved-hd.webp"
        alt=""
        width={800}
        height={450}
        loading="eager"
        fetchPriority="high"
      />
    </div>
  );
}

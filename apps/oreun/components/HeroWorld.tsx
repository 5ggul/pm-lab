import Link from "next/link";
import type { GameView } from "@/lib/types";

export default function HeroWorld({ games }: { games: GameView[] }) {
  const lead = games.find(game => Boolean(game.heroImageUrl || game.thumbnailUrl));
  return (
    <div className="hero-world hero-world-approved" aria-label="로블잼 게임 월드">
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
      {lead && (
        <Link
          prefetch={false}
          className="hero-world-approved-game"
          href={"/game/" + lead.slug}
          aria-label={lead.nameKo + " 게임 정보 보기"}
        >
          <span>지금 핫한 게임</span>
          <strong>{lead.nameKo}</strong>
          <b aria-hidden="true">↗</b>
        </Link>
      )}
    </div>
  );
}

import Link from "next/link";
import type { GameView } from "@/lib/types";
import BrandMascot from "./BrandMascot";

export default function HeroWorld({ games }: { games: GameView[] }) {
  const visualGames = games.filter(game => Boolean(game.heroImageUrl || game.thumbnailUrl)).slice(0, 4);
  return (
    <div className="hero-world" aria-label="추천 게임 미리보기">
      <span className="hero-world-orb orb-a" aria-hidden="true" />
      <span className="hero-world-orb orb-b" aria-hidden="true" />
      {visualGames.map((game, index) => {
        const src = game.heroImageUrl ?? game.thumbnailUrl;
        return (
          <Link
            prefetch={false}
            href={"/game/" + game.slug}
            className={"hero-world-card hero-world-card-" + (index + 1)}
            key={game.universeId}
            aria-label={game.nameKo + " 보기"}
          >
            {src && <img src={src} alt="" width={480} height={300} loading={index === 0 ? "eager" : "lazy"} />}
            <span>{game.nameKo}</span>
          </Link>
        );
      })}
      <div className="hero-world-mascot" aria-hidden="true">
        <BrandMascot className="hero-world-mascot-svg" />
        <span className="hero-world-crown">♛</span>
      </div>
      <div className="hero-world-sign" aria-hidden="true">
        <strong>GOOD GAMES</strong>
        <span>BETTER FRIENDS</span>
      </div>
    </div>
  );
}

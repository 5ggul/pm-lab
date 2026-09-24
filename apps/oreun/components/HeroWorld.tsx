import Link from "next/link";
import type { GameView } from "@/lib/types";
import BrandMascot from "./BrandMascot";

export default function HeroWorld({ games }: { games: GameView[] }) {
  const visualGames = games.filter(game => Boolean(game.heroImageUrl || game.thumbnailUrl)).slice(0, 4);
  const lead = visualGames[0];

  return (
    <div className="hero-world hero-world-cinematic" aria-label="로블잼 게임 월드">
      {lead && (
        <Link prefetch={false} href={"/game/" + lead.slug} className="hero-world-backdrop-link" aria-label={lead.nameKo + " 보기"}>
          <img className="hero-world-backdrop" src={lead.heroImageUrl ?? lead.thumbnailUrl ?? ""} alt="" width={960} height={600} loading="eager"/>
        </Link>
      )}
      <span className="hero-world-skywash" aria-hidden="true"/>
      <span className="floating-island island-a" aria-hidden="true"><i/><b/></span>
      <span className="floating-island island-b" aria-hidden="true"><i/><b/></span>
      <span className="floating-island island-c" aria-hidden="true"><i/><b/></span>

      {visualGames.slice(1, 4).map((game, index) => {
        const src = game.heroImageUrl ?? game.thumbnailUrl;
        return (
          <Link
            prefetch={false}
            href={"/game/" + game.slug}
            className={"hero-world-card hero-world-card-" + (index + 2)}
            key={game.universeId}
            aria-label={game.nameKo + " 보기"}
          >
            {src && <img src={src} alt="" width={420} height={260} loading="lazy"/>}
            <span>{game.nameKo}</span>
          </Link>
        );
      })}

      <div className="hero-world-mascot" aria-hidden="true">
        <BrandMascot className="hero-world-mascot-svg"/>
      </div>
      <div className="hero-world-handnote hero-note-a" aria-hidden="true">좋은 게임,<br/>더 좋은 친구들</div>
      <div className="hero-world-handnote hero-note-b" aria-hidden="true">로블잼에서<br/>만나자!</div>
      <div className="hero-world-sign" aria-hidden="true">
        <strong>PLAY · SHARE</strong>
        <span>MAKE FRIENDS · MORE FUN!</span>
      </div>
    </div>
  );
}

import ResilientGameImage from "./ResilientGameImage";
import type { GameView } from "@/lib/types";

export default function HeroWorld({ games }: { games: GameView[] }) {
  const featured = games.slice(0, 3);
  return (
    <div
      className="hero-world hero-world-v2"
      role="img"
      aria-label="로블잼 블루 게이머 마스코트와 인기 게임"
    >
      <div className="hero-world-glow" aria-hidden="true" />
      <noscript><img className="hero-world-approved-art" src="/brand/roblejam-hero-world.webp" alt="" width={860} height={568} /></noscript>
      {featured.map((game, index) => (
        <div className={"hero-float-card hero-float-card-" + (index + 1)} key={game.universeId} aria-hidden="true">
          <ResilientGameImage
            sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map((image) => image.url), game.thumbnailUrl]}
            name={game.nameKo}
            width={220}
            height={138}
            eager={index === 0}
          />
          <span>{game.nameKo}</span>
        </div>
      ))}
      <img
        className="hero-avatar-v2"
        src="/brand/roblejam-avatar-v2.svg"
        alt=""
        width={512}
        height={512}
        loading="eager"
        fetchPriority="high"
      />
      <span className="hero-world-slogan-v2" aria-hidden="true">
        <b>♛</b><strong>좋은 친구들과<br/>즐거운 게임!</strong>
      </span>
      <span className="hero-world-note-v2" aria-hidden="true">로블잼에서 만나자!</span>
    </div>
  );
}

import Link from "next/link";
import type { GameView } from "@/lib/types";
import { compactNumber } from "@/lib/format";

export default function GameVisualCard({
  game,
  rank,
  badge,
}: {
  game: GameView;
  rank?: number;
  badge?: string;
}) {
  const image = game.heroImageUrl ?? game.thumbnailUrl;
  const mediaCount = (game.mediaImages?.length ?? 0) + (game.mediaVideos?.length ?? 0);

  return (
    <Link className="visual-game-card" href={`/game/${game.slug}`}>
      <div className="visual-cover">
        {image ? (
          // Roblox CDN URLs are provider-owned, so keep a normal img instead of
          // coupling the page to a Next Image remote-pattern allowlist.
          <img src={image} alt="" loading="lazy" />
        ) : (
          <div className="visual-fallback">{game.nameKo.slice(0, 2)}</div>
        )}
        {rank != null && <span className="visual-rank">#{rank}</span>}
        {badge && <span className="visual-badge">{badge}</span>}
        {!badge && (game.mediaVideos?.length ?? 0) > 0 && (
          <span className="visual-badge">▶ VIDEO</span>
        )}
      </div>
      <div className="visual-card-body">
        <strong>{game.nameKo}</strong>
        <div>
          <span>{compactNumber(game.playing)}명</span>
          <span>{game.genreL1 ?? (mediaCount ? `${mediaCount} media` : "")}</span>
        </div>
      </div>
    </Link>
  );
}

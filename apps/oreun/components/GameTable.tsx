import Link from "next/link";
import GameGlyph from "./GameGlyph";
import FreshnessBadge from "./FreshnessBadge";
import { compactNumber } from "@/lib/format";
import type { GameView } from "@/lib/types";

export default function GameTable({
  games,
  title,
}: {
  games: GameView[];
  title?: string;
}) {
  return (
    <section className="data-section">
      {title && (
        <div className="section-head">
          <h2>{title}</h2>
        </div>
      )}
      <div className="game-table" role="list">
        {games.map((game, index) => (
          <Link
            className="game-row"
            href={`/game/${game.slug}`}
            key={game.universeId}
            role="listitem"
          >
            <span className="rank">{index + 1}</span>
            <GameGlyph
              name={game.nameKo}
              thumbnailUrl={game.thumbnailUrl}
            />
            <span className="game-title">
              <strong>{game.nameKo}</strong>
              <small>{game.name}</small>
            </span>
            <span className="playing">
              <strong>{compactNumber(game.playing)}</strong>
              <small>플레이 중</small>
            </span>
            <FreshnessBadge state={game.freshnessState} />
          </Link>
        ))}
      </div>
    </section>
  );
}

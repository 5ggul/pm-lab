import Link from "next/link";
import type { GameView } from "@/lib/types";
import { compactNumber } from "@/lib/format";
import { genreLabel } from "@/lib/discovery";

export default function GameVisualCard({ game, rank, badge, href, change24h }: { game: GameView; rank?: number; badge?: string; href?: string; change24h?: number | null; }) {
  const image = game.heroImageUrl ?? game.thumbnailUrl;
  const mediaCount = (game.mediaImages?.length ?? 0) + (game.mediaVideos?.length ?? 0);
  const playingLabel = game.playing == null ? "현재 확인 불가" : game.playing.toLocaleString("ko-KR") + "명 플레이 중";
  return (
    <Link className={"visual-game-card " + (game.playing == null ? "unavailable" : "")} href={href ?? "/game/" + game.slug} aria-label={game.nameKo + " · " + playingLabel}>
      <div className="visual-cover">
        {image ? <img src={image} alt="" loading="lazy" width={768} height={432} /> : <div className="visual-fallback">{game.nameKo.slice(0, 2)}</div>}
        {rank != null && <span className="visual-rank">#{rank}</span>}
        {badge && <span className="visual-badge">{badge}</span>}
        {(game.mediaVideos?.length ?? 0) > 0 && <span className="visual-video-badge">▶ 영상</span>}
      </div>
      <div className="visual-card-body">
        {change24h !== undefined && <small className="card-change">24시간 {change24h === null ? "비교 불가" : `${change24h >= 0 ? "+" : ""}${(change24h * 100).toFixed(1)}%`}</small>}
        <strong title={game.nameKo}>{game.nameKo}</strong>
        <div><span title={playingLabel}>{game.playing == null ? "확인 불가" : compactNumber(game.playing) + "명"}</span><span>{game.genreL1 ? genreLabel(game.genreL1) : (mediaCount ? mediaCount + "개 미디어" : "")}</span></div>
      </div>
    </Link>
  );
}

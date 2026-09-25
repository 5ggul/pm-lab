import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import PlayIcon from "@/components/PlayIcon";
import ResilientGameImage from "@/components/ResilientGameImage";
import { getGameCatalog } from "@/lib/catalog";
import { getAllPublishedCodes, isFreshCodeCheck, type GameCode } from "@/lib/content/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "공짜 혜택",
  description: "공식 출처에서 직접 확인한 Roblox 무료 보상 코드와 마지막 확인 시각을 함께 제공합니다.",
  robots: { index: false, follow: true },
};

export default async function CodesPage() {
  const [games, codes] = await Promise.all([
    getGameCatalog(),
    getAllPublishedCodes().catch(() => []),
  ]);
  const gameMap = new Map(games.map((game) => [game.universeId, game]));
  const groupMap = new Map<number, GameCode[]>();

  for (const code of codes) {
    const id = Number(code.universe_id);
    const rows = groupMap.get(id) ?? [];
    rows.push(code);
    groupMap.set(id, rows);
  }

  const groups = [...groupMap.entries()]
    .flatMap(([universeId, rows]) => {
      const game = gameMap.get(universeId);
      return game ? [{ game, rows }] : [];
    })
    .sort((a, b) => {
      const aFresh = a.rows.some((code) => isFreshCodeCheck(code)) ? 1 : 0;
      const bFresh = b.rows.some((code) => isFreshCodeCheck(code)) ? 1 : 0;
      return bFresh - aFresh || a.game.nameKo.localeCompare(b.game.nameKo, "ko");
    });

  const activeCount = codes.filter((code) => code.code_status === "active").length;
  const latestCheckedAt = codes.map((code) => code.last_checked_at).filter(Boolean).sort().at(-1) ?? null;

  return (
    <>
      <Header games={games} />
      <main className="page codes-hub-page">
        <div className="community-hero codes-hero">
          <span className="community-kicker"><PlayIcon name="code" /> 확인된 무료 보상</span>
          <h1>지금 받을 수 있는 공짜 혜택만 보여줘요.</h1>
          <p>공식 게임 설명·공식 개발자 출처에서 직접 확인한 무료 보상 코드만 공개합니다.</p>
          <div className="codes-trust-strip">
            <span><b>{activeCount}</b> 지금 받을 수 있는 혜택</span>
            <span><b>{groups.length}</b> 혜택 확인 게임</span>
            <span><b>{latestCheckedAt ? formatKstDateTime(latestCheckedAt) : "—"}</b> 최근 확인</span>
          </div>
        </div>

        {groups.length ? (
          <div className="codes-hub-grid">
            {groups.map(({ game, rows }) => {
              const active = rows.filter((code) => code.code_status === "active");
              const freshest = [...rows]
                .filter((code) => code.last_checked_at)
                .sort((a, b) => String(b.last_checked_at).localeCompare(String(a.last_checked_at)))[0];
              return (
                <Link prefetch={false} className="codes-game-card" href={"/game/" + game.slug + "/codes"} key={game.universeId}>
                  <ResilientGameImage
                    className="codes-card-image"
                    sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map((image) => image.url), game.thumbnailUrl]}
                    name={game.nameKo}
                    width={480}
                    height={300}
                  />
                  <div>
                    <span>{active.length ? "지금 받을 수 있는 혜택 " + active.length + "개" : "현재 받을 수 있는 혜택 없음"}</span>
                    <strong>{game.nameKo}</strong>
                    <small>{freshest?.last_checked_at ? "마지막 확인 " + formatKstDateTime(freshest.last_checked_at) : "확인 기록 없음"}</small>
                  </div>
                  <PlayIcon name="arrow" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="community-empty-state codes-empty">
            <span className="codes-empty-icon">🎟️</span>
            <strong>지금 확인된 공짜 혜택이 없습니다.</strong>
            <p>새 무료 보상이 확인되면 여기에 표시합니다.</p>
            <Link prefetch={false} className="secondary-button" href="/games">게임 둘러보기</Link>
          </div>
        )}
      </main>
    </>
  );
}

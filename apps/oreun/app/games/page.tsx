import type { Metadata } from "next";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import { getGameCatalog } from "@/lib/catalog";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "지금 플레이 순위",
  description: "Roblox 공개 경험 데이터 기준 현재 플레이 인원이 많은 게임을 확인합니다.",
  alternates: { canonical: "/games" },
};

export default async function Games() {
  const games = await getGameCatalog();
  const sorted = [...games].sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1));
  const latest = sorted.map((game) => game.fetchedAt).filter(Boolean).sort().at(-1);

  return (
    <>
      <Header games={games} />
      <FixtureBanner />
      <main className="page">
        <div className="media-page-head">
          <h1>전체 게임</h1>
          <span>{latest ? "갱신 " + formatKstDateTime(latest) : ""}</span>
        </div>
        <div className="visual-card-grid">
          {sorted.map((game, index) => (
            <GameVisualCard
              game={game}
              rank={index + 1}
              key={game.universeId}
            />
          ))}
        </div>
      </main>
    </>
  );
}

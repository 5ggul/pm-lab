import type { Metadata } from "next";
import Header from "@/components/Header";
import FixtureBanner from "@/components/FixtureBanner";
import GameExplorer from "@/components/GameExplorer";
import { getGameCatalog } from "@/lib/catalog";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { computeTrend } from "@/lib/trend";
import { formatKstDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "게임 찾기", description: "장르, 현재 플레이, 최근 업데이트, 공식 영상과 상승 데이터를 기준으로 Roblox 게임을 찾고 비교합니다.", alternates: { canonical: "/games" } };
export default async function Games({searchParams}:{searchParams:Promise<{intent?:string}>}) {
  const partyIntent=(await searchParams).intent==="party";
  const games=await getGameCatalog();
  const latest=games.map(game=>game.fetchedAt).filter(Boolean).sort().at(-1);
  let histories:Awaited<ReturnType<typeof getPersistentHistories>>=null;
  try{histories=await getPersistentHistories(games.map(game=>game.universeId),168);}catch{histories=null;}
  const trendScores:Record<string,number>={};
  if(histories){for(const game of games){const history=histories.get(game.universeId)??[];const trend=computeTrend(game.universeId,history,game.sourceUpdatedAt,new Date(),60);if(trend.eligible&&trend.score!=null&&(trend.metrics.relativeGrowth??0)>0&&(trend.metrics.absoluteMomentum??0)>0)trendScores[String(game.universeId)]=trend.score;}}
  return <><Header games={games}/><FixtureBanner/><main className="page"><div className="media-page-head"><h1>게임 찾기</h1><span>{latest?"갱신 "+formatKstDateTime(latest):""}</span></div><GameExplorer games={games} trendScores={trendScores} partyIntent={partyIntent}/></main></>;
}

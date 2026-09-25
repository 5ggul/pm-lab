import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import PlayIcon from "@/components/PlayIcon";
import ResilientGameImage from "@/components/ResilientGameImage";
import { getGameCatalog } from "@/lib/catalog";
import { getAllPublishedCodes, isFreshCodeCheck, type GameCode } from "@/lib/content/queries";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"게임 코드",description:"로블잼에서 게임별 공개 코드를 확인합니다.",robots:{index:false,follow:true}};
export default async function CodesPage(){
 const [games,codes]=await Promise.all([getGameCatalog(),getAllPublishedCodes().catch(()=>[])]);
 const gameMap=new Map(games.map(game=>[game.universeId,game]));\n const officialMentions=games.filter(game=>game.description.toLocaleLowerCase("en-US").includes("use code"));
 const groupMap=new Map<number,GameCode[]>();
 for(const code of codes){const id=Number(code.universe_id);const rows=groupMap.get(id)??[];rows.push(code);groupMap.set(id,rows);}
 const groups=[...groupMap.entries()];
 return <><Header games={games}/><main className="page codes-hub-page"><div className="community-hero codes-hero"><span className="community-kicker"><PlayIcon name="code"/> 게임 코드</span><h1>코드가 있으면 여기서 확인!</h1><p>공개 출처와 마지막 확인 시각을 기준으로 게임별 코드를 모아 보여드려요.</p></div>
 {officialMentions.length>0&&<section className="official-code-notices"><div className="section-head"><h2><PlayIcon name="code"/>공식 게임 설명의 코드 안내</h2><span>Roblox 공식 설명 원문 기준</span></div><div className="official-code-notice-grid">{officialMentions.map(game=><article className="official-code-notice" key={game.universeId}><strong>{game.nameKo}</strong><p>{game.description}</p><Link prefetch={false} className="secondary-button" href={"/game/"+game.slug+"/codes"}>이 게임 코드 보기</Link></article>)}</div></section>}\n {groups.length?<div className="codes-hub-grid">{groups.map(([universeId,rows])=>{const game=gameMap.get(universeId);if(!game)return null;const active=rows.filter(code=>code.code_status==="active");return <Link prefetch={false} className="codes-game-card" href={"/game/"+game.slug+"/codes"} key={universeId}><ResilientGameImage className="codes-card-image" sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map(image => image.url), game.thumbnailUrl]} name={game.nameKo} width={480} height={300}/><div><span>{active.length?"활성 "+active.length+"개":"현재 활성 코드 없음"}</span><strong>{game.nameKo}</strong><small>{rows.some(code=>isFreshCodeCheck(code))?"최근 확인 기록 있음":"다시 확인이 필요할 수 있어요"}</small></div><PlayIcon name="arrow"/></Link>})}</div>:<div className="community-empty-state codes-empty"><span className="codes-empty-icon">🎟️</span><strong>현재 공개된 게임 코드가 없습니다.</strong><p>확인된 코드가 생기면 게임별 코드 페이지에 추가됩니다.</p><Link prefetch={false} className="secondary-button" href="/games">게임 둘러보기</Link></div>}
 </main></>;
}

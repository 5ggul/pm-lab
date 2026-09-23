import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import DiscoveryShelf from "@/components/DiscoveryShelf";
import PlayIcon from "@/components/PlayIcon";
import { genreLabel } from "@/lib/discovery";
import { getGameCatalog } from "@/lib/catalog";
import { getPreviewFixtureHistory, previewFixtureEnabled } from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { getRecentUpdateEvents } from "@/lib/content/queries";
import { computeTrend } from "@/lib/trend";
import { VERIFIED_EDITORIAL_GUIDES } from "@/lib/content/verified-guides";
import { compactNumber, formatKstDateTime, relativeTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  const games = await getGameCatalog();
  const live = games.filter(game => game.playing != null && game.freshnessState !== "unavailable").sort((a,b)=>(b.playing??-1)-(a.playing??-1));
  const featured = live.filter(game=>game.heroImageUrl).slice(0,3);
  const latestFetchedAt = live.map(game=>game.fetchedAt).filter(Boolean).sort().at(-1);
  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  try { persistentHistories = await getPersistentHistories(games.map(game=>game.universeId),168); } catch { persistentHistories=null; }
  const trends=games.map(game=>{const storedHistory=persistentHistories?.get(game.universeId);const usingStoredHistory=Boolean(storedHistory?.length);const history=usingStoredHistory?storedHistory!:getPreviewFixtureHistory(game);const interval=usingStoredHistory?60:previewFixtureEnabled()?360:60;return {game,trend:computeTrend(game.universeId,history,game.sourceUpdatedAt,new Date(),interval)};}).filter(({trend,game})=>trend.eligible&&Boolean(game.heroImageUrl)&&(trend.metrics.relativeGrowth??0)>0&&(trend.metrics.absoluteMomentum??0)>0).sort((a,b)=>(b.trend.score??0)-(a.trend.score??0)).slice(0,6);
  const recentUpdateEvents=await getRecentUpdateEvents(100).catch(()=>[]);
  const gameByUniverse=new Map(games.map(game=>[game.universeId,game]));
  const seenUpdateGames=new Set<number>();
  const editorialGuides=VERIFIED_EDITORIAL_GUIDES.flatMap(guide=>{const game=gameByUniverse.get(Number(guide.universe_id));return game?[{guide,game}]:[];}).slice(0,8);
  const detectedUpdates=recentUpdateEvents.flatMap(event=>{const id=Number(event.universe_id);const game=gameByUniverse.get(id);if(!game||!game.heroImageUrl||seenUpdateGames.has(id))return [];seenUpdateGames.add(id);return [{game,event}];}).slice(0,8);
  return <><Header games={games}/><FixtureBanner/><main className="page media-home">
    <section className="play-hero" aria-labelledby="home-heading">
      <div className="hero-sticker"><PlayIcon name="game"/> 로블록스에서 만나요</div>
      <div className="play-hero-top"><h1 id="home-heading">오늘은<br/><em>뭐 하고 놀까?</em></h1><span className="hero-doodle" aria-hidden="true"><PlayIcon name="game"/><i>✦</i></span></div>
      <p className="home-intro">게임 찾고, 공략 보고, 같이 플레이!</p>
      <SearchBox games={games}/>
      <div className="quick-game-links"><span>바로 가기</span>{["rivals","blox-fruits","dress-to-impress"].map(slug=>games.find(g=>g.slug===slug)).filter((g):g is NonNullable<typeof g>=>Boolean(g)).map(g=><Link href={"/game/"+g.slug} key={g.slug}>{g.slug==="dress-to-impress"?"DTI":g.nameKo}<span aria-hidden="true">↗</span></Link>)}</div>
    </section>
    <div className="section-head spotlight-head"><h2><PlayIcon name="game"/>지금 많이 하는 게임</h2><span>{latestFetchedAt?"갱신 "+formatKstDateTime(latestFetchedAt):"현재값 확인 중"}</span></div>
    {featured.length>0&&<section className="spotlight-grid">{featured.map((game,index)=><Link className={index===0?"spotlight-card spotlight-main":"spotlight-card"} href={"/game/"+game.slug} key={game.universeId}><img src={game.heroImageUrl!} alt="" width={768} height={432} loading={index===0?"eager":"lazy"} fetchPriority={index===0?"high":"auto"}/><div className="spotlight-shade"/><div className="spotlight-copy"><div className="spotlight-tags"><span className="spotlight-position">#{index+1}</span>{game.genreL1&&<span>{genreLabel(game.genreL1)}</span>}{(game.mediaVideos?.length??0)>0&&<span>▶ 영상</span>}</div><strong>{game.nameKo}</strong><b>{compactNumber(game.playing)}명</b></div></Link>)}</section>}
    <section className="play-actions" aria-label="함께 이용하기">
      <Link href="/community?state=unanswered" className="play-action action-pink"><span className="action-icon"><PlayIcon name="chat"/></span><span><strong>이 질문, 나도 알아!</strong><small>답변 없는 질문 도와주기</small></span><PlayIcon name="arrow"/></Link>
      <Link href="/games?intent=party" className="play-action action-blue"><span className="action-icon"><PlayIcon name="party"/></span><span><strong>같이 할 사람?</strong><small>게임 골라 파티 찾기</small></span><PlayIcon name="arrow"/></Link>
      <Link href="/guides" className="play-action action-yellow"><span className="action-icon"><PlayIcon name="book"/></span><span><strong>막혔을 땐 공략!</strong><small>시작 방법부터 차근차근</small></span><PlayIcon name="arrow"/></Link>
    </section>
    <section><div className="section-head"><h2><PlayIcon name="rise"/>실시간 TOP</h2><span className="section-note">현재값 확인 {live.length}/{games.length} · <Link href="/games">전체 보기 →</Link></span></div><div className="visual-card-grid">{live.slice(3,15).map((game,index)=><GameVisualCard key={game.universeId} game={game} rank={index+4}/>)}</div></section>
    <section><div className="section-head"><h2><PlayIcon name="rise"/>상승 중</h2><Link href="/rising">전체 보기 →</Link></div>{trends.length>0?<div className="visual-card-grid visual-card-grid-3">{trends.map(({game,trend},index)=><GameVisualCard key={game.universeId} game={game} rank={index+1} badge={trend.score==null?undefined:"점수 "+trend.score.toFixed(0)}/>)}</div>:<div className="media-empty">상승 데이터를 더 모으는 중</div>}</section>
    {detectedUpdates.length>0&&<section><div className="section-head"><h2><PlayIcon name="spark"/>업데이트 감지</h2><span className="section-note">Roblox 업데이트 시각 변화 기준 · <Link href="/updates">전체 기록 →</Link></span></div><div className="visual-card-grid">{detectedUpdates.map(({game,event})=><GameVisualCard key={game.universeId} game={game} href={"/game/"+game.slug+"/updates"} badge={relativeTime(event.first_observed_at)}/>)}</div></section>}
    <DiscoveryShelf games={games.filter(g=>Boolean(g.heroImageUrl)&&g.regionalAvailability!=="restricted_kr")}/>
    {editorialGuides.length>0&&<section><div className="section-head"><h2><PlayIcon name="book"/>공략</h2></div><div className="content-link-grid">{editorialGuides.map(({guide,game})=><Link className="content-link-card" href={"/game/"+game.slug+"/guides/"+guide.slug} key={guide.id}>{game.heroImageUrl&&<img className="guide-card-image" src={game.heroImageUrl} alt="" width={768} height={432} loading="lazy"/>}<div className="guide-card-copy"><span>{game.nameKo}</span><strong>{guide.title}</strong><small>{guide.guide_type==="mechanic"?"조작·규칙":"입문"}<span aria-hidden="true">읽어보기 ↗</span></small></div></Link>)}</div></section>}
  </main></>;
}

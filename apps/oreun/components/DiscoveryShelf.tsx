"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { GameView } from "@/lib/types";
import { discoveryGenres } from "@/lib/discovery";
import GameVisualCard from "./GameVisualCard";
import PlayIcon from "./PlayIcon";
export default function DiscoveryShelf({games}:{games:GameView[]}) {
  const [genre,setGenre]=useState("all");
  const choices=useMemo(()=>discoveryGenres(games),[games]);
  const rows=useMemo(()=>games.filter(g=>genre==="all"||g.genreL1===genre).slice(0,6),[games,genre]);
  if(!games.length) return null;
  return <section className="discovery-shelf" aria-labelledby="discovery-heading">
    <div className="section-head"><h2 id="discovery-heading"><PlayIcon name="spark"/>내 취향 게임 찾기</h2><Link href="/games">전체 게임 ↗</Link></div>
    <div className="genre-chips" role="group" aria-label="게임 장르 선택">
      <button type="button" aria-pressed={genre==="all"} onClick={()=>setGenre("all")}>모두</button>
      {choices.map(c=><button type="button" key={c.value} aria-pressed={genre===c.value} onClick={()=>setGenre(c.value)}>{c.label}<span>{c.count}</span></button>)}
    </div>
    <p className="sr-only" role="status">{genre==="all"?"전체":choices.find(c=>c.value===genre)?.label} 게임 {rows.length}개 표시</p>
    <div className="discovery-cards">{rows.map(g=><GameVisualCard key={g.universeId} game={g}/>)}</div>
  </section>;
}

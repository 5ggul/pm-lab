"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameView } from "@/lib/types";
import { normalizeQuery, rankGameSearch } from "@/lib/search";
export default function SearchBox({games,compact=false}:{games:GameView[];compact?:boolean}){const [q,setQ]=useState("");const router=useRouter();const results=useMemo(()=>q.trim()?rankGameSearch(games,q).slice(0,5):[],[games,q]);
function submit(e:React.FormEvent){e.preventDefault();const exact=results.find(g=>[g.nameKo,g.name,...g.aliases].some(a=>normalizeQuery(a)===normalizeQuery(q)));if(exact)router.push(`/game/${exact.slug}`);else router.push(`/search?q=${encodeURIComponent(q)}`);}
return <div className={`search-wrap ${compact?"compact":""}`}><form role="search" onSubmit={submit}><label className="sr-only" htmlFor={compact?"global-search-compact":"global-search"}>게임 검색</label><input id={compact?"global-search-compact":"global-search"} value={q} onChange={e=>setQ(e.target.value)} autoComplete="off" placeholder="게임 이름 · 라이벌즈 · 99나이트"/><button type="submit">검색</button></form>{q.trim()&&<div className="search-suggest" role="listbox">{results.length?results.map(g=><button type="button" key={g.universeId} onClick={()=>router.push(`/game/${g.slug}`)}><span>{g.nameKo}</span><small>{g.name}</small></button>):<div className="empty-suggest">일치하는 게임이 없습니다.</div>}</div>}</div>}

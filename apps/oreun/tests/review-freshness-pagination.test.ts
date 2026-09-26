import test from "node:test";
import assert from "node:assert/strict";
import { computeTrend } from "../lib/trend";
import { historyFreshness } from "../lib/trend-freshness";
import { selectAllPublicRows } from "../lib/repository/paginated-public";
import type { HistoryPoint } from "../lib/types";
const now = new Date("2026-09-23T12:05:00Z");
const series=(delay=0):HistoryPoint[]=>Array.from({length:30},(_,i)=>({at:new Date(+now-delay-(29-i)*3600000).toISOString(),playing:1000+i*100,coverageRatio:1}));
test("fresh hourly-start buckets qualify, fully covered stale history does not",()=>{
 const fresh=computeTrend(1,series(),null,now,60),stale=computeTrend(1,series(126*60000),null,now,60);
 assert.equal(fresh.eligible,true);assert.equal(stale.eligible,false);assert.equal(stale.score,null);assert.equal(stale.metrics.coverageRatio,1);
 assert.equal(historyFreshness(series(125*60000),now,60).fresh,true);
});
test("new low-quality or null rows do not refresh the last trusted observation",()=>{
 for(const bad of [{playing:9000,coverageRatio:.1},{playing:null,coverageRatio:1},{playing:NaN,coverageRatio:1}]){
  const rows=[...series(180*60000),{at:now.toISOString(),...bad}];assert.equal(computeTrend(1,rows,null,now).eligible,false);
 }
 const zeros=series().map(p=>({...p,playing:0}));assert.equal(historyFreshness(zeros,now).fresh,true);assert.equal(computeTrend(1,zeros,null,now).metrics.recent,0);
 assert.equal(historyFreshness(series().map(p=>({...p,playing:null})),now).fresh,false);
 assert.equal(historyFreshness([{at:"not a date",playing:4}],now).fresh,false);
 assert.equal(historyFreshness([{at:new Date(+now+120000).toISOString(),playing:4}],now).fresh,false);
});
const config={url:"https://example.supabase.co",publishableKey:"test"};
const query={select:"id",order:"id.asc"};
const read=(f:typeof fetch)=>selectAllPublicRows<{id:number}>(config,"history",query,{pageSize:500,key:r=>String(r.id),fetcher:f});
test("REST cap smaller than requested page is followed to exact total including newest rows",async()=>{
 let requests=0;const total=2531;
 const f=(async(input:unknown,init?:RequestInit)=>{const url=new URL(String(input));const offset=Number(url.searchParams.get("offset"));const size=Math.min(200,total-offset);requests++;assert.equal(new Headers(init?.headers).get("Prefer"),"count=exact");return Response.json(Array.from({length:size},(_,i)=>({id:offset+i})),{headers:{"content-range":`${offset}-${offset+size-1}/${total}`}});}) as typeof fetch;
 const all=await read(f);assert.equal(all.rows.length,total);assert.equal(all.total,total);assert.equal(all.rows.at(-1)?.id,2530);assert.equal(requests,13);
});
for(const mode of ["missing-range","failed-page","empty-page","changed-total","duplicate"]){test("partial history is rejected: "+mode,async()=>{
 let calls=0;const f=(async()=>{calls++;if(mode==="missing-range")return Response.json([{id:0}]);if(calls===1)return Response.json([{id:0}],{headers:{"content-range":"0-0/2"}});if(mode==="failed-page")return new Response("down",{status:503});if(mode==="empty-page")return Response.json([],{headers:{"content-range":"*/2"}});return Response.json([{id:mode==="duplicate"?0:1}],{headers:{"content-range":`1-1/${mode==="changed-total"?3:2}`}});}) as typeof fetch;
 await assert.rejects(read(f));
});}
test("a confirmed empty public set is not an error",async()=>{const r=await read((async()=>Response.json([],{headers:{"content-range":"*/0"}})) as typeof fetch);assert.equal(r.total,0);assert.deepEqual(r.rows,[]);});

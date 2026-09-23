import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { selectAllPublicRows } from "../lib/repository/paginated-public";
import { GAME_IDENTITIES } from "../lib/seed";
import { getPublicGuideCatalog } from "../lib/content/queries";
const config={url:process.env.NEXT_PUBLIC_SUPABASE_URL!,publishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!};
if(!config.url||!config.publishableKey)throw new Error("public read config missing");
async function main(){
 const end=new Date().toISOString(),start=new Date(Date.now()-168*3600000).toISOString();
 const ids=GAME_IDENTITIES.map(g=>g.universeId).sort((a,b)=>a-b);
 const scope={select:"universe_id,bucket_at,playing_last,coverage_ratio",universe_id:`in.(${ids.join(",")})`,and:`(bucket_at.gte.${start},bucket_at.lte.${end})`,order:"bucket_at.asc,universe_id.asc"};
 const all=await selectAllPublicRows<{universe_id:number;bucket_at:string}>(config,"game_rollups_hourly",scope,{key:r=>r.bucket_at+"|"+r.universe_id});
 assert.equal(all.rows.length,all.total);assert.ok(all.total>1000,"live fixture has >1000 history rows");
 const firstUrl=new URL('/rest/v1/game_rollups_hourly',config.url);for(const[k,v]of Object.entries(scope))firstUrl.searchParams.set(k,v);
 const one=await fetch(firstUrl,{headers:{apikey:config.publishableKey,Prefer:"count=exact"}});if(!one.ok)throw new Error("first page failed");const raw=await one.json();
 assert.equal(Number(one.headers.get("content-range")?.split("/")[1]),all.total);
 const catalogue=await getPublicGuideCatalog();assert.ok(catalogue.length>=5);
 for(const guide of catalogue)assert.doesNotMatch(guide.body,/그런 내용은|이 가이드는|여기서는.*정리합니다|만 설명합니다|만 다룹니다/);
 const result={checked_at:new Date().toISOString(),scope:{start,end,games:ids.length},history:{total:all.total,returned:all.rows.length,pages:all.pages,unpaginated_rows:raw.length,unpaginated_range:one.headers.get("content-range"),old_last:raw.at(-1)?.bucket_at,new_last:all.rows.at(-1)?.bucket_at},public_guides:catalogue.length,writes_to_user_data:0};
 writeFileSync("review-live-reads.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

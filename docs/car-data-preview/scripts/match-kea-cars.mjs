import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const normalizedPath=path.join(root,'data','staging','kea-car-efficiency-normalized.json');
const vehicleRoot=path.join(root,'data','vehicles');
const manifestPath=path.join(vehicleRoot,'manifest.json');
const outPath=path.join(root,'data','generated','kea-api-coverage.json');

if(!fs.existsSync(normalizedPath)){console.log('KEA match skipped: no normalized API snapshot');process.exit(0)}
const normalized=JSON.parse(fs.readFileSync(normalizedPath,'utf8'));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const vehicles=manifest.vehicles.map(e=>({...JSON.parse(fs.readFileSync(path.join(vehicleRoot,e.file),'utf8')),display_name:e.display_name,indexable:e.indexable}));

const norm=s=>String(s??'').toLowerCase().replace(/주식회사|\(주\)|㈜|현대자동차|기아자동차|자동차|motors?|motor company|co\.?\s*ltd\.?|company|[^0-9a-z가-힣]/g,'');
const tokens=s=>String(s??'').toLowerCase().replace(/[^0-9a-z가-힣]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1);
const makerAliases={현대:['현대','hyundai'],기아:['기아','kia'],제네시스:['제네시스','genesis']};
function makerScore(row,car){const r=norm(row.maker_raw),aliases=makerAliases[car.maker]||[car.maker];return aliases.some(a=>r.includes(norm(a)))?30:0}
function nameScore(row,car){const raw=norm(row.model_raw),names=[car.model,car.display_name,car.code,...(car.aliases||[])].filter(Boolean);let best=0;for(const name of names){const n=norm(name);if(!n)continue;if(raw===n)best=Math.max(best,45);else if(raw.includes(n)||n.includes(raw))best=Math.max(best,35);const ts=tokens(name),hits=ts.filter(t=>raw.includes(norm(t))).length;if(ts.length)best=Math.max(best,Math.round(30*hits/ts.length))}return best}
function variantScore(row,car){let best={score:0,variant_id:null};for(const v of car.variants||[]){let s=0;if(row.displacement_cc&&v.displacement_cc&&Math.abs(row.displacement_cc-v.displacement_cc)<=3)s+=15;const eff=row.combined_efficiency;const target=v.fuel_type==='ev'?v.energy_efficiency_combined_km_kwh:v.fuel_economy_combined;if(eff&&target&&Math.abs(eff-target)<=0.05)s+=15;else if(eff&&target&&Math.abs(eff-target)<=0.15)s+=9;if(s>best.score)best={score:s,variant_id:v.variant_id}}return best}

const matches=[],ambiguous=[],unmatched=[];
for(const row of normalized.rows){let ranked=[];for(const car of vehicles){const vs=variantScore(row,car),score=makerScore(row,car)+nameScore(row,car)+vs.score;ranked.push({car_id:car.id,variant_id:vs.variant_id,score})}ranked.sort((a,b)=>b.score-a.score);const top=ranked[0],second=ranked[1];if(top&&top.score>=70&&(!second||top.score-second.score>=10)){matches.push({...row,match_status:'auto_matched_existing',matched_car_id:top.car_id,matched_variant_id:top.variant_id,match_score:top.score})}else if(top&&top.score>=45){ambiguous.push({...row,match_status:'ambiguous',candidate_matches:ranked.slice(0,3)})}else unmatched.push({...row,match_status:'unmatched'})}

const makers={};for(const row of normalized.rows){const k=row.maker_raw||'미상';makers[k]=(makers[k]||0)+1}
const coverage={schema_version:1,source_url:normalized.source_url,fetched_at:normalized.fetched_at,total_rows:normalized.rows.length,existing_ssot_vehicles:vehicles.length,auto_matched_rows:matches.length,ambiguous_rows:ambiguous.length,unmatched_rows:unmatched.length,auto_match_rate:normalized.rows.length?Number((matches.length/normalized.rows.length*100).toFixed(2)):0,policy:'API raw rows never become public/indexable without vehicle-family mapping and quality gate review.',top_makers:Object.entries(makers).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([maker,count])=>({maker,count})),matched:matches,ambiguous:ambiguous.slice(0,500),unmatched_sample:unmatched.slice(0,500)};
fs.writeFileSync(outPath,JSON.stringify(coverage,null,2)+'\n');
fs.writeFileSync(path.join(root,'data','staging','kea-car-efficiency-unmatched.json'),JSON.stringify({schema_version:1,fetched_at:normalized.fetched_at,row_count:ambiguous.length+unmatched.length,ambiguous,unmatched},null,2)+'\n');
console.log(`KEA coverage: ${matches.length} matched / ${ambiguous.length} ambiguous / ${unmatched.length} unmatched of ${normalized.rows.length}`);

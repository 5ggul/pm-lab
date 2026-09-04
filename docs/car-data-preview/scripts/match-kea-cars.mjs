import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const normalizedPath=path.join(root,'data','staging','kea-car-efficiency-normalized.json');
const vehicleRoot=path.join(root,'data','vehicles');
const manifestPath=path.join(vehicleRoot,'manifest.json');
const outPath=path.join(root,'data','generated','kea-api-coverage.json');
const candidatesPath=path.join(root,'data','staging','kea-model-candidates.json');

if(!fs.existsSync(normalizedPath)){console.log('KEA match skipped: no normalized API snapshot');process.exit(0)}
const normalized=JSON.parse(fs.readFileSync(normalizedPath,'utf8'));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const vehicles=manifest.vehicles.map(e=>({...JSON.parse(fs.readFileSync(path.join(vehicleRoot,e.file),'utf8')),display_name:e.display_name,indexable:e.indexable}));

const norm=s=>String(s??'').toLowerCase().replace(/주식회사|\(주\)|㈜|현대자동차|기아자동차|자동차|motors?|motor company|co\.?\s*ltd\.?|company|[^0-9a-z가-힣]/g,'');
const tokens=s=>String(s??'').toLowerCase().replace(/[^0-9a-z가-힣]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1);
const makerAliases={현대:['현대','hyundai'],기아:['기아','kia'],제네시스:['제네시스','genesis']};
function makerScore(row,car){const r=norm(row.maker_raw),aliases=makerAliases[car.maker]||[car.maker];return aliases.some(a=>r.includes(norm(a)))?30:0}
function nameScore(row,car){const raw=norm(row.model_raw),names=[car.model,car.display_name,car.code,...(car.aliases||[])].filter(Boolean);let best=0;for(const name of names){const n=norm(name);if(!n)continue;if(raw===n)best=Math.max(best,45);else if(raw.includes(n)||n.includes(raw))best=Math.max(best,35);const ts=tokens(name),hits=ts.filter(t=>raw.includes(norm(t))).length;if(ts.length)best=Math.max(best,Math.round(30*hits/ts.length))}return best}
function variantScore(row,car){let best={score:0,variant_id:null};for(const v of car.variants||[]){let s=0;if(row.displacement_cc&&v.displacement_cc&&Math.abs(row.displacement_cc-v.displacement_cc)<=3)s+=15;const eff=row.combined_efficiency,target=v.fuel_type==='ev'?v.energy_efficiency_combined_km_kwh:v.fuel_economy_combined;if(eff&&target&&Math.abs(eff-target)<=0.05)s+=15;else if(eff&&target&&Math.abs(eff-target)<=0.15)s+=9;if(s>best.score)best={score:s,variant_id:v.variant_id}}return best}

const matches=[],ambiguous=[],unmatched=[];
for(const row of normalized.rows){let ranked=[];for(const car of vehicles){const vs=variantScore(row,car),score=makerScore(row,car)+nameScore(row,car)+vs.score;ranked.push({car_id:car.id,variant_id:vs.variant_id,score})}ranked.sort((a,b)=>b.score-a.score);const top=ranked[0],second=ranked[1];if(top&&top.score>=70&&(!second||top.score-second.score>=10)){matches.push({...row,match_status:'auto_matched_existing',matched_car_id:top.car_id,matched_variant_id:top.variant_id,match_score:top.score})}else if(top&&top.score>=45){ambiguous.push({...row,match_status:'ambiguous',candidate_matches:ranked.slice(0,3)})}else unmatched.push({...row,match_status:'unmatched'})}

const makers={};for(const row of normalized.rows){const k=row.maker_raw||'미상';makers[k]=(makers[k]||0)+1}
const coverage={schema_version:2,source_url:normalized.source_url,fetched_at:normalized.fetched_at,total_rows:normalized.rows.length,existing_ssot_vehicles:vehicles.length,auto_matched_rows:matches.length,ambiguous_rows:ambiguous.length,unmatched_rows:unmatched.length,auto_match_rate:normalized.rows.length?Number((matches.length/normalized.rows.length*100).toFixed(2)):0,policy:'API raw rows never become public/indexable without vehicle-family mapping and quality gate review.',top_makers:Object.entries(makers).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([maker,count])=>({maker,count})),matched:matches,ambiguous:ambiguous.slice(0,500),unmatched_sample:unmatched.slice(0,500)};
fs.writeFileSync(outPath,JSON.stringify(coverage,null,2)+'\n');
fs.writeFileSync(path.join(root,'data','staging','kea-car-efficiency-unmatched.json'),JSON.stringify({schema_version:2,fetched_at:normalized.fetched_at,row_count:ambiguous.length+unmatched.length,ambiguous,unmatched},null,2)+'\n');

// Inventory only: exact source labels are grouped to understand API coverage. These groups are never publishable by themselves.
const groups=new Map();
for(const row of normalized.rows){
  const model=String(row.model_raw||'').trim();if(!model)continue;
  const maker=String(row.maker_raw||'').trim();
  const key=`${norm(maker)||'unknown'}|${norm(model)||model.toLowerCase()}`;
  if(!groups.has(key))groups.set(key,{candidate_group_id:'kea-model-'+crypto.createHash('sha1').update(key).digest('hex').slice(0,12),maker_raw:maker&&maker.toUpperCase()!=='NULL'?maker:null,model_raw:model,row_count:0,source_record_ids:[],displacements:new Set(),efficiencies:new Set(),grades:new Set(),matched_existing_car_ids:new Set(),statuses:new Set()});
  const g=groups.get(key);g.row_count++;if(g.source_record_ids.length<100)g.source_record_ids.push(row.source_record_id);if(row.displacement_cc)g.displacements.add(row.displacement_cc);if(row.combined_efficiency)g.efficiencies.add(row.combined_efficiency);if(row.efficiency_grade)g.grades.add(row.efficiency_grade);
  const match=matches.find(x=>x.source_record_id===row.source_record_id);const amb=ambiguous.find(x=>x.source_record_id===row.source_record_id);if(match){g.statuses.add('matched_existing');g.matched_existing_car_ids.add(match.matched_car_id)}else if(amb)g.statuses.add('ambiguous');else g.statuses.add('unmatched');
}
const modelGroups=[...groups.values()].map(g=>({candidate_group_id:g.candidate_group_id,maker_raw:g.maker_raw,model_raw:g.model_raw,row_count:g.row_count,displacement_cc_values:[...g.displacements].sort((a,b)=>a-b),combined_efficiency_values:[...g.efficiencies].sort((a,b)=>a-b),efficiency_grades:[...g.grades].sort((a,b)=>a-b),matched_existing_car_ids:[...g.matched_existing_car_ids],match_statuses:[...g.statuses],source_record_ids:g.source_record_ids,publishable:false,review_status:'staging_only'})).sort((a,b)=>b.row_count-a.row_count||a.model_raw.localeCompare(b.model_raw,'ko'));
const inventory={schema_version:1,source_url:normalized.source_url,fetched_at:normalized.fetched_at,total_source_rows:normalized.rows.length,distinct_exact_model_groups:modelGroups.length,groups:modelGroups};
fs.writeFileSync(candidatesPath,JSON.stringify(inventory,null,2)+'\n');
console.log(`KEA coverage: ${matches.length} matched / ${ambiguous.length} ambiguous / ${unmatched.length} unmatched of ${normalized.rows.length}; ${modelGroups.length} exact model groups`);

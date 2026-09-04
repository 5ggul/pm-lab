import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const energyPath=path.join(root,'data','staging','kea-car-efficiency-normalized.json');
const displayPath=path.join(root,'data','staging','kea-car-display-normalized.json');
const outPath=path.join(root,'data','staging','kea-all-cars-merged.json');
const statusPath=path.join(root,'data','generated','kea-merged-status.json');
if(!fs.existsSync(displayPath)){console.log('KEA merge skipped: rich display snapshot missing');process.exit(0)}
const display=JSON.parse(fs.readFileSync(displayPath,'utf8'));
const energy=fs.existsSync(energyPath)?JSON.parse(fs.readFileSync(energyPath,'utf8')):{rows:[]};
const norm=s=>String(s??'').toLowerCase().replace(/주식회사|\(주\)|㈜|현대자동차|기아자동차|자동차|motors?|motor company|co\.?\s*ltd\.?|company|[^0-9a-z가-힣]/g,'');
const round1=n=>n==null?null:Number(Number(n).toFixed(3));
const idFor=(r,index)=>'kea-merged-'+crypto.createHash('sha1').update(`${norm(r.maker_raw)}|${norm(r.model_raw)}|${r.combined_efficiency}|${r.city_efficiency}|${r.highway_efficiency}|${r.range_km}|${r.source_row_index??index}`).digest('hex').slice(0,18);
const byName=new Map();
for(const e of energy.rows||[]){const key=norm(e.model_raw);if(!key)continue;if(!byName.has(key))byName.set(key,[]);byName.get(key).push(e)}
function makerCompatible(a,b){const x=norm(a),y=norm(b);if(!x||!y||x==='null'||y==='null')return true;return x===y||x.includes(y)||y.includes(x)}
function candidatesFor(d){const name=norm(d.model_raw);if(!name)return[];const pool=byName.get(name)||[];return pool.filter(e=>makerCompatible(d.maker_raw,e.maker_raw)&&((d.combined_efficiency==null||e.combined_efficiency==null)||Math.abs(Number(d.combined_efficiency)-Number(e.combined_efficiency))<=0.05))}
let unique=0,ambiguous=0,displayOnly=0;
const rows=(display.rows||[]).map((d,index)=>{const candidates=candidatesFor(d);let merge_status='display_only',energyRow=null;if(candidates.length===1){merge_status='exact_unique';energyRow=candidates[0];unique++}else if(candidates.length>1){merge_status='ambiguous_energy_match';ambiguous++}else displayOnly++;const displayRowIndex=d.source_row_index??index;return{
  merged_record_id:idFor(d,index),maker_raw:d.maker_raw,model_raw:d.model_raw,vehicle_class_raw:d.vehicle_class_raw,type_raw:d.type_raw,
  displacement_cc:energyRow?.displacement_cc??null,combined_efficiency:round1(d.combined_efficiency),city_efficiency:round1(d.city_efficiency),highway_efficiency:round1(d.highway_efficiency),range_km:d.range_km??null,efficiency_grade:d.efficiency_grade??energyRow?.efficiency_grade??null,official_annual_fuel_cost_krw:energyRow?.official_annual_fuel_cost_krw??null,
  merge_status,energy_candidate_count:candidates.length,energy_source_record_id:energyRow?.source_record_id??null,energy_source_row_index:energyRow?.source_row_index??null,energy_candidate_ids:candidates.length>1?candidates.slice(0,10).map(x=>x.source_record_id):[],display_source_record_id:d.source_record_id,display_source_row_index:displayRowIndex,
  sources:[{dataset:'KEA_DISPLAY_EFFICIENCY_20260424',source_url:d.source_url,record_id:d.source_record_id,row_index:displayRowIndex},...(energyRow?[{dataset:'KEA_CAR_01_LIST',source_url:energyRow.source_url,record_id:energyRow.source_record_id,row_index:energyRow.source_row_index??null}]:[])],publishable:false,review_status:'staging_only'
}});
const groupMap=new Map();for(const r of rows){const key=`${norm(r.maker_raw)||'unknown'}|${norm(r.model_raw)}`;if(!groupMap.has(key))groupMap.set(key,{maker_raw:r.maker_raw,model_raw:r.model_raw,row_count:0,merged_record_ids:[],merge_statuses:new Set()});const g=groupMap.get(key);g.row_count++;if(g.merged_record_ids.length<100)g.merged_record_ids.push(r.merged_record_id);g.merge_statuses.add(r.merge_status)}
const groups=[...groupMap.values()].map(g=>({...g,merge_statuses:[...g.merge_statuses],publishable:false,review_status:'staging_only'})).sort((a,b)=>b.row_count-a.row_count||String(a.model_raw).localeCompare(String(b.model_raw),'ko'));
const output={schema_version:2,fetched_at:display.fetched_at,display_source_rows:rows.length,energy_source_rows:(energy.rows||[]).length,exact_unique_energy_matches:unique,ambiguous_energy_matches:ambiguous,display_only_rows:displayOnly,distinct_exact_model_groups:groups.length,policy:'Merged rows preserve every KEA display-source row instance. No URL/public/indexable state is generated without reviewed vehicle-family mapping.',rows,groups};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(statusPath,JSON.stringify({ok:true,schema_version:2,fetched_at:display.fetched_at,display_rows:rows.length,energy_rows:(energy.rows||[]).length,exact_unique_energy_matches:unique,ambiguous_energy_matches:ambiguous,display_only_rows:displayOnly,exact_model_groups:groups.length},null,2)+'\n');
console.log(`KEA merged: ${rows.length} rich rows / ${unique} unique energy joins / ${ambiguous} ambiguous / ${displayOnly} display-only / ${groups.length} model groups`);

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
const harmlessName=s=>norm(String(s??'')
  .replace(/\b(?:20)?\d{2}\s*MY\b/ig,' ')
  .replace(/\((?:20)?\d{2}\s*(?:MY)?\)/ig,' ')
  .replace(/(?:빌트\s*인\s*캠|빌트인캠|built[- ]?in\s*cam)/ig,' ')
  .replace(/\bSTEP\s*2\b/ig,' '));
const round1=n=>n==null?null:Number(Number(n).toFixed(3));
const idFor=(r,index)=>'kea-merged-'+crypto.createHash('sha1').update(`${norm(r.maker_raw)}|${norm(r.model_raw)}|${r.combined_efficiency}|${r.city_efficiency}|${r.highway_efficiency}|${r.range_km}|${r.source_row_index??index}`).digest('hex').slice(0,18);
const byName=new Map(),byHarmlessName=new Map();
for(const e of energy.rows||[]){
  const exact=norm(e.model_raw),harmless=harmlessName(e.model_raw);
  if(exact){if(!byName.has(exact))byName.set(exact,[]);byName.get(exact).push(e)}
  if(harmless){if(!byHarmlessName.has(harmless))byHarmlessName.set(harmless,[]);byHarmlessName.get(harmless).push(e)}
}
function makerCompatible(a,b){const x=norm(a),y=norm(b);if(!x||!y||x==='null'||y==='null')return true;return x===y||x.includes(y)||y.includes(x)}
function sameEfficiency(a,b){return a!=null&&b!=null&&Math.abs(Number(a)-Number(b))<=0.05}
function candidatesFor(d){const name=norm(d.model_raw);if(!name)return[];const pool=byName.get(name)||[];return pool.filter(e=>makerCompatible(d.maker_raw,e.maker_raw)&&sameEfficiency(d.combined_efficiency,e.combined_efficiency))}
function cosmeticCandidatesFor(d){const exact=norm(d.model_raw),harmless=harmlessName(d.model_raw);if(!harmless||harmless===exact)return[];const pool=byHarmlessName.get(harmless)||[];return pool.filter(e=>norm(e.model_raw)!==exact&&makerCompatible(d.maker_raw,e.maker_raw)&&sameEfficiency(d.combined_efficiency,e.combined_efficiency))}
function consensusDisplacement(candidates){const values=[...new Set(candidates.map(e=>Number(e.displacement_cc)).filter(n=>Number.isFinite(n)&&n>0))];return values.length===1?values[0]:null}
let unique=0,ambiguous=0,consensusCc=0,cosmeticCc=0,displayOnly=0;
const rows=(display.rows||[]).map((d,index)=>{
  const candidates=candidatesFor(d);let merge_status='display_only',energyRow=null,consensusCcValue=null,displacementSource=null,recordedCandidates=candidates;
  if(candidates.length===1){
    merge_status='exact_unique';energyRow=candidates[0];displacementSource=energyRow.displacement_cc!=null?'exact_unique_energy_row':null;unique++;
  }else if(candidates.length>1){
    consensusCcValue=consensusDisplacement(candidates);
    if(consensusCcValue!=null){merge_status='exact_multi_same_cc';displacementSource='candidate_consensus';consensusCc++}
    else{merge_status='ambiguous_energy_match';ambiguous++}
  }else{
    const cosmetic=cosmeticCandidatesFor(d),cc=consensusDisplacement(cosmetic);
    if(cosmetic.length>0&&cc!=null){
      merge_status=cosmetic.length===1?'safe_cosmetic_unique_cc':'safe_cosmetic_multi_same_cc';
      consensusCcValue=cc;displacementSource='safe_cosmetic_candidate_consensus';recordedCandidates=cosmetic;cosmeticCc++;
    }else displayOnly++;
  }
  const displayRowIndex=d.source_row_index??index;
  return{
    merged_record_id:idFor(d,index),maker_raw:d.maker_raw,model_raw:d.model_raw,vehicle_class_raw:d.vehicle_class_raw,type_raw:d.type_raw,
    displacement_cc:energyRow?.displacement_cc??consensusCcValue??null,displacement_source:displacementSource,combined_efficiency:round1(d.combined_efficiency),city_efficiency:round1(d.city_efficiency),highway_efficiency:round1(d.highway_efficiency),range_km:d.range_km??null,efficiency_grade:d.efficiency_grade??energyRow?.efficiency_grade??null,official_annual_fuel_cost_krw:energyRow?.official_annual_fuel_cost_krw??null,
    merge_status,energy_candidate_count:recordedCandidates.length,energy_source_record_id:energyRow?.source_record_id??null,energy_source_row_index:energyRow?.source_row_index??null,energy_candidate_ids:recordedCandidates.length>1||merge_status.startsWith('safe_cosmetic_')?recordedCandidates.slice(0,20).map(x=>x.source_record_id):[],display_source_record_id:d.source_record_id,display_source_row_index:displayRowIndex,
    sources:[{dataset:'KEA_DISPLAY_EFFICIENCY_20260424',source_url:d.source_url,record_id:d.source_record_id,row_index:displayRowIndex},...(energyRow?[{dataset:'KEA_CAR_01_LIST',source_url:energyRow.source_url,record_id:energyRow.source_record_id,row_index:energyRow.source_row_index??null}]:[])],publishable:false,review_status:'staging_only'
  }
});
const groupMap=new Map();for(const r of rows){const key=`${norm(r.maker_raw)||'unknown'}|${norm(r.model_raw)}`;if(!groupMap.has(key))groupMap.set(key,{maker_raw:r.maker_raw,model_raw:r.model_raw,row_count:0,merged_record_ids:[],merge_statuses:new Set()});const g=groupMap.get(key);g.row_count++;if(g.merged_record_ids.length<100)g.merged_record_ids.push(r.merged_record_id);g.merge_statuses.add(r.merge_status)}
const groups=[...groupMap.values()].map(g=>({...g,merge_statuses:[...g.merge_statuses],publishable:false,review_status:'staging_only'})).sort((a,b)=>b.row_count-a.row_count||String(a.model_raw).localeCompare(String(b.model_raw),'ko'));
const output={schema_version:4,fetched_at:display.fetched_at,display_source_rows:rows.length,energy_source_rows:(energy.rows||[]).length,exact_unique_energy_matches:unique,consensus_displacement_matches:consensusCc,safe_cosmetic_displacement_matches:cosmeticCc,ambiguous_energy_matches:ambiguous,display_only_rows:displayOnly,distinct_exact_model_groups:groups.length,policy:'Every KEA display-source row is preserved. Multiple exact candidates are never arbitrarily selected: only a shared non-null displacement may be inherited. A second displacement-only join may ignore only explicit model-year markers, built-in-camera text, or Step2 emissions text; body style, wheel, seating, trim, powertrain, drive, and performance identity tokens are never stripped. Cosmetic joins also require compatible maker, identical combined efficiency within 0.05, and one shared non-null displacement across candidates. No arbitrary source row, annual fuel cost, or SEO/public state is inherited from consensus-only matches.',rows,groups};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(statusPath,JSON.stringify({ok:true,schema_version:4,fetched_at:display.fetched_at,display_rows:rows.length,energy_rows:(energy.rows||[]).length,exact_unique_energy_matches:unique,consensus_displacement_matches:consensusCc,safe_cosmetic_displacement_matches:cosmeticCc,ambiguous_energy_matches:ambiguous,display_only_rows:displayOnly,exact_model_groups:groups.length},null,2)+'\n');
console.log(`KEA merged: ${rows.length} rich rows / ${unique} unique / ${consensusCc} exact-consensus cc / ${cosmeticCc} cosmetic-consensus cc / ${ambiguous} ambiguous / ${displayOnly} display-only / ${groups.length} model groups`);

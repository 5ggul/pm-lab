import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const merged=JSON.parse(fs.readFileSync(path.join(root,'data','staging','kea-all-cars-merged.json'),'utf8'));
const energy=JSON.parse(fs.readFileSync(path.join(root,'data','staging','kea-car-efficiency-normalized.json'),'utf8'));
const norm=s=>String(s??'').toLowerCase().replace(/주식회사|\(주\)|㈜|현대자동차|기아자동차|자동차|motors?|motor company|co\.?\s*ltd\.?|company|[^0-9a-z가-힣]/g,'');
const harmless=s=>norm(String(s??'').replace(/\b(?:20)?\d{2}\s*MY\b/ig,' ').replace(/\((?:20)?\d{2}\s*(?:MY)?\)/ig,' ').replace(/(?:빌트\s*인\s*캠|빌트인캠|built[- ]?in\s*cam)/ig,' ').replace(/\bSTEP\s*2\b/ig,' '));
const makerCompatible=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y||x==='null'||y==='null')return true;return x===y||x.includes(y)||y.includes(x)};
const sameEff=(a,b)=>a!=null&&b!=null&&Math.abs(Number(a)-Number(b))<=0.05;
const propulsionTag=s=>{const v=String(s??'').toUpperCase();if(/수소|FCEV|HYDROGEN/.test(v))return'hydrogen';if(/PHEV|PLUG[- ]?IN|플러그인/.test(v))return'phev';if(/하이브리드|HYBRID|\bHEV\b/.test(v))return'hybrid';if(/일렉트릭|ELECTRIC|\bBEV\b|\bEV(?=\d|\b)/.test(v))return'electric';if(/LPG|LPI|엘피지/.test(v))return'lpg';if(/경유|디젤|DIESEL|\bTDI\b|\bCRDI\b/.test(v))return'diesel';if(/휘발유|가솔린|GASOLINE|PETROL|T-?GDI|\bGDI\b|\bMPI\b|\bTSI\b|\bTFSI\b/.test(v))return'gasoline';return null};
const propulsionCompatible=(a,b)=>{const x=propulsionTag(a),y=propulsionTag(b);if(['electric','phev','hybrid','hydrogen'].includes(x)||['electric','phev','hybrid','hydrogen'].includes(y))return x===y;return !x||!y||x===y};
const byId=new Map((energy.rows||[]).map(e=>[String(e.source_record_id),e]));
const fail=m=>{console.error('FAIL',m);process.exitCode=1},pass=m=>console.log('PASS',m);
if((merged.rows||[]).length===Number(merged.display_source_rows))pass(`merge preserves ${merged.display_source_rows} display rows`);else fail(`merged rows ${(merged.rows||[]).length} != display ${merged.display_source_rows}`);
const ids=new Set();let exactConsensus=0,cosmetic=0,containment=0,ambiguous=0;
for(const r of merged.rows||[]){
 if(ids.has(r.merged_record_id))fail(`duplicate merged id ${r.merged_record_id}`);else ids.add(r.merged_record_id);
 const candidates=(r.energy_candidate_ids||[]).map(id=>byId.get(String(id))).filter(Boolean);
 if(r.merge_status==='exact_multi_same_cc'){
  exactConsensus++;if(r.displacement_source!=='candidate_consensus')fail(`${r.merged_record_id} exact consensus bad source`);if(r.energy_source_record_id)fail(`${r.merged_record_id} exact consensus selected arbitrary row`);if(candidates.length<2)fail(`${r.merged_record_id} exact consensus candidate count ${candidates.length}`);const ccs=[...new Set(candidates.map(c=>Number(c.displacement_cc)).filter(n=>Number.isFinite(n)&&n>0))];if(ccs.length!==1||ccs[0]!==Number(r.displacement_cc))fail(`${r.merged_record_id} exact consensus cc mismatch`)
 }
 if(r.merge_status==='safe_cosmetic_unique_cc'||r.merge_status==='safe_cosmetic_multi_same_cc'){
  cosmetic++;if(r.displacement_source!=='safe_cosmetic_candidate_consensus')fail(`${r.merged_record_id} cosmetic bad source`);if(r.energy_source_record_id)fail(`${r.merged_record_id} cosmetic selected arbitrary source row`);if(!candidates.length)fail(`${r.merged_record_id} cosmetic candidates missing`);for(const c of candidates){if(harmless(c.model_raw)!==harmless(r.model_raw))fail(`${r.merged_record_id} cosmetic normalized name mismatch: ${r.model_raw} <> ${c.model_raw}`);if(norm(c.model_raw)===norm(r.model_raw))fail(`${r.merged_record_id} cosmetic candidate was actually exact`);if(!makerCompatible(r.maker_raw,c.maker_raw))fail(`${r.merged_record_id} cosmetic maker mismatch`);if(!sameEff(r.combined_efficiency,c.combined_efficiency))fail(`${r.merged_record_id} cosmetic efficiency mismatch`)}const ccs=[...new Set(candidates.map(c=>Number(c.displacement_cc)).filter(n=>Number.isFinite(n)&&n>0))];if(ccs.length!==1||ccs[0]!==Number(r.displacement_cc))fail(`${r.merged_record_id} cosmetic consensus cc mismatch`);if(r.official_annual_fuel_cost_krw!=null)fail(`${r.merged_record_id} cosmetic inherited annual fuel cost`)
 }
 if(r.merge_status==='safe_containment_unique_cc'){
  containment++;if(r.displacement_source!=='safe_containment_unique_candidate')fail(`${r.merged_record_id} containment bad source`);if(r.energy_source_record_id)fail(`${r.merged_record_id} containment selected source row`);if(candidates.length!==1)fail(`${r.merged_record_id} containment candidate count ${candidates.length}`);const c=candidates[0];const rn=norm(r.model_raw),cn=norm(c.model_raw);if(!(rn.includes(cn)||cn.includes(rn))||rn===cn)fail(`${r.merged_record_id} containment name mismatch`);if(!makerCompatible(r.maker_raw,c.maker_raw))fail(`${r.merged_record_id} containment maker mismatch`);if(!sameEff(r.combined_efficiency,c.combined_efficiency))fail(`${r.merged_record_id} containment efficiency mismatch`);if(!propulsionCompatible(r.model_raw,c.model_raw))fail(`${r.merged_record_id} containment propulsion mismatch`);if(Number(r.range_km)>0)fail(`${r.merged_record_id} containment inherited cc despite range`);if(!(Number(c.displacement_cc)>0)&&Number(r.displacement_cc)>0)fail(`${r.merged_record_id} containment nonpositive candidate cc`);if(Number(r.displacement_cc)!==Number(c.displacement_cc))fail(`${r.merged_record_id} containment cc mismatch`);if(r.official_annual_fuel_cost_krw!=null)fail(`${r.merged_record_id} containment inherited annual fuel cost`)
 }
 if(r.merge_status==='ambiguous_energy_match'){ambiguous++;if(r.displacement_cc!=null)fail(`${r.merged_record_id} unresolved ambiguous row inherited cc`)}
}
if(Number(merged.consensus_displacement_matches)===exactConsensus)pass(`exact consensus rows ${exactConsensus}`);else fail(`exact consensus stat ${merged.consensus_displacement_matches} != ${exactConsensus}`);
if(Number(merged.safe_cosmetic_displacement_matches)===cosmetic)pass(`safe cosmetic consensus rows ${cosmetic}`);else fail(`cosmetic stat ${merged.safe_cosmetic_displacement_matches} != ${cosmetic}`);
if(Number(merged.safe_containment_displacement_matches||0)===containment)pass(`safe containment rows ${containment}`);else fail(`containment stat ${merged.safe_containment_displacement_matches} != ${containment}`);
if(Number(merged.ambiguous_energy_matches)===ambiguous)pass(`unresolved ambiguous rows ${ambiguous}`);else fail(`ambiguous stat ${merged.ambiguous_energy_matches} != ${ambiguous}`);
if(!process.exitCode)console.log('KEA merge safety validation passed.');

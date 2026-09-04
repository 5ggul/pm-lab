import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const energy=JSON.parse(fs.readFileSync(path.join(root,'data','staging','kea-car-efficiency-normalized.json'),'utf8'));
const merged=JSON.parse(fs.readFileSync(path.join(root,'data','staging','kea-all-cars-merged.json'),'utf8'));
const outPath=path.join(root,'data','generated','kea-join-opportunities.json');
const norm=s=>String(s??'').toLowerCase().replace(/주식회사|유한회사|\(주\)|㈜|현대자동차|기아자동차|자동차|motors?|motor company|co\.?\s*ltd\.?|company|[^0-9a-z가-힣]/g,'');
const makerCompatible=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y||x==='null'||y==='null')return true;return x===y||x.includes(y)||y.includes(x)};
const strip=s=>norm(String(s??'').replace(/\b(?:2wd|4wd|awd|fwd|rwd|at|mt|dct|cvt|ivt|gdi|tgdi|mpi|crdi|diesel|gasoline|hybrid|phev|electric|bev|lpg)\b/ig,' ').replace(/(?:가솔린|휘발유|디젤|경유|하이브리드|플러그인\s*하이브리드|전기차?|엘피지|롱\s*레인지|스탠다드|퍼포먼스)/g,' ').replace(/\b\d(?:\.\d)?\s*(?:l|t)?\b/ig,' ').replace(/\b\d{3,4}\s*cc\b/ig,' ').replace(/\d{1,2}\s*(?:인치|인승)/g,' '));
const sameEff=(a,b)=>a==null||b==null?false:Math.abs(Number(a)-Number(b))<=0.05;
function candidateSummary(list){return list.slice(0,8).map(e=>({maker:e.maker_raw,model:e.model_raw,cc:e.displacement_cc,eff:e.combined_efficiency,id:e.source_record_id}))}
let ambiguousSameCc=0,ambiguousDifferentCc=0,containmentUnique=0,containmentAmbiguous=0,stemUnique=0,stemAmbiguous=0;const samples={ambiguous_same_cc:[],containment_unique:[],stem_unique:[],still_unmatched:[]};
for(const m of merged.rows||[]){
 if(m.merge_status==='ambiguous_energy_match'){
  const pool=(energy.rows||[]).filter(e=>norm(e.model_raw)===norm(m.model_raw)&&makerCompatible(m.maker_raw,e.maker_raw)&&sameEff(m.combined_efficiency,e.combined_efficiency));const ccs=[...new Set(pool.map(e=>Number(e.displacement_cc)||null).filter(v=>v!=null))];if(ccs.length===1){ambiguousSameCc++;if(samples.ambiguous_same_cc.length<100)samples.ambiguous_same_cc.push({display:{maker:m.maker_raw,model:m.model_raw,eff:m.combined_efficiency},shared_cc:ccs[0],candidates:candidateSummary(pool)})}else ambiguousDifferentCc++;continue;
 }
 if(m.merge_status!=='display_only')continue;
 const dn=norm(m.model_raw),ds=strip(m.model_raw);const base=(energy.rows||[]).filter(e=>makerCompatible(m.maker_raw,e.maker_raw)&&sameEff(m.combined_efficiency,e.combined_efficiency));
 const contain=base.filter(e=>{const en=norm(e.model_raw);return dn.length>=5&&en.length>=5&&(dn.includes(en)||en.includes(dn))});
 if(contain.length===1){containmentUnique++;if(samples.containment_unique.length<150)samples.containment_unique.push({display:{maker:m.maker_raw,model:m.model_raw,eff:m.combined_efficiency},candidate:candidateSummary(contain)[0]});continue}else if(contain.length>1)containmentAmbiguous++;
 const stem=base.filter(e=>{const es=strip(e.model_raw);return ds.length>=4&&es.length>=4&&ds===es});
 if(stem.length===1){stemUnique++;if(samples.stem_unique.length<150)samples.stem_unique.push({display:{maker:m.maker_raw,model:m.model_raw,eff:m.combined_efficiency,stem:ds},candidate:candidateSummary(stem)[0]});continue}else if(stem.length>1)stemAmbiguous++;
 if(samples.still_unmatched.length<150)samples.still_unmatched.push({display:{maker:m.maker_raw,model:m.model_raw,eff:m.combined_efficiency,stem:ds},same_maker_eff_candidates:candidateSummary(base)});
}
const output={schema_version:1,generated_at:new Date().toISOString(),current:{display_rows:merged.display_source_rows,energy_rows:merged.energy_source_rows,exact_unique:merged.exact_unique_energy_matches,ambiguous:merged.ambiguous_energy_matches,display_only:merged.display_only_rows},safe_opportunities:{ambiguous_exact_candidates_with_same_displacement:ambiguousSameCc,ambiguous_exact_candidates_with_different_or_missing_displacement:ambiguousDifferentCc,unique_name_containment_candidates:containmentUnique,ambiguous_name_containment_candidates:containmentAmbiguous,unique_strong_stem_candidates_after_containment:stemUnique,ambiguous_strong_stem_candidates:stemAmbiguous},policy:'Diagnostic only. Same-displacement ambiguous exact matches are candidates for cc-only enrichment. Containment/stem matches require validation before changing merge behavior.',samples};fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output.safe_opportunities));

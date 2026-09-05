import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-catalog.json'),'utf8'));
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data','vehicles','manifest.json'),'utf8'));
const fuel=JSON.parse(fs.readFileSync(path.join(root,'data','fuel-price.json'),'utf8'));
const outPath=path.join(root,'data','generated','all-car-calc-index.json');
const statusPath=path.join(root,'data','generated','all-car-calc-status.json');
const generatedAt=new Date().toISOString();
const index=hierarchy.group_index||{};

function text(v){const s=String(v??'').trim();return s&&s.toUpperCase()!=='NULL'?s:null}
function passenger(v){return /승용/.test(String(v||''))}
function powertrainEvidence(record){
  const s=`${record.model||''}`.normalize('NFKC').toUpperCase();
  const cc=Number(record.displacement_cc);
  const range=Number(record.range_km);
  if(/수소|FCEV|HYDROGEN/.test(s))return{kind:'hydrogen',source:'explicit_model_token',confidence:'high'};
  if(/PHEV|PLUG[- ]?IN|플러그인/.test(s))return{kind:'phev',source:'explicit_model_token',confidence:'high'};
  if(/하이브리드|HYBRID|\bHEV\b/.test(s))return{kind:'hybrid',source:'explicit_model_token',confidence:'high'};
  if(/일렉트릭|ELECTRIC|\bBEV\b|\bEV(?=\d|\b)/.test(s))return{kind:'electric',source:'explicit_model_token',confidence:'high'};
  if(/LPG|LPI|엘피지/.test(s))return{kind:'lpg',source:'explicit_model_token',confidence:'high'};
  if(/경유|디젤|DIESEL|\bTDI\b|\bCRDI\b|\bD[- ]?CI\b|BLUEHDI|\bHDI\b|\bCDI\b/.test(s))return{kind:'diesel',source:'explicit_model_token',confidence:'high'};
  if(/휘발유|가솔린|GASOLINE|PETROL|T-?GDI|\bGDI\b|\bMPI\b|\bTSI\b|\bTFSI\b|ECOBOOST/.test(s))return{kind:'gasoline',source:'explicit_model_token',confidence:'high'};
  if(Number.isFinite(range)&&range>0&&cc===0)return{kind:'electric',source:'official_range_plus_zero_cc',confidence:'high'};
  if(Number.isFinite(range)&&range>0&&Number.isFinite(cc)&&cc>0)return{kind:'phev',source:'official_range_plus_combustion_cc',confidence:'medium'};
  return{kind:'unknown',source:'insufficient_evidence',confidence:'low'};
}
function energyReady(p,r){return ['gasoline','diesel','lpg','hybrid','electric'].includes(p)&&Number(r.combined_efficiency)>0}
function taxReady(p,r){
  if(!passenger(r.vehicle_class))return false;
  if(p==='electric')return true;
  // 비영업용 승용의 배기량 기반 자동차세는 연료 종류를 먼저 알아야 하는 계산이 아니다.
  // 따라서 공식 배기량이 있으면 powertrain=unknown이어도 세금 계산은 허용한다.
  return Number(r.displacement_cc)>0;
}
function fuelPriceKey(p){if(p==='gasoline'||p==='hybrid')return'gasoline';if(p==='diesel')return'diesel';if(p==='lpg')return'lpg';return null}
function energyReason(p,r){if(Number(r.combined_efficiency)<=0||r.combined_efficiency==null)return'복합 연비·전비가 없어 에너지비 계산 불가';if(p==='electric')return null;if(['gasoline','diesel','lpg','hybrid'].includes(p))return null;if(p==='phev')return'PHEV는 전기·연료 사용 비중이 필요해 자동 에너지비 계산 제외';if(p==='hydrogen')return'수소 가격·연비 계산 방식을 별도로 검증해야 해 자동 계산 제외';return'연료 유형을 안정적으로 분류할 수 없어 자동 에너지비 계산 제외'}
function taxReason(p,r){if(!passenger(r.vehicle_class))return r.vehicle_class?`차종 '${r.vehicle_class}'은 비영업용 승용 자동차세 자동 계산 대상에서 제외`:'차종 분류가 없어 승용 자동차세 여부 확인 필요';if(p==='electric')return null;if(Number(r.displacement_cc)>0)return null;if(p==='hydrogen')return'수소차 자동차세 적용 방식을 별도 검증해야 해 자동 계산 제외';return'배기량 정보가 없어 자동차세 계산 불가'}

const rows=[];const familyMap=new Map();
for(const g of catalog.groups||[]){
  if(g.source_status!=='active')continue;
  const gi=index[g.catalog_id]||{};
  for(const [i,r] of (g.records||[]).entries()){
    const evidence=powertrainEvidence(r),pt=evidence.kind,eReady=energyReady(pt,r),tReady=taxReady(pt,r),full=eReady&&tReady,calcId=r.record_id||`${g.catalog_id}:${i}`;
    const row={
      calc_id:calcId,catalog_id:g.catalog_id,family_id:gi.family_id||null,generation_id:gi.generation_id||null,
      maker:gi.maker||g.maker||r.maker||'제조사 미표기',family_name:gi.family_name||g.model,generation_label:gi.generation_label||'세대 미분류',raw_model:r.model||g.model,
      vehicle_class:text(r.vehicle_class),type:text(r.type),powertrain:pt,powertrain_source:evidence.source,powertrain_confidence:evidence.confidence,
      displacement_cc:r.displacement_cc??null,combined_efficiency:r.combined_efficiency??null,city_efficiency:r.city_efficiency??null,highway_efficiency:r.highway_efficiency??null,range_km:r.range_km??null,efficiency_grade:r.efficiency_grade??null,
      energy_cost_ready:eReady,tax_ready:tReady,full_cost_ready:full,fuel_price_key:fuelPriceKey(pt),energy_unavailable_reason:energyReason(pt,r),tax_unavailable_reason:taxReason(pt,r),
      normalization_status:gi.normalization_status||'raw_only',normalization_confidence:gi.confidence??0,reviewed_detail_path:g.reviewed_detail_path||null
    };
    rows.push(row);
    const fk=row.family_id||`raw:${g.catalog_id}`;
    if(!familyMap.has(fk))familyMap.set(fk,{family_id:row.family_id,fallback_catalog_id:g.catalog_id,maker:row.maker,family_name:row.family_name,generation_labels:new Set(),record_count:0,energy_ready_count:0,tax_ready_count:0,full_ready_count:0,powertrains:new Set(),normalization_status:row.normalization_status,reviewed_detail_path:row.reviewed_detail_path});
    const f=familyMap.get(fk);f.record_count++;if(eReady)f.energy_ready_count++;if(tReady)f.tax_ready_count++;if(full)f.full_ready_count++;f.generation_labels.add(row.generation_label);f.powertrains.add(pt);if(row.reviewed_detail_path)f.reviewed_detail_path=row.reviewed_detail_path;
  }
}
const families=[...familyMap.values()].map(f=>({...f,generation_labels:[...f.generation_labels],powertrains:[...f.powertrains]})).sort((a,b)=>String(a.maker).localeCompare(String(b.maker),'ko')||String(a.family_name).localeCompare(String(b.family_name),'ko'));
const counts={
  rows:rows.length,
  energy_ready:rows.filter(r=>r.energy_cost_ready).length,
  tax_ready:rows.filter(r=>r.tax_ready).length,
  full_ready:rows.filter(r=>r.full_cost_ready).length,
  electric:rows.filter(r=>r.powertrain==='electric').length,
  inferred_electric:rows.filter(r=>r.powertrain==='electric'&&r.powertrain_source==='official_range_plus_zero_cc').length,
  tax_ready_unknown_powertrain:rows.filter(r=>r.tax_ready&&r.powertrain==='unknown').length,
  passenger:rows.filter(r=>passenger(r.vehicle_class)).length
};
const output={schema_version:2,generated_at:generatedAt,source_generated_at:catalog.generated_at||null,tax:{year:Number(manifest.default_assumptions.tax_year),usage:manifest.default_assumptions.usage,rule:manifest.default_assumptions.tax_rule,effective_date:manifest.default_assumptions.tax_rule_effective_date,source:manifest.default_assumptions.tax_rule_source},fuel_price:{source:fuel.source,source_url:fuel.source_url,price_as_of:fuel.price_as_of,stale:Boolean(fuel.stale),prices:fuel.prices},policy:'All official rows remain selectable. Passenger-car tax can be computed from official displacement even when fuel type is not yet classified. Electric tax is enabled only with explicit EV evidence or official one-charge range plus zero displacement. Energy cost remains stricter: gasoline, diesel, LPG, conventional hybrid, or electric identity plus usable combined efficiency is required. PHEV, hydrogen, and unknown-fuel energy costs never receive fabricated values.',counts,families,rows};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(statusPath,JSON.stringify({ok:true,generated_at:generatedAt,...counts,families:families.length},null,2)+'\n');
console.log(`All-car calc index: ${rows.length} rows / energy ${counts.energy_ready} / tax ${counts.tax_ready} / full ${counts.full_ready} / EV ${counts.electric} / ${families.length} families`);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-catalog.json'),'utf8'));
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data','vehicles','manifest.json'),'utf8'));
const fuel=JSON.parse(fs.readFileSync(path.join(root,'data','fuel-price.json'),'utf8'));
const outPath=path.join(root,'data','generated','all-car-calc-index.json');
const statusPath=path.join(root,'data','generated','all-car-calc-status.json');
const bootstrapPath=path.join(root,'data','generated','all-car-calc-bootstrap.json');
const shardDir=path.join(root,'data','generated','all-car-calc-shards');
const generatedAt=new Date().toISOString();
const index=hierarchy.group_index||{};

function text(v){const s=String(v??'').trim();return s&&s.toUpperCase()!=='NULL'?s:null}
function passenger(v){return /승용/.test(String(v||''))}
function normalizedModel(value){return String(value??'').normalize('NFKC').toUpperCase().replace(/[^0-9A-Z가-힣]+/g,'')}
function recordText(record){return `${record.model||''} ${record.type||''}`.normalize('NFKC').toUpperCase()}
function explicitPhev(textValue){return /PHEV|PLUG[- ]?IN|플러그인|전기\s*\+\s*휘발유|(?:^|[^A-Z0-9가-힣])E[- ]?하이브리드|\bTFSI\s*E\b/.test(textValue)}
function explicitElectric(textValue){return /(?:^|\s)전기(?:$|\s)|일렉트릭|ELECTRIC|\bBEV\b|\bEV(?=\d|\b)/.test(textValue)}
function powertrainEvidence(record,familyId,profile){
  const s=recordText(record);
  const cc=Number(record.displacement_cc);
  const range=Number(record.range_km);
  const unit=text(record.efficiency_unit);
  // 넥쏘의 화면용 신고 행에는 모델명에 '수소'가 없지만 같은 공식 차종의
  // API 행에는 FCEV가 명시돼 있다. 검증된 차종 매핑을 모든 넥쏘 행에 공유한다.
  if(familyId==='hyundai-nexo')return{kind:'hydrogen',source:'reviewed_family_mapping',confidence:'high'};
  if(/수소|FCEV|HYDROGEN/.test(s))return{kind:'hydrogen',source:'explicit_model_token',confidence:'high'};
  if(explicitPhev(s))return{kind:'phev',source:'explicit_model_or_type_token',confidence:'high'};
  // PHEV 공시는 전기 전비 행과 휘발유 연비 행이 나뉘기도 한다. 모델명·주행거리·
  // 배기량을 함께 보고 두 행 모두 PHEV로 묶어 어느 한쪽도 단독 연료비로 계산하지 않는다.
  if(/(?:^|[^A-Z0-9])E[- ]?하이브리드|\bTFSI\s*E\b/.test(s))return{kind:'phev',source:'explicit_manufacturer_phev_token',confidence:'high'};
  if(unit==='km/kWh'&&/하이브리드|HYBRID/.test(s))return{kind:'phev',source:'official_electric_efficiency_plus_hybrid_token',confidence:'high'};
  if(Number.isFinite(range)&&range>0&&Number.isFinite(cc)&&cc>0)return{kind:'phev',source:'official_range_plus_combustion_cc',confidence:'medium'};
  if(/하이브리드|HYBRID|\bHEV\b/.test(s))return{kind:'hybrid',source:'explicit_model_token',confidence:'high'};
  if(explicitElectric(s))return{kind:'electric',source:'explicit_model_or_type_token',confidence:'high'};
  if(/LPG|LPI|엘피지/.test(s))return{kind:'lpg',source:'explicit_model_token',confidence:'high'};
  if(/경유|디젤|DIESEL|\bTDI\b|\bCRDI\b|\bD[- ]?CI\b|BLUEHDI|\bHDI\b|\bCDI\b/.test(s))return{kind:'diesel',source:'explicit_model_token',confidence:'high'};
  if(/휘발유|가솔린|GASOLINE|PETROL|T-?GDI|GDI|CVVL|MPI|\bTSI\b|\bTFSI\b|ECOBOOST/.test(s))return{kind:'gasoline',source:'explicit_model_or_type_token',confidence:'high'};
  // KEA sometimes publishes the electric-efficiency half of a PHEV as a generic
  // passenger/SUV row with no displacement. A sibling row in the same family or
  // exact model carries the combustion/PHEV evidence. Do not turn that half-row
  // into a battery EV with 130,000 won tax and a fabricated full-electric cost.
  if(unit==='km/kWh'&&Number.isFinite(range)&&range>0&&profile?.phevEvidence)return{kind:'phev',source:'official_family_or_model_phev_evidence',confidence:'high'};
  // A short-range electric-efficiency row without an explicit EV type is not
  // sufficient evidence of a battery EV. In the current KEA feed these are PHEV
  // electric-mode rows (performance cars included); cost stays excluded.
  if(unit==='km/kWh'&&Number.isFinite(range)&&range>0&&range<=150&&!explicitElectric(s))return{kind:'phev',source:'official_short_range_electric_mode_without_bev_evidence',confidence:'medium'};
  if(Number.isFinite(range)&&range>0&&cc===0)return{kind:'electric',source:'official_range_plus_zero_cc',confidence:'high'};
  return{kind:'unknown',source:'insufficient_evidence',confidence:'low'};
}
function expectedEfficiencyUnit(p){if(p==='electric')return'km/kWh';if(['gasoline','diesel','lpg','hybrid'].includes(p))return'km/L';return null}
function energyReady(p,r){const expected=expectedEfficiencyUnit(p);return Boolean(expected)&&text(r.efficiency_unit)===expected&&Number(r.combined_efficiency)>0}
function taxReady(p,r){
  if(!passenger(r.vehicle_class))return false;
  if(p==='electric'||p==='hydrogen')return true;
  // 비영업용 승용의 배기량 기반 자동차세는 연료 종류를 먼저 알아야 하는 계산이 아니다.
  // 따라서 공식 배기량이 있으면 powertrain=unknown이어도 세금 계산은 허용한다.
  return Number(r.displacement_cc)>0;
}
function fuelPriceKey(p){if(p==='gasoline'||p==='hybrid')return'gasoline';if(p==='diesel')return'diesel';if(p==='lpg')return'lpg';return null}
function energyReason(p,r){if(Number(r.combined_efficiency)<=0||r.combined_efficiency==null)return'복합 연비·전비가 없어 에너지비 계산 불가';if(p==='phev')return'PHEV는 전기·연료 사용 비중이 필요해 자동 에너지비 계산 제외';if(p==='hydrogen')return'수소 가격·연비 계산 방식을 별도로 검증해야 해 자동 계산 제외';const expected=expectedEfficiencyUnit(p),unit=text(r.efficiency_unit);if(expected&&unit!==expected)return`공식 효율 단위 ${unit||'미확인'}와 동력 유형이 맞지 않아 자동 에너지비 계산 제외`;if(expected)return null;return'연료 유형을 안정적으로 분류할 수 없어 자동 에너지비 계산 제외'}
function taxReason(p,r){if(!passenger(r.vehicle_class))return r.vehicle_class?`차종 '${r.vehicle_class}'은 비영업용 승용 자동차세 자동 계산 대상에서 제외`:'차종 분류가 없어 승용 자동차세 여부 확인 필요';if(p==='electric'||p==='hydrogen')return null;if(Number(r.displacement_cc)>0)return null;return'배기량 정보가 없어 자동차세 계산 불가'}

const sourceRows=[];
for(const g of catalog.groups||[]){
  if(g.source_status!=='active')continue;
  const gi=index[g.catalog_id]||{};
  for(const [i,r] of (g.records||[]).entries())sourceRows.push({g,gi,i,r,familyId:gi.family_id||null});
}
const profileMap=new Map();
const addProfile=(key,entry)=>{
  if(!key)return;
  if(!profileMap.has(key))profileMap.set(key,{phevEvidence:false,combustionCcs:new Set()});
  const p=profileMap.get(key),s=recordText(entry.r),cc=Number(entry.r.displacement_cc),range=Number(entry.r.range_km);
  if(explicitPhev(s)||(Number.isFinite(range)&&range>0&&Number.isFinite(cc)&&cc>0))p.phevEvidence=true;
  if(Number.isFinite(cc)&&cc>0)p.combustionCcs.add(cc);
};
for(const entry of sourceRows){
  const maker=entry.gi.maker||entry.g.maker||entry.r.maker||'';
  addProfile(`model:${String(maker).normalize('NFKC').toUpperCase()}|${normalizedModel(entry.r.model)}`,entry);
  addProfile(entry.familyId?`family:${entry.familyId}`:null,entry);
}
const combinedProfile=entry=>{
  const maker=entry.gi.maker||entry.g.maker||entry.r.maker||'',model=profileMap.get(`model:${String(maker).normalize('NFKC').toUpperCase()}|${normalizedModel(entry.r.model)}`),family=entry.familyId?profileMap.get(`family:${entry.familyId}`):null;
  const ccs=new Set([...(model?.combustionCcs||[]),...(family?.combustionCcs||[])]);
  return{phevEvidence:Boolean(model?.phevEvidence||family?.phevEvidence),modelCcs:[...(model?.combustionCcs||[])],familyCcs:[...(family?.combustionCcs||[])],allCcs:[...ccs]};
};
const rows=[];const familyMap=new Map();
for(const {g,gi,i,r,familyId} of sourceRows){
    const profile=combinedProfile({g,gi,r,familyId}),evidence=powertrainEvidence(r,familyId,profile),pt=evidence.kind;
    const originalCc=Number(r.displacement_cc),inferredCcs=profile.modelCcs.length===1?profile.modelCcs:profile.familyCcs.length===1?profile.familyCcs:[];
    const effectiveCc=Number.isFinite(originalCc)&&originalCc>0?originalCc:pt==='phev'&&inferredCcs.length===1?inferredCcs[0]:r.displacement_cc??null;
    const effectiveRecord={...r,displacement_cc:effectiveCc},eReady=energyReady(pt,effectiveRecord),tReady=taxReady(pt,effectiveRecord),full=eReady&&tReady,calcId=r.record_id||`${g.catalog_id}:${i}`;
    const row={
      calc_id:calcId,catalog_id:g.catalog_id,family_id:familyId,generation_id:gi.generation_id||null,
      maker:gi.maker||g.maker||r.maker||'제조사 미표기',family_name:gi.family_name||g.model,generation_label:gi.generation_label||'세대 미분류',raw_model:r.model||g.model,
      vehicle_class:text(r.vehicle_class),type:text(r.type),powertrain:pt,powertrain_source:evidence.source,powertrain_confidence:evidence.confidence,
      displacement_cc:effectiveCc,displacement_source:Number.isFinite(originalCc)&&originalCc>0?'official_row':effectiveCc!=null&&effectiveCc!==r.displacement_cc?'exact_model_or_family_phev_sibling':'unavailable',combined_efficiency:r.combined_efficiency??null,city_efficiency:r.city_efficiency??null,highway_efficiency:r.highway_efficiency??null,range_km:r.range_km??null,efficiency_grade:r.efficiency_grade??null,efficiency_unit:r.efficiency_unit??null,
      energy_cost_ready:eReady,tax_ready:tReady,full_cost_ready:full,fuel_price_key:eReady?fuelPriceKey(pt):null,energy_unavailable_reason:energyReason(pt,effectiveRecord),tax_unavailable_reason:taxReason(pt,effectiveRecord),
      normalization_status:gi.normalization_status||'raw_only',normalization_confidence:gi.confidence??0,reviewed_detail_path:g.reviewed_detail_path||null
    };
    rows.push(row);
    const fk=row.family_id||`raw:${g.catalog_id}`;
    if(!familyMap.has(fk))familyMap.set(fk,{family_id:row.family_id,fallback_catalog_id:g.catalog_id,maker:row.maker,family_name:row.family_name,generation_labels:new Set(),record_count:0,energy_ready_count:0,tax_ready_count:0,full_ready_count:0,powertrains:new Set(),normalization_status:row.normalization_status,reviewed_detail_path:row.reviewed_detail_path});
    const f=familyMap.get(fk);f.record_count++;if(eReady)f.energy_ready_count++;if(tReady)f.tax_ready_count++;if(full)f.full_ready_count++;f.generation_labels.add(row.generation_label);f.powertrains.add(pt);if(row.reviewed_detail_path)f.reviewed_detail_path=row.reviewed_detail_path;
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
const output={schema_version:2,generated_at:generatedAt,source_generated_at:catalog.generated_at||null,tax:{year:Number(manifest.default_assumptions.tax_year),usage:manifest.default_assumptions.usage,rule:manifest.default_assumptions.tax_rule,effective_date:manifest.default_assumptions.tax_rule_effective_date,source:manifest.default_assumptions.tax_rule_source},fuel_price:{source:fuel.source,source_url:fuel.source_url,price_as_of:fuel.price_as_of,stale:Boolean(fuel.stale),prices:fuel.prices},policy:'All official rows remain selectable. Passenger-car tax can be computed from official displacement even when fuel type is not yet classified. Electric and hydrogen passenger cars use the fixed passenger-car tax. Energy cost remains stricter: gasoline, diesel, LPG, conventional hybrid, or electric identity plus usable combined efficiency is required. PHEV, hydrogen, and unknown-fuel energy costs never receive fabricated values.',counts,families,rows};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
const familyKey=f=>f.family_id||`raw:${f.fallback_catalog_id}`;
const rowFamilyKey=r=>r.family_id||`raw:${r.catalog_id}`;
const shardName=key=>createHash('sha256').update(key).digest('hex').slice(0,2);
const familyShards=Object.fromEntries(families.map(f=>[familyKey(f),shardName(familyKey(f))]));
const calcFamilies=Object.fromEntries(rows.map(r=>[r.calc_id,rowFamilyKey(r)]));
const preferred=['gasoline','diesel','lpg','hybrid','electric'];
const representatives=families.map(f=>{
  const candidates=rows.filter(r=>rowFamilyKey(r)===familyKey(f));
  return candidates.filter(r=>r.full_cost_ready).sort((a,b)=>preferred.indexOf(a.powertrain)-preferred.indexOf(b.powertrain)||Number(b.combined_efficiency||0)-Number(a.combined_efficiency||0))[0]
    ||candidates.find(r=>r.energy_cost_ready||r.tax_ready)||candidates[0];
}).filter(Boolean).map(({calc_id,catalog_id,family_id,raw_model,powertrain,displacement_cc,combined_efficiency,range_km,energy_cost_ready,tax_ready,full_cost_ready,fuel_price_key})=>({calc_id,catalog_id,family_id,raw_model,powertrain,displacement_cc,combined_efficiency,range_km,energy_cost_ready,tax_ready,full_cost_ready,fuel_price_key}));
const benchmarkGroups=new Map();
for(const {powertrain,vehicle_class,combined_efficiency,displacement_cc} of rows.filter(r=>r.full_cost_ready)){
  const key=JSON.stringify([powertrain,vehicle_class,combined_efficiency,displacement_cc]);
  if(!benchmarkGroups.has(key))benchmarkGroups.set(key,{powertrain,vehicle_class,combined_efficiency,displacement_cc,count:0});
  benchmarkGroups.get(key).count++;
}
const benchmarkRows=[...benchmarkGroups.values()];
const bootstrap={schema_version:3,generated_at:generatedAt,source_generated_at:output.source_generated_at,tax:output.tax,fuel_price:output.fuel_price,policy:output.policy,counts,families,rows:representatives,benchmark_rows:benchmarkRows,family_shards:familyShards,calc_families:calcFamilies};
fs.mkdirSync(shardDir,{recursive:true});
for(const file of fs.readdirSync(shardDir))if(file.endsWith('.json'))fs.unlinkSync(path.join(shardDir,file));
const shardRows=new Map();
for(const row of rows){const shard=familyShards[rowFamilyKey(row)];if(!shardRows.has(shard))shardRows.set(shard,[]);shardRows.get(shard).push(row)}
for(const [shard,items] of shardRows)fs.writeFileSync(path.join(shardDir,`${shard}.json`),JSON.stringify({schema_version:3,generated_at:generatedAt,rows:items})+'\n');
fs.writeFileSync(bootstrapPath,JSON.stringify(bootstrap)+'\n');
fs.writeFileSync(statusPath,JSON.stringify({ok:true,generated_at:generatedAt,...counts,families:families.length},null,2)+'\n');
console.log(`All-car calc index: ${rows.length} rows / energy ${counts.energy_ready} / tax ${counts.tax_ready} / full ${counts.full_ready} / EV ${counts.electric} / ${families.length} families / ${shardRows.size} browser shards`);

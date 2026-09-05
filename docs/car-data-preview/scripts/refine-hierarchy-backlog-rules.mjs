import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchyPath=path.join(root,'data','generated','service-hierarchy.json');
const catalogPath=path.join(root,'data','generated','all-car-catalog.json');
const h=JSON.parse(fs.readFileSync(hierarchyPath,'utf8'));
const c=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const key=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g,'');
const stable=(p,v)=>`${p}-${crypto.createHash('sha1').update(v).digest('hex').slice(0,16)}`;
const uniq=a=>[...new Set(a.filter(Boolean))];
const sortKo=(a,b)=>String(a??'').localeCompare(String(b??''),'ko',{numeric:true,sensitivity:'base'});

const RULES=[
  {maker:/^기아$/i,name:'K3',re:/^K3(?:\s|$)/i},
  {maker:/^기아$/i,name:'K7',re:/^K7(?:\s|$)/i},
  {maker:/^Mercedes-Benz$/i,name:'EQA',re:/MERCEDES[- ]?BENZ\s*EQA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQB',re:/MERCEDES[- ]?BENZ\s*EQB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQE',re:/MERCEDES[- ]?BENZ\s*EQE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'EQS',re:/MERCEDES[- ]?BENZ\s*EQS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLA',re:/MERCEDES[- ]?BENZ\s*GLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLB',re:/MERCEDES[- ]?BENZ\s*GLB\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLC',re:/MERCEDES[- ]?BENZ\s*GLC\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLE',re:/MERCEDES[- ]?BENZ\s*GLE\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'GLS',re:/MERCEDES[- ]?BENZ\s*GLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLA',re:/MERCEDES[- ]?BENZ\s*CLA\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLS',re:/MERCEDES[- ]?BENZ\s*CLS\s*\d*/i},
  {maker:/^Mercedes-Benz$/i,name:'CLE',re:/MERCEDES[- ]?BENZ\s*CLE\s*\d*/i},
  {maker:/^Porsche$/i,name:'718',re:/^(?:포르쉐\s*)?(?:박스터|카이맨)(?:\s|$)/i},
  {maker:/^Nissan$/i,name:'Maxima',re:/^(?:NISSAN\s*)?MAXIMA(?:\s|$)/i},
  {maker:/^Mitsubishi$/i,name:'L200',re:/^L200(?:\s|$)/i},
  {maker:/^Maserati$/i,name:'GranCabrio',re:/그란카브리오|GRAN\s*CABRIO/i},
  {maker:/^(?:Chrysler|크라이슬러)$/i,name:'200',re:/^200(?:\s|$)/i}
];

function classify(r){
  const s=String(r.model||'').toUpperCase(),cc=Number(r.displacement_cc),range=Number(r.range_km);
  if(/수소|FCEV|HYDROGEN/.test(s))return'hydrogen';
  if(/PHEV|PLUG[- ]?IN|플러그인/.test(s))return'phev';
  if(/하이브리드|HYBRID|\bHEV\b/.test(s))return'hybrid';
  if(/일렉트릭|ELECTRIC|\bBEV\b|\bEV(?=\d|\b)/.test(s))return'electric';
  if(/LPG|LPI|엘피지/.test(s))return'lpg';
  if(/경유|디젤|DIESEL|\bTDI\b|\bCRDI\b|\bD[- ]?CI\b|BLUEHDI|\bHDI\b|\bCDI\b/.test(s))return'diesel';
  if(/휘발유|가솔린|GASOLINE|PETROL|T-?GDI|\bGDI\b|\bMPI\b|\bTSI\b|\bTFSI\b|ECOBOOST/.test(s))return'gasoline';
  if(Number.isFinite(range)&&range>0&&cc===0)return'electric';
  if(Number.isFinite(range)&&range>0&&Number.isFinite(cc)&&cc>0)return'phev';
  return'unknown';
}
function calcReady(r,p){
  if(!/승용/.test(String(r.vehicle_class||'')))return false;
  if(p==='electric')return Number(r.combined_efficiency)>0;
  return Number(r.displacement_cc)>0&&Number(r.combined_efficiency)>0;
}

const groups=new Map((c.groups||[]).map(g=>[g.catalog_id,g]));
const sourceFamilyById=new Map((h.families||[]).map(f=>[f.family_id,f]));
const updatedIndex={};let changed=0;
for(const [id,gi0] of Object.entries(h.group_index||{})){
  const g=groups.get(id);if(!g){updatedIndex[id]=gi0;continue}
  let gi={...gi0};
  if(gi.normalization_status!=='reviewed_override'){
    const rule=RULES.find(r=>r.maker.test(String(gi.maker||''))&&r.re.test(String(g.model||'')));
    if(rule){
      const makerId=gi.maker_id||key(gi.maker),familyId=stable('family',`${makerId}|${key(rule.name)}`);
      if(gi.family_id!==familyId||gi.family_name!==rule.name||gi.normalization_status!=='auto_high')changed++;
      gi={...gi,family_id:familyId,family_name:rule.name,normalization_status:'auto_high',confidence:Math.max(.96,Number(gi.confidence)||0),generation_id:stable('gen',`${familyId}|${key(gi.generation_label)||'unspecified'}`)};
    }
  }
  updatedIndex[id]=gi;
}

const buckets=new Map();
for(const [id,gi] of Object.entries(updatedIndex)){
  const g=groups.get(id);if(!g)continue;
  const old=sourceFamilyById.get((h.group_index||{})[id]?.family_id);
  if(!buckets.has(gi.family_id))buckets.set(gi.family_id,{family_id:gi.family_id,maker_id:gi.maker_id,maker:gi.maker,family_name:gi.family_name,category:gi.normalization_status==='reviewed_override'?old?.category||null:null,normalization_status:gi.normalization_status,confidence:gi.confidence,reviewed_family_id:gi.normalization_status==='reviewed_override'?old?.reviewed_family_id||null:null,source_status:'active',raw_group_ids:[],raw_models:[],raw_makers:[],gen:new Map(),pt:new Map(),record_count:0,active_record_count:0,archived_record_count:0,calculator_ready_record_count:0,reviewed_detail_paths:new Set()});
  const f=buckets.get(gi.family_id);f.raw_group_ids.push(id);f.raw_models.push(g.model);f.raw_makers.push(...(g.source_makers||[]),g.maker);if(g.reviewed_detail_path)f.reviewed_detail_paths.add(g.reviewed_detail_path);if(g.source_status!=='active')f.source_status=f.source_status==='active'?'mixed':g.source_status;
  const gl=gi.generation_label||'세대 미분류',gk=`${gi.family_id}|${key(gl)||'unspecified'}`;
  if(!f.gen.has(gk))f.gen.set(gk,{generation_id:stable('gen',gk),family_id:gi.family_id,generation_label:gl,generation_code:gl==='세대 미분류'?null:gl,normalization_source:gl==='세대 미분류'?'unspecified':'source_or_reviewed',confidence:gi.confidence,raw_group_ids:[],raw_models:[],record_count:0,active_record_count:0,calculator_ready_record_count:0,pt:new Map()});
  const ge=f.gen.get(gk);ge.raw_group_ids.push(id);ge.raw_models.push(g.model);
  for(const r of g.records||[]){const p=classify(r);f.pt.set(p,(f.pt.get(p)||0)+1);ge.pt.set(p,(ge.pt.get(p)||0)+1);f.record_count++;ge.record_count++;if(g.source_status==='active'){f.active_record_count++;ge.active_record_count++}else f.archived_record_count++;if(calcReady(r,p)){f.calculator_ready_record_count++;ge.calculator_ready_record_count++}}
}
const families=[...buckets.values()].map(f=>({family_id:f.family_id,maker_id:f.maker_id,maker:f.maker,family_name:f.family_name,category:f.category,normalization_status:f.normalization_status,confidence:f.confidence,reviewed_family_id:f.reviewed_family_id,source_status:f.source_status,raw_group_count:f.raw_group_ids.length,raw_group_ids:uniq(f.raw_group_ids),raw_models:uniq(f.raw_models).sort(sortKo).slice(0,80),raw_makers:uniq(f.raw_makers).sort(sortKo),generation_count:f.gen.size,generations:[...f.gen.values()].map(g=>({generation_id:g.generation_id,family_id:g.family_id,generation_label:g.generation_label,generation_code:g.generation_code,normalization_source:g.normalization_source,confidence:g.confidence,raw_group_count:g.raw_group_ids.length,raw_group_ids:uniq(g.raw_group_ids),raw_models:uniq(g.raw_models).sort(sortKo).slice(0,80),record_count:g.record_count,active_record_count:g.active_record_count,calculator_ready_record_count:g.calculator_ready_record_count,powertrains:[...g.pt.entries()].map(([powertrain,count])=>({powertrain,count})).sort((a,b)=>b.count-a.count)})).sort((a,b)=>(a.generation_label==='세대 미분류')-(b.generation_label==='세대 미분류')||sortKo(a.generation_label,b.generation_label)),powertrains:[...f.pt.entries()].map(([powertrain,count])=>({powertrain,count})).sort((a,b)=>b.count-a.count),record_count:f.record_count,active_record_count:f.active_record_count,archived_record_count:f.archived_record_count,calculator_ready_record_count:f.calculator_ready_record_count,reviewed_detail_paths:[...f.reviewed_detail_paths]})).sort((a,b)=>sortKo(a.maker,b.maker)||sortKo(a.family_name,b.family_name));
const makerMap=new Map();for(const f of families){if(!makerMap.has(f.maker_id))makerMap.set(f.maker_id,{maker_id:f.maker_id,maker:f.maker,family_ids:[],active_family_count:0,active_record_count:0});const m=makerMap.get(f.maker_id);m.family_ids.push(f.family_id);if(f.active_record_count>0)m.active_family_count++;m.active_record_count+=f.active_record_count}
const makers=[...makerMap.values()].map(m=>({...m,family_count:m.family_ids.length})).sort((a,b)=>b.active_record_count-a.active_record_count||sortKo(a.maker,b.maker));
const active=families.filter(f=>f.active_record_count>0);
h.hierarchy_version=Math.max(3,Number(h.hierarchy_version)||0);h.generated_at=new Date().toISOString();h.active_maker_count=makers.filter(m=>m.active_record_count>0).length;h.active_family_count=active.length;h.active_generation_count=active.reduce((n,f)=>n+f.generations.filter(g=>g.active_record_count>0).length,0);h.calculator_ready_record_count=active.reduce((n,f)=>n+f.calculator_ready_record_count,0);h.normalization={reviewed_families:active.filter(f=>f.normalization_status==='reviewed_override').length,auto_high_families:active.filter(f=>f.normalization_status==='auto_high').length,auto_medium_families:active.filter(f=>f.normalization_status==='auto_medium').length,raw_only_families:active.filter(f=>f.normalization_status==='raw_only').length,reviewed_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='reviewed_override').length,auto_high_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='auto_high').length,auto_medium_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='auto_medium').length,raw_only_groups:Object.values(updatedIndex).filter(g=>g.source_status==='active'&&g.normalization_status==='raw_only').length};h.policy+=' Backlog refinement applies only explicit maker/model aliases; source records and catalog IDs are unchanged.';h.makers=makers;h.families=families;h.group_index=updatedIndex;
fs.writeFileSync(hierarchyPath,JSON.stringify(h,null,2)+'\n');
console.log(`Hierarchy backlog refinement: ${changed} raw groups relabeled / ${h.active_family_count} families / raw-only ${h.normalization.raw_only_families}`);

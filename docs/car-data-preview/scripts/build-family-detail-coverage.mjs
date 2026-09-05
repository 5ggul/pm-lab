import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const calc=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-calc-index.json'),'utf8'));
const manufacturerPath=path.join(root,'data','generated','manufacturer-specs.json');
const manufacturer=fs.existsSync(manufacturerPath)?JSON.parse(fs.readFileSync(manufacturerPath,'utf8')):{records:[]};
const statusPath=path.join(root,'data','generated','family-detail-coverage-status.json');
const indexPath=path.join(root,'data','generated','family-detail-index.json');

const rowsByFamily=new Map();
for(const row of calc.rows||[]){
  if(!row.family_id)continue;
  if(!rowsByFamily.has(row.family_id))rowsByFamily.set(row.family_id,[]);
  rowsByFamily.get(row.family_id).push(row);
}
const manufacturerByFamily=new Map((manufacturer.records||[]).map(r=>[r.family_id,r]));
const finite=(rows,key,positive=false)=>rows.map(r=>Number(r[key])).filter(n=>Number.isFinite(n)&&(!positive||n>0));
const minmax=values=>values.length?{min:Math.min(...values),max:Math.max(...values)}:null;
const uniq=values=>[...new Set(values.filter(v=>v!=null&&String(v).trim()!==''))];
function summarizePowertrains(rows){
  const map=new Map();
  for(const row of rows){const key=row.powertrain||'unknown';if(!map.has(key))map.set(key,[]);map.get(key).push(row)}
  return [...map.entries()].map(([powertrain,items])=>({
    powertrain,
    row_count:items.length,
    displacement_cc:minmax(finite(items,'displacement_cc',true)),
    combined_efficiency:minmax(finite(items,'combined_efficiency',true)),
    city_efficiency:minmax(finite(items,'city_efficiency',true)),
    highway_efficiency:minmax(finite(items,'highway_efficiency',true)),
    range_km:minmax(finite(items,'range_km',true)),
    efficiency_grades:uniq(items.map(r=>r.efficiency_grade)).slice(0,12)
  })).sort((a,b)=>b.row_count-a.row_count||a.powertrain.localeCompare(b.powertrain));
}

const missing=[];let officialDetail=0,manufacturerDetail=0,dimensionDetail=0;
const details=[];
for(const family of hierarchy.families||[]){
  const rows=rowsByFamily.get(family.family_id)||[];
  if(!rows.length){missing.push(family.family_id);continue}
  officialDetail++;
  const m=manufacturerByFamily.get(family.family_id);
  if(m)manufacturerDetail++;
  if(m?.dimensions&&['length_mm','width_mm','height_mm','wheelbase_mm'].every(k=>m.dimensions[k]!=null))dimensionDetail++;
  details.push({
    family_id:family.family_id,
    maker:family.maker,
    family_name:family.family_name,
    category:family.category||null,
    normalization_status:family.normalization_status,
    active_record_count:rows.length,
    raw_group_count:family.raw_group_count||0,
    generation_count:family.generation_count||0,
    raw_model_count:uniq(rows.map(r=>r.raw_model)).length,
    generation_labels:uniq(rows.map(r=>r.generation_label)),
    vehicle_classes:uniq(rows.map(r=>r.vehicle_class)),
    energy_ready_count:rows.filter(r=>r.energy_cost_ready).length,
    tax_ready_count:rows.filter(r=>r.tax_ready).length,
    full_ready_count:rows.filter(r=>r.full_cost_ready).length,
    manufacturer_detail:Boolean(m),
    physical_dimensions:Boolean(m?.dimensions&&['length_mm','width_mm','height_mm','wheelbase_mm'].every(k=>m.dimensions[k]!=null)),
    powertrains:summarizePowertrains(rows)
  });
}
const generatedAt=new Date().toISOString();
const status={
  ok:missing.length===0,
  generated_at:generatedAt,
  families:(hierarchy.families||[]).length,
  official_kea_detail_families:officialDetail,
  manufacturer_detail_families:manufacturerDetail,
  physical_dimension_families:dimensionDetail,
  kea_only_families:officialDetail-manufacturerDetail,
  missing_family_ids:missing,
  policy:'Every active service family has a compact detail record built from official KEA source rows. Manufacturer dimensions, power, torque and battery remain additive reviewed enrichment.'
};
const index={
  schema_version:1,
  generated_at:generatedAt,
  source_calc_generated_at:calc.generated_at||null,
  family_count:details.length,
  policy:status.policy,
  families:details
};
fs.writeFileSync(statusPath,JSON.stringify(status,null,2)+'\n');
fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify(status,null,2));
if(!status.ok)process.exit(1);

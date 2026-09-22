import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const calc=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-calc-index.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-catalog.json'),'utf8'));
const manufacturerPath=path.join(root,'data','generated','manufacturer-specs.json');
const manufacturer=fs.existsSync(manufacturerPath)?JSON.parse(fs.readFileSync(manufacturerPath,'utf8')):{records:[]};
const staticPages=JSON.parse(fs.readFileSync(path.join(root,'data','static-model-pages.json'),'utf8')).records||[];
const staticPathByFamily=new Map(staticPages.map(r=>[r.family_id,r.path]));
const statusPath=path.join(root,'data','generated','family-detail-coverage-status.json');
const indexPath=path.join(root,'data','generated','family-detail-index.json');
const pageBootstrapPath=path.join(root,'data','generated','family-page-bootstrap.json');
const pageShardDir=path.join(root,'data','generated','family-page-shards');

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
  return [...map.entries()].map(([powertrain,items])=>{
    // KEA PHEV rows can omit electric range, and some rows carry it on both
    // electric-efficiency and fuel-efficiency records. Electric efficiency is
    // reported in the low single digits; fuel economy is a separate km/L row.
    const isElectricPhevRow=r=>Number(r.combined_efficiency)>0&&Number(r.combined_efficiency)<7;
    const electricPhev=powertrain==='phev'?items.filter(isElectricPhevRow):[];
    const fuelPhev=powertrain==='phev'?items.filter(r=>Number(r.combined_efficiency)>0&&!isElectricPhevRow(r)):[];
    return {
      powertrain,
      efficiency_unit:uniq(items.map(r=>r.efficiency_unit)).length===1?uniq(items.map(r=>r.efficiency_unit))[0]:null,
      row_count:items.length,
      displacement_cc:minmax(finite(items,'displacement_cc',true)),
      combined_efficiency:minmax(finite(items,'combined_efficiency',true)),
      electric_efficiency:powertrain==='phev'?minmax(finite(electricPhev,'combined_efficiency',true)):null,
      fuel_efficiency:powertrain==='phev'?minmax(finite(fuelPhev,'combined_efficiency',true)):null,
      city_efficiency:minmax(finite(items,'city_efficiency',true)),
      highway_efficiency:minmax(finite(items,'highway_efficiency',true)),
      range_km:minmax(finite(items,'range_km',true)),
      efficiency_grades:uniq(items.map(r=>r.efficiency_grade)).slice(0,12)
    };
  }).sort((a,b)=>b.row_count-a.row_count||a.powertrain.localeCompare(b.powertrain));
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
    static_detail_path:staticPathByFamily.get(family.family_id)||null,
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

// Browser pages only need one family at a time. Keep the complete hierarchy,
// catalogue and calculation index in the build pipeline, then publish a small
// alias manifest plus family-scoped payloads for the public detail route.
const catalogById=new Map((catalog.groups||[]).map(group=>[group.catalog_id,group]));
const detailByFamily=new Map(details.map(detail=>[detail.family_id,detail]));
const shardName=id=>createHash('sha256').update(id).digest('hex').slice(0,2);
const familyShards=Object.fromEntries((hierarchy.families||[]).map(family=>[family.family_id,shardName(family.family_id)]));
const shardRecords=new Map();
for(const family of hierarchy.families||[]){
  const groupIds=[...new Set((family.generations||[]).flatMap(generation=>generation.raw_group_ids||[]))];
  const groups=groupIds.map(groupId=>catalogById.get(groupId)).filter(Boolean);
  const groupIndex=Object.fromEntries(groupIds.filter(groupId=>hierarchy.group_index?.[groupId]).map(groupId=>[groupId,hierarchy.group_index[groupId]]));
  const record={
    family,
    groups,
    group_index:groupIndex,
    calc_rows:rowsByFamily.get(family.family_id)||[],
    manufacturer_spec:manufacturerByFamily.get(family.family_id)||null,
    detail:detailByFamily.get(family.family_id)||null
  };
  const shard=familyShards[family.family_id];
  if(!shardRecords.has(shard))shardRecords.set(shard,[]);
  shardRecords.get(shard).push(record);
}
fs.mkdirSync(pageShardDir,{recursive:true});
for(const file of fs.readdirSync(pageShardDir))if(file.endsWith('.json'))fs.unlinkSync(path.join(pageShardDir,file));
for(const [shard,records] of shardRecords)fs.writeFileSync(path.join(pageShardDir,`${shard}.json`),JSON.stringify({schema_version:1,generated_at:generatedAt,records})+'\n');
fs.writeFileSync(pageBootstrapPath,JSON.stringify({schema_version:1,generated_at:generatedAt,family_count:details.length,family_aliases:hierarchy.family_aliases||{},family_shards:familyShards})+'\n');
console.log(JSON.stringify(status,null,2));
if(!status.ok)process.exit(1);

await import('./build-catalog-list-index.mjs');

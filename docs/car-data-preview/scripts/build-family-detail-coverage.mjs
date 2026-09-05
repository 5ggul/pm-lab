import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const calc=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-calc-index.json'),'utf8'));
const manufacturerPath=path.join(root,'data','generated','manufacturer-specs.json');
const manufacturer=fs.existsSync(manufacturerPath)?JSON.parse(fs.readFileSync(manufacturerPath,'utf8')):{records:[]};
const outPath=path.join(root,'data','generated','family-detail-coverage-status.json');

const rowsByFamily=new Map();
for(const row of calc.rows||[]){
  if(!row.family_id)continue;
  if(!rowsByFamily.has(row.family_id))rowsByFamily.set(row.family_id,[]);
  rowsByFamily.get(row.family_id).push(row);
}
const manufacturerByFamily=new Map((manufacturer.records||[]).map(r=>[r.family_id,r]));
const missing=[];let officialDetail=0,manufacturerDetail=0,dimensionDetail=0;
for(const family of hierarchy.families||[]){
  const rows=rowsByFamily.get(family.family_id)||[];
  if(!rows.length){missing.push(family.family_id);continue}
  officialDetail++;
  const m=manufacturerByFamily.get(family.family_id);
  if(m)manufacturerDetail++;
  if(m?.dimensions&&['length_mm','width_mm','height_mm','wheelbase_mm'].every(k=>m.dimensions[k]!=null))dimensionDetail++;
}
const output={
  ok:missing.length===0,
  generated_at:new Date().toISOString(),
  families:(hierarchy.families||[]).length,
  official_kea_detail_families:officialDetail,
  manufacturer_detail_families:manufacturerDetail,
  physical_dimension_families:dimensionDetail,
  kea_only_families:officialDetail-manufacturerDetail,
  missing_family_ids:missing,
  policy:'Every active service family must have a usable detail view from official KEA source rows. Manufacturer dimensions, power, torque and battery are additive when reviewed official manufacturer sources are available.'
};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
if(!output.ok)process.exit(1);

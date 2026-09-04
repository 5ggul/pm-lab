import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const inPath=path.join(root,'data','generated','service-hierarchy.json');
const outPath=path.join(root,'data','generated','service-hierarchy-summary.json');
const h=JSON.parse(fs.readFileSync(inPath,'utf8'));
const active=(h.families||[]).filter(f=>f.active_record_count>0);
const raw=active.filter(f=>f.normalization_status==='raw_only');
const makerMap=new Map();
for(const f of active){if(!makerMap.has(f.maker))makerMap.set(f.maker,{maker:f.maker,families:0,records:0,raw_only_families:0,raw_only_records:0,calc_ready_records:0});const m=makerMap.get(f.maker);m.families++;m.records+=f.active_record_count;m.calc_ready_records+=f.calculator_ready_record_count||0;if(f.normalization_status==='raw_only'){m.raw_only_families++;m.raw_only_records+=f.active_record_count}}
const powertrainMap=new Map();for(const f of active)for(const p of f.powertrains||[])powertrainMap.set(p.powertrain,(powertrainMap.get(p.powertrain)||0)+p.count);
const generationUnspecified=active.reduce((n,f)=>n+(f.generations||[]).filter(g=>g.active_record_count>0&&g.normalization_source==='unspecified').length,0);
const output={schema_version:1,generated_at:new Date().toISOString(),status:{makers:h.active_maker_count,families:h.active_family_count,generations:h.active_generation_count,records:h.source_active_record_count,calculator_ready_records:h.calculator_ready_record_count,raw_only_families:raw.length,generation_unspecified:generationUnspecified},makers:[...makerMap.values()].sort((a,b)=>b.raw_only_records-a.raw_only_records||b.records-a.records).slice(0,100),powertrains:[...powertrainMap.entries()].map(([powertrain,records])=>({powertrain,records})).sort((a,b)=>b.records-a.records),raw_only_examples:raw.sort((a,b)=>b.active_record_count-a.active_record_count||String(a.maker).localeCompare(String(b.maker),'ko')).slice(0,250).map(f=>({family_id:f.family_id,maker:f.maker,family_name:f.family_name,records:f.active_record_count,raw_group_count:f.raw_group_count,raw_models:f.raw_models.slice(0,12)}))};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');console.log(`Hierarchy summary: ${raw.length} raw-only families; ${generationUnspecified} unspecified generations`);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const h=JSON.parse(fs.readFileSync(path.join(root,'data','generated','service-hierarchy.json'),'utf8'));
const out=path.join(root,'data','generated','service-hierarchy-backlog.json');
const families=(h.families||[]).filter(f=>f.active_record_count>0);
const raw=families.filter(f=>f.normalization_status==='raw_only').map(f=>({maker:f.maker,family_id:f.family_id,family_name:f.family_name,records:f.active_record_count,raw_models:(f.raw_models||[]).slice(0,30)})).sort((a,b)=>b.records-a.records||a.maker.localeCompare(b.maker,'ko')||a.family_name.localeCompare(b.family_name,'ko'));
const generation=[];
for(const f of families){for(const g of f.generations||[]){if(!g.generation_label||g.generation_label==='세대 미분류'){generation.push({maker:f.maker,family_id:f.family_id,family_name:f.family_name,normalization_status:f.normalization_status,records:g.active_record_count||g.record_count||0,raw_models:(g.raw_models||f.raw_models||[]).slice(0,30)})}}}
generation.sort((a,b)=>b.records-a.records||a.maker.localeCompare(b.maker,'ko')||a.family_name.localeCompare(b.family_name,'ko'));
const byMaker=new Map();for(const x of raw){const v=byMaker.get(x.maker)||{maker:x.maker,raw_only_families:0,raw_only_records:0};v.raw_only_families++;v.raw_only_records+=x.records;byMaker.set(x.maker,v)}
const output={schema_version:1,generated_at:new Date().toISOString(),counts:{raw_only_families:raw.length,raw_only_records:raw.reduce((n,x)=>n+x.records,0),generation_unspecified: generation.length,generation_unspecified_records:generation.reduce((n,x)=>n+x.records,0)},maker_backlog:[...byMaker.values()].sort((a,b)=>b.raw_only_records-a.raw_only_records),raw_only_top:raw.slice(0,150),generation_unspecified_top:generation.slice(0,200)};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(`Hierarchy backlog: ${output.counts.raw_only_families} raw-only families / ${output.counts.raw_only_records} rows / ${output.counts.generation_unspecified} generation-unspecified groups`);

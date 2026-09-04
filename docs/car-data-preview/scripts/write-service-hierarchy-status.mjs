import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const hierarchyPath=path.join(root,'data','generated','service-hierarchy.json');
const issuesPath=path.join(root,'data','generated','service-hierarchy-issues.json');
const statusPath=path.join(root,'data','generated','service-hierarchy-status.json');
if(!fs.existsSync(hierarchyPath)){console.error('Missing service hierarchy');process.exit(2)}
const h=JSON.parse(fs.readFileSync(hierarchyPath,'utf8'));
const issues=fs.existsSync(issuesPath)?JSON.parse(fs.readFileSync(issuesPath,'utf8')):{issues:[]};
const activeFamilies=(h.families||[]).filter(f=>(f.active_record_count||0)>0);
const activeIndex=Object.values(h.group_index||{}).filter(g=>g.source_status==='active');
const status={
  ok:true,
  hierarchy_version:h.hierarchy_version||1,
  generated_at:h.generated_at||new Date().toISOString(),
  active_source_groups:Number(h.source_active_group_count||0),
  active_source_records:Number(h.source_active_record_count||0),
  assigned_active_groups:activeIndex.length,
  assigned_active_records:activeFamilies.reduce((n,f)=>n+Number(f.active_record_count||0),0),
  archived_records:(h.families||[]).reduce((n,f)=>n+Number(f.archived_record_count||0),0),
  makers:Number(h.active_maker_count||0),
  families:Number(h.active_family_count||activeFamilies.length),
  generations:Number(h.active_generation_count||activeFamilies.reduce((n,f)=>n+(f.generations||[]).filter(g=>(g.active_record_count||0)>0).length,0)),
  calculator_ready_records:Number(h.calculator_ready_record_count||0),
  reviewed_families:Number(h.normalization?.reviewed_families||0),
  auto_high_families:Number(h.normalization?.auto_high_families||0),
  auto_medium_families:Number(h.normalization?.auto_medium_families||0),
  raw_only_families:Number(h.normalization?.raw_only_families||0),
  reviewed_groups:Number(h.normalization?.reviewed_groups||0),
  auto_high_groups:Number(h.normalization?.auto_high_groups||0),
  auto_medium_groups:Number(h.normalization?.auto_medium_groups||0),
  raw_only_groups:Number(h.normalization?.raw_only_groups||0),
  issue_count:Number(issues.issue_count ?? issues.issues?.length ?? 0)
};
fs.writeFileSync(statusPath,JSON.stringify(status,null,2)+'\n');
console.log(`Hierarchy status v${status.hierarchy_version}: ${status.makers} makers / ${status.families} families / ${status.generations} generations / ${status.assigned_active_records}/${status.active_source_records} rows / raw-only ${status.raw_only_families}`);

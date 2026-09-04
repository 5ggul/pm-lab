import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const source=path.join(root,'data','generated','vehicle-family-coverage.json');
const out=path.join(root,'data','generated','vehicle-family-summary.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const families=data.families||[];
const slim=f=>({family_id:f.family_id,maker:f.maker,display_name:f.display_name,current_generation_rule_label:f.current_generation_rule_label,current_generation_candidate_rows:f.current_generation_candidate_rows,current_generation_candidate_enriched_rows:f.current_generation_candidate_enriched_rows,reviewed_generation_ready:f.reviewed_generation_ready,page_ready:f.page_ready,hold_reasons:f.hold_reasons});
const summary={
  schema_version:1,
  generated_at:data.generated_at,
  target_family_count:data.target_family_count,
  family_registry_ready_count:data.family_registry_ready_count,
  current_generation_candidate_family_count:data.current_generation_candidate_family_count,
  current_generation_energy_enriched_family_count:data.current_generation_energy_enriched_family_count,
  reviewed_generation_ready_count:data.reviewed_generation_ready_count,
  conflicted_source_rows:data.conflicted_source_rows,
  current_generation_ready:families.filter(f=>f.current_generation_candidate_ready).map(slim),
  current_generation_pending:families.filter(f=>!f.current_generation_candidate_ready).map(slim),
  page_ready:families.filter(f=>f.page_ready).map(slim)
};
fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
console.log(`Family summary: ${summary.current_generation_ready.length} current-generation candidates, ${summary.current_generation_pending.length} pending, ${summary.page_ready.length} reviewed pages`);

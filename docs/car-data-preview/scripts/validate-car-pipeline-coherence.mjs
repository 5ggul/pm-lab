import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data','generated',name),'utf8'));
const hierarchy=read('service-hierarchy-status.json');
const backlog=read('service-hierarchy-backlog.json');
const calc=read('all-car-calc-status.json');
const allCars=read('all-car-status.json');
const errors=[];
const same=(label,a,b)=>{if(a!==b)errors.push(`${label}: ${a} !== ${b}`)};

if(!hierarchy.ok)errors.push('service hierarchy status is not ok');
if(Number(hierarchy.hierarchy_version||0)<3)errors.push(`hierarchy_version regressed: ${hierarchy.hierarchy_version}`);
if(Number(hierarchy.issue_count||0)!==0)errors.push(`hierarchy issues: ${hierarchy.issue_count}`);
same('source records vs all-car active records',hierarchy.active_source_records,allCars.active_records);
same('assigned records vs source records',hierarchy.assigned_active_records,hierarchy.active_source_records);
same('assigned groups vs source groups',hierarchy.assigned_active_groups,hierarchy.active_source_groups);
same('hierarchy families vs calc families',hierarchy.families,calc.families);
same('hierarchy calculator-ready vs calc tax-ready',hierarchy.calculator_ready_records,calc.tax_ready);
same('hierarchy raw-only families vs backlog',hierarchy.raw_only_families,backlog.counts?.raw_only_families);
same('calc rows vs source records',calc.rows,hierarchy.active_source_records);

if(errors.length){
  console.error(JSON.stringify({ok:false,errors,hierarchy:{version:hierarchy.hierarchy_version,families:hierarchy.families,raw_only:hierarchy.raw_only_families,calculator_ready:hierarchy.calculator_ready_records},backlog:backlog.counts,calc:{rows:calc.rows,families:calc.families,tax_ready:calc.tax_ready}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,hierarchy_version:hierarchy.hierarchy_version,records:hierarchy.active_source_records,families:hierarchy.families,raw_only_families:hierarchy.raw_only_families,tax_ready:calc.tax_ready,energy_ready:calc.energy_ready,full_ready:calc.full_ready},null,2));

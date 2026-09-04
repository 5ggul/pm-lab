import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-catalog.json'),'utf8'));
const idx=JSON.parse(fs.readFileSync(path.join(root,'data','generated','all-car-calc-index.json'),'utf8'));
const fail=m=>{console.error('FAIL',m);process.exitCode=1},pass=m=>console.log('PASS',m);
const activeRows=(catalog.groups||[]).filter(g=>g.source_status==='active').reduce((n,g)=>n+(g.records||[]).length,0);
if(idx.rows.length===activeRows)pass(`calc index preserves all ${activeRows} active rows`);else fail(`calc rows ${idx.rows.length} != active rows ${activeRows}`);
const ids=new Set();for(const r of idx.rows){if(!r.calc_id)fail('missing calc_id');else if(ids.has(r.calc_id))fail(`duplicate calc_id ${r.calc_id}`);else ids.add(r.calc_id);if(r.full_cost_ready&&(!r.energy_cost_ready||!r.tax_ready))fail(`full-ready inconsistency ${r.calc_id}`);if(r.energy_cost_ready&&!Number(r.combined_efficiency)>0)fail(`energy-ready without efficiency ${r.calc_id}`);if(r.tax_ready&&!/승용/.test(String(r.vehicle_class||'')))fail(`tax-ready non-passenger ${r.calc_id} ${r.vehicle_class}`);if(r.powertrain==='electric'&&r.tax_ready&&r.displacement_cc){}if(['phev','hydrogen','unknown'].includes(r.powertrain)&&r.energy_cost_ready)fail(`unsupported energy type marked ready ${r.calc_id} ${r.powertrain}`);if(!r.energy_cost_ready&&!r.energy_unavailable_reason)fail(`missing energy reason ${r.calc_id}`);if(!r.tax_ready&&!r.tax_unavailable_reason)fail(`missing tax reason ${r.calc_id}`)}
if(idx.counts.rows===idx.rows.length)pass(`status row count ${idx.counts.rows}`);else fail('status row count mismatch');
for(const k of ['energy_ready','tax_ready','full_ready']){const field=k==='energy_ready'?'energy_cost_ready':k==='tax_ready'?'tax_ready':'full_cost_ready',actual=idx.rows.filter(r=>r[field]).length;if(idx.counts[k]===actual)pass(`${k} ${actual}`);else fail(`${k} count ${idx.counts[k]} != ${actual}`)}
if(idx.counts.full_ready>100)pass(`usable full-cost coverage ${idx.counts.full_ready}`);else fail(`full-cost coverage unexpectedly low ${idx.counts.full_ready}`);
if(idx.families.length>100)pass(`family calculation index ${idx.families.length}`);else fail(`family calculation index unexpectedly small ${idx.families.length}`);
if(!process.exitCode)console.log('All-car calculation index validation passed.');

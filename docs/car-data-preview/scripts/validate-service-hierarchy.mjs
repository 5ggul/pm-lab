import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const catalogPath = path.join(root, 'data', 'generated', 'all-car-catalog.json');
const hierarchyPath = path.join(root, 'data', 'generated', 'service-hierarchy.json');
const registryPath = path.join(root, 'data', 'vehicle-families.json');

const fail = msg => { console.error('FAIL', msg); process.exitCode = 1; };
const pass = msg => console.log('PASS', msg);
if (!fs.existsSync(catalogPath) || !fs.existsSync(hierarchyPath)) {
  console.error('Missing catalog or hierarchy output');
  process.exit(2);
}
const catalog = JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath,'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath,'utf8'));
const activeGroups = (catalog.groups || []).filter(g=>g.source_status==='active');
const activeIds = new Set(activeGroups.map(g=>g.catalog_id));
const indexIds = new Set(Object.keys(hierarchy.group_index || {}).filter(id=>hierarchy.group_index[id]?.source_status==='active'));

if (hierarchy.source_active_record_count === catalog.active_record_count) pass(`source active rows ${catalog.active_record_count}`); else fail(`hierarchy source rows ${hierarchy.source_active_record_count} != catalog ${catalog.active_record_count}`);
if (hierarchy.source_active_group_count === catalog.active_group_count) pass(`source active groups ${catalog.active_group_count}`); else fail(`hierarchy source groups ${hierarchy.source_active_group_count} != catalog ${catalog.active_group_count}`);
if (indexIds.size === activeIds.size) pass(`group index covers ${activeIds.size} active groups`); else fail(`group index active ${indexIds.size} != ${activeIds.size}`);
for (const id of activeIds) if (!indexIds.has(id)) fail(`missing active catalog group ${id}`);
for (const id of indexIds) if (!activeIds.has(id)) fail(`unknown active hierarchy group ${id}`);

const familyIds = new Set();
let activeRecordSum = 0;
let activeGroupRefs = 0;
let calcReadySum = 0;
for (const f of hierarchy.families || []) {
  if (!f.family_id || !f.family_name || !f.maker_id || !f.maker) fail(`invalid family identity ${JSON.stringify({id:f.family_id,name:f.family_name,maker:f.maker})}`);
  if (familyIds.has(f.family_id)) fail(`duplicate family id ${f.family_id}`); else familyIds.add(f.family_id);
  if (!['reviewed_override','auto_high','auto_medium','raw_only'].includes(f.normalization_status)) fail(`invalid normalization status ${f.family_id} ${f.normalization_status}`);
  if (f.active_record_count > 0) {
    activeRecordSum += f.active_record_count;
    calcReadySum += f.calculator_ready_record_count || 0;
    activeGroupRefs += (f.raw_group_ids || []).filter(id=>activeIds.has(id)).length;
  }
  const genIds = new Set();
  let genRecords = 0;
  for (const g of f.generations || []) {
    if (g.family_id !== f.family_id) fail(`generation family mismatch ${g.generation_id}`);
    if (genIds.has(g.generation_id)) fail(`duplicate generation id ${g.generation_id}`); else genIds.add(g.generation_id);
    genRecords += g.active_record_count || 0;
  }
  if (genRecords !== f.active_record_count) fail(`generation row sum mismatch ${f.family_id}: ${genRecords} != ${f.active_record_count}`);
}
if (activeRecordSum === catalog.active_record_count) pass(`family hierarchy preserves all ${activeRecordSum} active rows`); else fail(`family active row sum ${activeRecordSum} != ${catalog.active_record_count}`);
if (activeGroupRefs === catalog.active_group_count) pass(`family hierarchy references all ${activeGroupRefs} active groups exactly once by total count`); else fail(`active family group refs ${activeGroupRefs} != ${catalog.active_group_count}`);
if (calcReadySum === hierarchy.calculator_ready_record_count) pass(`calculator-ready rows ${calcReadySum}`); else fail(`calculator-ready mismatch ${calcReadySum} != ${hierarchy.calculator_ready_record_count}`);
if ((hierarchy.active_family_count || 0) >= 100 && hierarchy.active_family_count <= catalog.active_group_count) pass(`family count plausible ${hierarchy.active_family_count}`); else fail(`implausible active family count ${hierarchy.active_family_count}`);
if ((hierarchy.active_generation_count || 0) >= hierarchy.active_family_count) pass(`generation count ${hierarchy.active_generation_count}`); else fail(`generation count ${hierarchy.active_generation_count} < family count ${hierarchy.active_family_count}`);

for (const rf of registry.families || []) {
  const found = (hierarchy.families || []).find(f=>f.family_id===rf.family_id);
  if (!found) fail(`reviewed registry family missing from hierarchy ${rf.family_id}`);
  else if (found.normalization_status !== 'reviewed_override') fail(`reviewed family lost override status ${rf.family_id}`);
}

const groupRefCounts = new Map();
for (const f of hierarchy.families || []) for (const id of f.raw_group_ids || []) if (activeIds.has(id)) groupRefCounts.set(id,(groupRefCounts.get(id)||0)+1);
for (const id of activeIds) {
  const n = groupRefCounts.get(id)||0;
  if (n !== 1) fail(`active group ${id} assigned ${n} times`);
}
if (!process.exitCode) console.log('Service hierarchy validation passed.');

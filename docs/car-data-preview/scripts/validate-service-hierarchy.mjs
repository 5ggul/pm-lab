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

const activeFamilies=(hierarchy.families||[]).filter(f=>f.active_record_count>0);
const activeFamilyIds=new Set(activeFamilies.map(f=>f.family_id));
for(const [from,to] of Object.entries(hierarchy.family_aliases||{})){
  if(from===to)fail(`family alias points to itself: ${from}`);
  if(!activeFamilyIds.has(to))fail(`family alias target missing: ${from} -> ${to}`);
}
if(hierarchy.family_aliases?.['family-f0963420190512cd']==='family-b7795a18ef806e42')pass('legacy K7 family link resolves to consolidated K7');
else fail('legacy K7 family alias missing');
function expectFamily(maker,name,rows){
  const found=activeFamilies.filter(f=>f.maker===maker&&f.family_name===name);
  if(found.length!==1)fail(`${maker} ${name}: expected one family, found ${found.length}`);
  else if(found[0].active_record_count!==rows)fail(`${maker} ${name}: ${found[0].active_record_count} rows != ${rows}`);
}
for(const expected of [
  ['기아','봉고',58],['기아','모하비',21],['기아','스팅어',27],['기아','스토닉',7],['기아','타스만',15],['기아','PV5',16],['기아','K7',23],
  ['현대','그랜드 스타렉스',33],['현대','포터',52],['현대','스타리아',114],['현대','벨로스터',11],['현대','아이오닉',4],['현대','아슬란',6],['현대','i30',2],
  ['케이지모빌리티','렉스턴',20],['케이지모빌리티','렉스턴 스포츠',16],['케이지모빌리티','렉스턴 스포츠 칸',14],['케이지모빌리티','코란도',20],['케이지모빌리티','티볼리',15],
  ['한국지엠','다마스',2],['한국지엠','라보',2],['한국지엠','트랙스',7],['한국지엠','트레일블레이저',13],
  ['루트17','다니고',1],['루트17','다니고3 픽업',2],['루트17','다니고C',1],['루트17','다니고C2',1],['루트17','다니고 VAN',1],
  ['쎄보모빌리티','CEVO-C',3],
  ['Mercedes-Benz','A-Class',28],['Mercedes-Benz','C-Class',32],['Mercedes-Benz','E-Class',62],['Mercedes-Benz','S-Class',84],['Mercedes-Benz','AMG GT',22],['Mercedes-Benz','GLC',37],['Mercedes-Benz','GLE',48],
  ['Audi','SQ5',4],['Audi','SQ7',2],['DS','DS3',3],['DS','DS4',2],['DS','DS7',5]
])expectFamily(...expected);
for(const f of activeFamilies){
  if(f.maker==='기아'&&f.family_name==='스타리아')fail('Hyundai Staria remains under Kia');
  if(f.maker==='Mercedes-Benz'&&/^(?:AMG(?:\s+(?:4MATIC|S\s+4MATIC|Coupe))?|d\s+4Matic|4MATIC)$/i.test(f.family_name))fail(`mixed Mercedes family remains: ${f.family_name}`);
  if(f.maker==='Audi'&&/^TFSI$/i.test(f.family_name))fail('mixed Audi TFSI family remains');
  if(f.maker==='DS'&&/Crossback/i.test(f.family_name))fail(`mixed DS Crossback family remains: ${f.family_name}`);
  if(f.maker==='루트17'&&f.raw_models?.includes('DANIGO 3')&&f.raw_models?.includes('Danigo(다니고)'))fail('cargo DANIGO 3 and passenger Danigo remain mixed');
}
if(!process.exitCode)pass('high-confidence model aliases stay consolidated and cross-brand assignments stay separated');
if(hierarchy.family_aliases?.['family-beb9148baee0e440']==='family-23e3eb5656c2da44'&&hierarchy.family_aliases?.['family-6db19c85c6ded5fb']==='family-23e3eb5656c2da44')pass('legacy CEVO-C family links resolve to the consolidated model');
else fail('legacy CEVO-C family aliases missing');

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

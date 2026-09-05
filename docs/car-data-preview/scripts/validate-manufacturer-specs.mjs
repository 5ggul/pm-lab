import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataPath = path.join(root, 'data', 'generated', 'manufacturer-specs.json');
const registryPath = path.join(root, 'data', 'manufacturer-spec-sources.json');
const hierarchyPath = path.join(root, 'data', 'generated', 'service-hierarchy.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
const familyIds = new Set((hierarchy.families || []).map(f => f.family_id));
const allowedHosts = new Set(['hyundai.com','www.hyundai.com','ownersmanual.hyundai.com','kia.com','www.kia.com','genesis.com','www.genesis.com']);
const errors = [];

if (data.schema_version !== 1) errors.push('schema_version must be 1');
if (data.record_count !== (data.records || []).length) errors.push('record_count mismatch');
if (data.record_count !== (registry.sources || []).length) errors.push('not every registered source produced a record');
const seen = new Set();
for (const r of data.records || []) {
  if (!r.family_id || seen.has(r.family_id)) errors.push(`duplicate or missing family_id: ${r.family_id}`);
  seen.add(r.family_id);
  if (!familyIds.has(r.family_id)) errors.push(`family missing from service hierarchy: ${r.family_id}`);
  if (!r.source?.url) errors.push(`missing official source URL: ${r.family_id}`);
  else {
    try {
      const u = new URL(r.source.url);
      if (u.protocol !== 'https:') errors.push(`non-https source: ${r.family_id}`);
      if (!allowedHosts.has(u.hostname)) errors.push(`unapproved source host ${u.hostname}: ${r.family_id}`);
    } catch { errors.push(`invalid source URL: ${r.family_id}`); }
  }
  const d = r.dimensions || {};
  for (const key of ['length_mm','width_mm','height_mm','wheelbase_mm']) {
    if (d[key] == null) errors.push(`missing ${key}: ${r.family_id}`);
  }
  if (!(r.powertrains || []).length) errors.push(`missing powertrains: ${r.family_id}`);
  for (const p of r.powertrains || []) {
    if (!p.powertrain) errors.push(`powertrain label missing: ${r.family_id}`);
    if (p.displacement_cc != null && !(Number(p.displacement_cc) > 0 && Number(p.displacement_cc) < 10000)) errors.push(`implausible displacement: ${r.family_id}`);
    if (p.battery_kwh != null && !(Number(p.battery_kwh) > 5 && Number(p.battery_kwh) < 500)) errors.push(`implausible battery capacity: ${r.family_id}`);
  }
}
if (errors.length) {
  console.error(JSON.stringify({ok:false, errors}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true, records:data.record_count, coverage:data.coverage}, null, 2));

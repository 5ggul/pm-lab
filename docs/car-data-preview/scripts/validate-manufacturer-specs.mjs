import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataPath = path.join(root, 'data', 'generated', 'manufacturer-specs.json');
const registryPath = path.join(root, 'data', 'manufacturer-spec-sources.json');
const reviewedPath = path.join(root, 'data', 'manufacturer-spec-reviewed.json');
const hierarchyPath = path.join(root, 'data', 'generated', 'service-hierarchy.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const reviewed = fs.existsSync(reviewedPath) ? JSON.parse(fs.readFileSync(reviewedPath, 'utf8')) : {records:[]};
const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
const familyIds = new Set((hierarchy.families || []).map(f => f.family_id));
const expectedFamilies = new Set([...(registry.sources || []).map(s => s.family_id), ...(reviewed.records || []).map(r => r.family_id)]);
const allowedHosts = new Set(['hyundai.com','www.hyundai.com','ownersmanual.hyundai.com','kia.com','www.kia.com','genesis.com','www.genesis.com']);
const errors = [];

function numbersIn(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
  return [...String(value ?? '').matchAll(/\d+(?:\.\d+)?/g)]
    .map(m => Number(m[0]))
    .filter(Number.isFinite);
}

if (data.schema_version !== 1) errors.push('schema_version must be 1');
if (reviewed.schema_version !== 1) errors.push('manufacturer-spec-reviewed schema_version must be 1');
if (data.record_count !== (data.records || []).length) errors.push('record_count mismatch');
if (data.record_count !== expectedFamilies.size) errors.push(`not every reviewed family produced a record: ${data.record_count} !== ${expectedFamilies.size}`);
const seen = new Set();
for (const r of data.records || []) {
  if (!r.family_id || seen.has(r.family_id)) errors.push(`duplicate or missing family_id: ${r.family_id}`);
  seen.add(r.family_id);
  if (!expectedFamilies.has(r.family_id)) errors.push(`unexpected manufacturer family: ${r.family_id}`);
  if (!familyIds.has(r.family_id)) errors.push(`family missing from service hierarchy: ${r.family_id}`);
  if (!r.source?.url) errors.push(`missing official source URL: ${r.family_id}`);
  else {
    try {
      const u = new URL(r.source.url);
      if (u.protocol !== 'https:') errors.push(`non-https source: ${r.family_id}`);
      if (!allowedHosts.has(u.hostname)) errors.push(`unapproved source host ${u.hostname}: ${r.family_id}`);
    } catch { errors.push(`invalid source URL: ${r.family_id}`); }
  }
  if (!r.source?.reviewed_on) errors.push(`missing reviewed_on: ${r.family_id}`);
  const d = r.dimensions || {};
  const dimensionRanges = {
    length_mm:[2500,7000],
    width_mm:[1300,2600],
    height_mm:[1000,3000],
    wheelbase_mm:[1800,4500]
  };
  for (const [key,[min,max]] of Object.entries(dimensionRanges)) {
    if (d[key] == null) {
      errors.push(`missing ${key}: ${r.family_id}`);
      continue;
    }
    const values = numbersIn(d[key]);
    if (!values.length || values.some(value => value < min || value > max)) {
      errors.push(`implausible ${key}: ${r.family_id}=${d[key]}`);
    }
  }
  if (!(r.powertrains || []).length) errors.push(`missing powertrains: ${r.family_id}`);
  for (const p of r.powertrains || []) {
    if (!p.powertrain) errors.push(`powertrain label missing: ${r.family_id}`);
    if (p.displacement_cc != null && !(Number(p.displacement_cc) > 0 && Number(p.displacement_cc) < 10000)) errors.push(`implausible displacement: ${r.family_id}`);
    if (p.battery_kwh != null && !(Number(p.battery_kwh) > 5 && Number(p.battery_kwh) < 500)) errors.push(`implausible battery capacity: ${r.family_id}`);
    if (p.motor_output_kw != null && !(Number(p.motor_output_kw) > 5 && Number(p.motor_output_kw) < 1500)) errors.push(`implausible motor output: ${r.family_id}`);
    if (p.motor_torque_nm != null && !(Number(p.motor_torque_nm) > 10 && Number(p.motor_torque_nm) < 3000)) errors.push(`implausible motor torque: ${r.family_id}`);
    if (p.system_output_ps != null && !(Number(p.system_output_ps) > 10 && Number(p.system_output_ps) < 2000)) errors.push(`implausible system output: ${r.family_id}`);
  }
}
for (const familyId of expectedFamilies) if (!seen.has(familyId)) errors.push(`missing reviewed family output: ${familyId}`);
if (errors.length) {
  console.error(JSON.stringify({ok:false, errors}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true, records:data.record_count, expected_families:expectedFamilies.size, coverage:data.coverage}, null, 2));

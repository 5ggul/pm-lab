import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'data', 'manufacturer-spec-sources.json');
const manifestPath = path.join(root, 'data', 'vehicles', 'manifest.json');
const hierarchyPath = path.join(root, 'data', 'generated', 'service-hierarchy.json');
const outPath = path.join(root, 'data', 'generated', 'manufacturer-specs.json');
const statusPath = path.join(root, 'data', 'generated', 'manufacturer-specs-status.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const hierarchy = fs.existsSync(hierarchyPath) ? JSON.parse(fs.readFileSync(hierarchyPath, 'utf8')) : {families:[]};
const previous = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {records:[]};
const previousByFamily = new Map((previous.records || []).map(r => [r.family_id, r]));
const vehicleFileById = new Map((manifest.vehicles || []).map(v => [v.id, v.file]));
const hierarchyFamilies = new Set((hierarchy.families || []).map(f => f.family_id));
const allowedHosts = ['hyundai.com', 'www.hyundai.com', 'ownersmanual.hyundai.com', 'kia.com', 'www.kia.com', 'genesis.com', 'www.genesis.com'];

function compactNumber(v) {
  return String(v ?? '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}
function numericTokens(v) {
  return [...String(v ?? '').matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]);
}
function htmlToText(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#44;/gi, ',')
    .replace(/\s+/g, ' ')
    .trim();
}
function uniqBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function powertrainSpecs(vehicle) {
  const rows = (vehicle.variants || []).map(v => ({
    powertrain: v.powertrain || null,
    fuel_type: v.fuel_type || null,
    displacement_cc: v.displacement_cc ?? null,
    max_power: v.max_power || null,
    max_torque: v.max_torque || null,
    motor_output_kw: v.motor_output_kw ?? null,
    motor_output_ps: v.motor_output_ps ?? null,
    motor_torque_nm: v.motor_torque_nm ?? null,
    battery_kwh: v.battery_kwh ?? null
  }));
  return uniqBy(rows, r => JSON.stringify(r));
}
function batterySummary(vehicle, specs) {
  if (vehicle.battery && typeof vehicle.battery === 'object') return vehicle.battery;
  const values = [...new Set(specs.map(v => v.battery_kwh).filter(v => Number.isFinite(Number(v))).map(Number))].sort((a,b) => a-b);
  return values.length ? {capacities_kwh: values} : null;
}
function fingerprintTokens(vehicle, specs) {
  const tokens = [];
  for (const v of Object.values(vehicle.dimensions || {})) tokens.push(...numericTokens(v));
  const battery = batterySummary(vehicle, specs);
  if (battery) for (const v of Object.values(battery)) {
    if (Array.isArray(v)) v.forEach(x => tokens.push(...numericTokens(x)));
    else tokens.push(...numericTokens(v));
  }
  return [...new Set(tokens.map(compactNumber).filter(t => t.length >= 2))];
}
async function probe(url, mode, expectedTokens) {
  const started = new Date().toISOString();
  if (!url) return {state:'missing_source_url', checked_at:started, matched:0, expected:expectedTokens.length};
  let parsed;
  try { parsed = new URL(url); } catch { return {state:'invalid_source_url', checked_at:started, matched:0, expected:expectedTokens.length}; }
  if (!allowedHosts.includes(parsed.hostname)) return {state:'unapproved_source_host', checked_at:started, host:parsed.hostname, matched:0, expected:expectedTokens.length};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; MyCarDataSpecBot/1.0; +https://5ggul.github.io/pm-lab/car-data-preview/data-sources/)',
        'accept': 'text/html,application/pdf;q=0.9,*/*;q=0.8'
      }
    });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return {state:'source_http_error', checked_at:started, http_status:res.status, content_type:contentType, matched:0, expected:expectedTokens.length};
    if (mode === 'official_pdf' || contentType.includes('application/pdf')) {
      return {state:'official_pdf_reachable', checked_at:started, http_status:res.status, content_type:contentType, matched:null, expected:expectedTokens.length};
    }
    const text = compactNumber(htmlToText(await res.text()));
    const matchedTokens = expectedTokens.filter(token => text.includes(compactNumber(token)));
    const ratio = expectedTokens.length ? matchedTokens.length / expectedTokens.length : 1;
    return {
      state: ratio >= 0.75 ? 'live_verified' : 'live_reachable_unverified',
      checked_at:started,
      http_status:res.status,
      content_type:contentType,
      matched:matchedTokens.length,
      expected:expectedTokens.length,
      match_ratio:Number(ratio.toFixed(3))
    };
  } catch (error) {
    return {state:'source_fetch_failed', checked_at:started, error:String(error?.name || error?.message || error), matched:0, expected:expectedTokens.length};
  } finally {
    clearTimeout(timer);
  }
}

const records = [];
for (const source of registry.sources || []) {
  const relativeFile = vehicleFileById.get(source.vehicle_id);
  if (!relativeFile) {
    const old = previousByFamily.get(source.family_id);
    if (old) records.push({...old, live_probe:{state:'vehicle_seed_missing', checked_at:new Date().toISOString()}});
    continue;
  }
  const vehiclePath = path.join(root, 'data', 'vehicles', relativeFile);
  const vehicle = JSON.parse(fs.readFileSync(vehiclePath, 'utf8'));
  const specs = powertrainSpecs(vehicle);
  const sourceInfo = vehicle.sources?.specs || vehicle.sources?.efficiency || {};
  const tokens = fingerprintTokens(vehicle, specs);
  const liveProbe = await probe(sourceInfo.url, source.probe_mode, tokens);
  records.push({
    family_id:source.family_id,
    family_exists_in_hierarchy:hierarchyFamilies.has(source.family_id),
    vehicle_id:source.vehicle_id,
    maker:vehicle.maker,
    model:vehicle.model,
    generation:vehicle.generation || null,
    code:vehicle.code || null,
    model_year:vehicle.model_year || null,
    dimensions:vehicle.dimensions || null,
    battery:batterySummary(vehicle, specs),
    powertrains:specs,
    source:{name:sourceInfo.name || null, url:sourceInfo.url || null, reviewed_on:vehicle.reviewed_on || null},
    live_probe:liveProbe,
    data_basis:'reviewed_manufacturer_official_source'
  });
}
records.sort((a,b) => String(a.family_id).localeCompare(String(b.family_id), 'ko'));

const coverage = {
  dimensions:records.filter(r => r.dimensions && ['length_mm','width_mm','height_mm','wheelbase_mm'].every(k => r.dimensions[k] != null)).length,
  power:records.filter(r => r.powertrains.some(p => p.max_power || p.motor_output_kw != null || p.motor_output_ps != null)).length,
  torque:records.filter(r => r.powertrains.some(p => p.max_torque || p.motor_torque_nm != null)).length,
  battery:records.filter(r => r.battery != null || r.powertrains.some(p => p.battery_kwh != null)).length
};
const stateCounts = {};
for (const r of records) stateCounts[r.live_probe?.state || 'unknown'] = (stateCounts[r.live_probe?.state || 'unknown'] || 0) + 1;
const generatedAt = new Date().toISOString();
const output = {
  schema_version:1,
  generated_at:generatedAt,
  source_registry_count:(registry.sources || []).length,
  record_count:records.length,
  policy:registry.policy,
  coverage,
  records
};
const status = {
  ok:true,
  generated_at:generatedAt,
  records:records.length,
  coverage,
  source_states:stateCounts,
  missing_hierarchy_families:records.filter(r => !r.family_exists_in_hierarchy).map(r => r.family_id)
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
console.log(JSON.stringify(status, null, 2));

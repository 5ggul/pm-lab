import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'data', 'vehicle-families.json');
const mergedPath = path.join(root, 'data', 'staging', 'kea-all-cars-merged.json');
const manifestPath = path.join(root, 'data', 'vehicles', 'manifest.json');
const coveragePath = path.join(root, 'data', 'generated', 'vehicle-family-coverage.json');
const rowsPath = path.join(root, 'data', 'staging', 'vehicle-family-rows.json');

if (!fs.existsSync(mergedPath)) {
  console.log('Vehicle family build skipped: merged KEA staging snapshot missing');
  process.exit(0);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const reviewedMap = {
  'hyundai-grandeur': 'grandeur-gn7',
  'hyundai-avante': 'avante-cn7',
  'hyundai-ioniq-5': 'ioniq5-ne',
  'kia-sorento': 'sorento-mq4',
  'kia-k8': 'k8-gl3',
  'kia-ev6': 'ev6-cv',
  'genesis-g80': 'g80-rg3'
};
const manifestIds = new Set((manifest.vehicles || []).map(v => v.id));

function makerNorm(v) {
  return String(v ?? '').toUpperCase().replace(/\s|주식회사|\(주\)|㈜|자동차|MOTOR|MOTORS|COMPANY|CO\.?|LTD\.?/g, '');
}
function makerCompatible(target, raw) {
  const m = makerNorm(raw);
  if (!m || m === 'NULL') return true;
  if (target === '현대') return m.includes('현대') || m.includes('HYUNDAI');
  if (target === '기아') return m.includes('기아') || m.includes('KIA');
  if (target === '제네시스') return m.includes('제네시스') || m.includes('GENESIS') || m.includes('현대') || m.includes('HYUNDAI');
  return true;
}
function regexList(values = []) {
  return values.map(v => new RegExp(v, 'i'));
}
function familyMatches(family, row) {
  const model = String(row.model_raw ?? '').trim();
  if (!model || !makerCompatible(family.maker, row.maker_raw)) return false;
  const include = regexList(family.include);
  const exclude = regexList(family.exclude);
  return include.some(re => re.test(model)) && !exclude.some(re => re.test(model));
}
function uniq(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
}

const rows = merged.rows || [];
const rowCandidates = new Map();
for (const row of rows) {
  const matches = registry.families.filter(f => familyMatches(f, row)).map(f => f.family_id);
  rowCandidates.set(row.merged_record_id, matches);
}

const familyRows = [];
const familyReports = [];
let registryReadyCount = 0;
let generationReadyCount = 0;
let enrichedFamilyCount = 0;

for (const family of registry.families) {
  const matched = rows.filter(r => (rowCandidates.get(r.merged_record_id) || []).includes(family.family_id));
  const uniqueAssigned = matched.filter(r => (rowCandidates.get(r.merged_record_id) || []).length === 1);
  const conflicts = matched.filter(r => (rowCandidates.get(r.merged_record_id) || []).length > 1);
  const enriched = uniqueAssigned.filter(r => r.merge_status === 'exact_unique');
  const displayOnly = uniqueAssigned.filter(r => r.merge_status === 'display_only');
  const ambiguousEnergy = uniqueAssigned.filter(r => r.merge_status === 'ambiguous_energy_match');
  const rawModels = uniq(uniqueAssigned.map(r => r.model_raw)).sort((a,b) => String(a).localeCompare(String(b), 'ko'));
  const makers = uniq(uniqueAssigned.map(r => r.maker_raw));
  const reviewedVehicleId = reviewedMap[family.family_id] || null;
  const generationReviewed = Boolean(reviewedVehicleId && manifestIds.has(reviewedVehicleId));
  const officialLineupVerified = Boolean(registry.official_lineup_sources?.[family.maker]);
  const familyRegistryReady = officialLineupVerified && uniqueAssigned.length > 0 && conflicts.length === 0;
  const generationDataReady = familyRegistryReady && generationReviewed;
  if (familyRegistryReady) registryReadyCount++;
  if (generationDataReady) generationReadyCount++;
  if (enriched.length) enrichedFamilyCount++;

  familyReports.push({
    family_id: family.family_id,
    maker: family.maker,
    display_name: family.display_name,
    category: family.category,
    official_lineup_url: registry.official_lineup_sources?.[family.maker] || null,
    official_lineup_verified: officialLineupVerified,
    matched_rows: matched.length,
    unique_assigned_rows: uniqueAssigned.length,
    conflict_rows: conflicts.length,
    exact_energy_join_rows: enriched.length,
    ambiguous_energy_join_rows: ambiguousEnergy.length,
    display_only_rows: displayOnly.length,
    raw_model_group_count: rawModels.length,
    raw_models: rawModels.slice(0, 80),
    maker_values: makers.slice(0, 20),
    family_registry_ready: familyRegistryReady,
    generation_data_ready: generationDataReady,
    existing_reviewed_vehicle_id: generationReviewed ? reviewedVehicleId : null,
    page_ready: generationDataReady,
    hold_reasons: [
      ...(!officialLineupVerified ? ['official_lineup_unverified'] : []),
      ...(uniqueAssigned.length === 0 ? ['no_kea_rows'] : []),
      ...(conflicts.length > 0 ? ['cross_family_match_conflict'] : []),
      ...(!generationReviewed ? ['current_generation_not_yet_mapped'] : [])
    ]
  });

  for (const row of uniqueAssigned) {
    familyRows.push({
      family_id: family.family_id,
      maker: family.maker,
      display_name: family.display_name,
      merged_record_id: row.merged_record_id,
      maker_raw: row.maker_raw,
      model_raw: row.model_raw,
      type_raw: row.type_raw,
      displacement_cc: row.displacement_cc,
      combined_efficiency: row.combined_efficiency,
      city_efficiency: row.city_efficiency,
      highway_efficiency: row.highway_efficiency,
      range_km: row.range_km,
      efficiency_grade: row.efficiency_grade,
      merge_status: row.merge_status,
      generation_reviewed: generationReviewed,
      publishable: generationDataReady,
      review_status: generationDataReady ? 'reviewed_existing_vehicle' : 'family_staging_only'
    });
  }
}

familyReports.sort((a,b) => a.maker.localeCompare(b.maker,'ko') || a.display_name.localeCompare(b.display_name,'ko'));
familyRows.sort((a,b) => a.family_id.localeCompare(b.family_id) || String(a.model_raw).localeCompare(String(b.model_raw),'ko'));

const unassigned = rows.filter(r => (rowCandidates.get(r.merged_record_id) || []).length === 0).length;
const conflicted = rows.filter(r => (rowCandidates.get(r.merged_record_id) || []).length > 1).length;
const output = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  registry_reviewed_on: registry.reviewed_on,
  target_family_count: registry.families.length,
  family_registry_ready_count: registryReadyCount,
  generation_data_ready_count: generationReadyCount,
  enriched_family_count: enrichedFamilyCount,
  merged_source_rows: rows.length,
  assigned_family_rows: familyRows.length,
  unassigned_source_rows: unassigned,
  conflicted_source_rows: conflicted,
  policy: 'family_registry_ready only means official lineup + unambiguous KEA family mapping. generation_data_ready/page_ready additionally require reviewed current-generation vehicle data.',
  families: familyReports
};

fs.mkdirSync(path.dirname(coveragePath), {recursive:true});
fs.mkdirSync(path.dirname(rowsPath), {recursive:true});
fs.writeFileSync(coveragePath, JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(rowsPath, JSON.stringify({
  schema_version: 1,
  generated_at: output.generated_at,
  row_count: familyRows.length,
  rows: familyRows
}, null, 2) + '\n');

console.log(`Vehicle families: ${registryReadyCount}/${registry.families.length} registry-ready; ${generationReadyCount} generation-ready; ${enrichedFamilyCount} energy-enriched; ${conflicted} conflicting source rows`);

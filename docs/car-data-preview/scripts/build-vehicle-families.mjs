import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'data', 'vehicle-families.json');
const generationRulesPath = path.join(root, 'data', 'vehicle-generation-rules.json');
const mergedPath = path.join(root, 'data', 'staging', 'kea-all-cars-merged.json');
const manifestPath = path.join(root, 'data', 'vehicles', 'manifest.json');
const coveragePath = path.join(root, 'data', 'generated', 'vehicle-family-coverage.json');
const rowsPath = path.join(root, 'data', 'staging', 'vehicle-family-rows.json');

if (!fs.existsSync(mergedPath)) {
  console.log('Vehicle family build skipped: merged KEA staging snapshot missing');
  process.exit(0);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const generationRules = fs.existsSync(generationRulesPath)
  ? JSON.parse(fs.readFileSync(generationRulesPath, 'utf8'))
  : {rules: []};
const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ruleByFamily = new Map((generationRules.rules || []).map(rule => [rule.family_id, rule]));

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
function compact(value) {
  return String(value ?? '').replace(/\s+/g, '');
}
function patternMatches(pattern, model) {
  try {
    if (new RegExp(pattern, 'i').test(model)) return true;
    const compactPattern = String(pattern).replace(/\s+/g, '');
    return compactPattern !== pattern && new RegExp(compactPattern, 'i').test(compact(model));
  } catch {
    return false;
  }
}
function familyMatches(family, row) {
  const model = String(row.model_raw ?? '').trim();
  if (!model || !makerCompatible(family.maker, row.maker_raw)) return false;

  // KEA current G70 Shooting Brake rows also use the compact S/B marker.
  if (family.family_id === 'genesis-g70' && /S\/B/i.test(model)) return false;
  if (family.family_id === 'genesis-g70-shooting-brake' && /G70.*S\/B/i.test(model)) return true;

  const included = (family.include || []).some(pattern => patternMatches(pattern, model));
  const excluded = (family.exclude || []).some(pattern => patternMatches(pattern, model));
  return included && !excluded;
}
function currentGenerationMatches(rule, row) {
  if (!rule) return false;
  const model = String(row.model_raw ?? '').trim();
  return (rule.patterns || []).some(pattern => patternMatches(pattern, model));
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
let reviewedGenerationReadyCount = 0;
let currentGenerationCandidateFamilyCount = 0;
let currentGenerationEnergyEnrichedFamilyCount = 0;
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
  const reviewedGenerationReady = Boolean(reviewedVehicleId && manifestIds.has(reviewedVehicleId));
  const officialLineupVerified = Boolean(registry.official_lineup_sources?.[family.maker]);
  const familyRegistryReady = officialLineupVerified && uniqueAssigned.length > 0 && conflicts.length === 0;
  const rule = ruleByFamily.get(family.family_id) || null;
  const currentCandidateRows = uniqueAssigned.filter(r => currentGenerationMatches(rule, r));
  const currentCandidateEnrichedRows = currentCandidateRows.filter(r => r.merge_status === 'exact_unique');
  const currentGenerationCandidateReady = familyRegistryReady && Boolean(rule) && currentCandidateRows.length > 0;
  const pageReady = familyRegistryReady && reviewedGenerationReady;

  if (familyRegistryReady) registryReadyCount++;
  if (reviewedGenerationReady && familyRegistryReady) reviewedGenerationReadyCount++;
  if (currentGenerationCandidateReady) currentGenerationCandidateFamilyCount++;
  if (currentCandidateEnrichedRows.length) currentGenerationEnergyEnrichedFamilyCount++;
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
    current_generation_rule_label: rule?.generation_label || null,
    current_generation_candidate_rows: currentCandidateRows.length,
    current_generation_candidate_enriched_rows: currentCandidateEnrichedRows.length,
    current_generation_candidate_models: uniq(currentCandidateRows.map(r => r.model_raw)).slice(0, 80),
    current_generation_candidate_ready: currentGenerationCandidateReady,
    reviewed_generation_ready: reviewedGenerationReady,
    existing_reviewed_vehicle_id: reviewedGenerationReady ? reviewedVehicleId : null,
    page_ready: pageReady,
    hold_reasons: [
      ...(!officialLineupVerified ? ['official_lineup_unverified'] : []),
      ...(uniqueAssigned.length === 0 ? ['no_kea_rows'] : []),
      ...(conflicts.length > 0 ? ['cross_family_match_conflict'] : []),
      ...(!rule ? ['current_generation_rule_not_configured'] : []),
      ...(rule && currentCandidateRows.length === 0 ? ['current_generation_rule_no_match'] : []),
      ...(!reviewedGenerationReady ? ['reviewed_generation_json_not_yet_created'] : [])
    ]
  });

  for (const row of uniqueAssigned) {
    const currentGenerationCandidate = currentGenerationMatches(rule, row);
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
      current_generation_candidate: currentGenerationCandidate,
      current_generation_rule_label: currentGenerationCandidate ? rule?.generation_label || null : null,
      reviewed_generation_ready: reviewedGenerationReady,
      publishable: pageReady,
      review_status: pageReady ? 'reviewed_existing_vehicle' : (currentGenerationCandidate ? 'current_generation_candidate_staging' : 'family_staging_only')
    });
  }
}

familyReports.sort((a,b) => a.maker.localeCompare(b.maker,'ko') || a.display_name.localeCompare(b.display_name,'ko'));
familyRows.sort((a,b) => a.family_id.localeCompare(b.family_id) || String(a.model_raw).localeCompare(String(b.model_raw),'ko'));

const unassigned = rows.filter(r => (rowCandidates.get(r.merged_record_id) || []).length === 0).length;
const conflicted = rows.filter(r => (rowCandidates.get(r.merged_record_id) || []).length > 1).length;
const output = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  registry_reviewed_on: registry.reviewed_on,
  generation_rules_reviewed_on: generationRules.reviewed_on || null,
  target_family_count: registry.families.length,
  family_registry_ready_count: registryReadyCount,
  reviewed_generation_ready_count: reviewedGenerationReadyCount,
  current_generation_candidate_family_count: currentGenerationCandidateFamilyCount,
  current_generation_energy_enriched_family_count: currentGenerationEnergyEnrichedFamilyCount,
  enriched_family_count: enrichedFamilyCount,
  merged_source_rows: rows.length,
  assigned_family_rows: familyRows.length,
  unassigned_source_rows: unassigned,
  conflicted_source_rows: conflicted,
  policy: 'family_registry_ready is family-level staging. current_generation_candidate_ready requires an explicit reviewed pattern and KEA match. page_ready still requires a separately reviewed vehicle JSON; candidates are never auto-published.',
  families: familyReports
};

fs.mkdirSync(path.dirname(coveragePath), {recursive:true});
fs.mkdirSync(path.dirname(rowsPath), {recursive:true});
fs.writeFileSync(coveragePath, JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(rowsPath, JSON.stringify({
  schema_version: 2,
  generated_at: output.generated_at,
  row_count: familyRows.length,
  rows: familyRows
}, null, 2) + '\n');

console.log(`Vehicle families: ${registryReadyCount}/${registry.families.length} registry-ready; ${currentGenerationCandidateFamilyCount} current-generation candidates; ${reviewedGenerationReadyCount} reviewed generations; ${enrichedFamilyCount} energy-enriched; ${conflicted} conflicts`);

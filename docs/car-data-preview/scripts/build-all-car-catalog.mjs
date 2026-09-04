import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mergedPath = path.join(root, 'data', 'staging', 'kea-all-cars-merged.json');
const familyRowsPath = path.join(root, 'data', 'staging', 'vehicle-family-rows.json');
const outPath = path.join(root, 'data', 'generated', 'all-car-catalog.json');
const deltaPath = path.join(root, 'data', 'generated', 'all-car-delta.json');
const statusPath = path.join(root, 'data', 'generated', 'all-car-status.json');
const GROUPING_VERSION = 2;

if (!fs.existsSync(mergedPath)) {
  console.error('Missing merged KEA dataset:', mergedPath);
  process.exit(2);
}

const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
const familyRows = fs.existsSync(familyRowsPath)
  ? JSON.parse(fs.readFileSync(familyRowsPath, 'utf8')).rows || []
  : [];
const previousRaw = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
  : {groups: []};
const previous = previousRaw.grouping_version === GROUPING_VERSION ? previousRaw : {groups: []};

const generatedAt = new Date().toISOString();
const today = generatedAt.slice(0, 10);
const familyByRecord = new Map(familyRows.map(r => [r.merged_record_id, r]));
const reviewedDetailPaths = {
  'hyundai-grandeur': '/cars/hyundai/grandeur-gn7/',
  'hyundai-avante': '/cars/hyundai/avante-cn7/',
  'hyundai-ioniq-5': '/cars/hyundai/ioniq-5/',
  'kia-sorento': '/cars/kia/sorento-mq4/',
  'kia-k8': '/cars/kia/k8-gl3/',
  'kia-ev6': '/cars/kia/ev6/',
  'genesis-g80': '/cars/genesis/g80-rg3/'
};

function text(v) {
  const s = String(v ?? '').trim();
  return s && s.toUpperCase() !== 'NULL' ? s : null;
}
function normalizedKey(v) {
  return String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
function stableId(value) {
  return 'car-' + crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}
function sortText(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'ko', {numeric:true, sensitivity:'base'});
}
function sourceInstanceId(row, sourceIndex) {
  const sourceId = text(row.display_source_record_id) || text(row.merged_record_id) || 'kea-row';
  const rowIndex = row.display_source_row_index ?? sourceIndex;
  return `${sourceId}:${rowIndex}`;
}
function compactRecord(row, recordInstanceId, sourceIndex) {
  const family = familyByRecord.get(row.merged_record_id) || null;
  return {
    record_id: recordInstanceId,
    merged_record_id: row.merged_record_id,
    maker: text(family?.maker) || text(row.maker_raw) || '제조사 미표기',
    maker_raw: text(row.maker_raw),
    model: text(row.model_raw) || '모델명 미표기',
    vehicle_class: text(row.vehicle_class_raw),
    type: text(row.type_raw),
    displacement_cc: row.displacement_cc ?? null,
    combined_efficiency: row.combined_efficiency ?? null,
    city_efficiency: row.city_efficiency ?? null,
    highway_efficiency: row.highway_efficiency ?? null,
    range_km: row.range_km ?? null,
    efficiency_grade: row.efficiency_grade ?? null,
    official_annual_fuel_cost_krw: row.official_annual_fuel_cost_krw ?? null,
    merge_status: row.merge_status || null,
    family_id: family?.family_id || null,
    current_generation_candidate: Boolean(family?.current_generation_candidate),
    reviewed_generation_ready: Boolean(family?.reviewed_generation_ready),
    source_record_ids: [row.display_source_record_id, row.energy_source_record_id].filter(Boolean),
    display_source_row_index: row.display_source_row_index ?? sourceIndex
  };
}
function signature(group) {
  return crypto.createHash('sha1').update(JSON.stringify({
    model: group.model,
    records: group.records.map(r => ({
      record_id: r.record_id,
      maker_raw: r.maker_raw,
      type: r.type,
      displacement_cc: r.displacement_cc,
      combined_efficiency: r.combined_efficiency,
      city_efficiency: r.city_efficiency,
      highway_efficiency: r.highway_efficiency,
      range_km: r.range_km,
      efficiency_grade: r.efficiency_grade,
      official_annual_fuel_cost_krw: r.official_annual_fuel_cost_krw,
      merge_status: r.merge_status,
      family_id: r.family_id,
      current_generation_candidate: r.current_generation_candidate,
      reviewed_generation_ready: r.reviewed_generation_ready
    }))
  })).digest('hex');
}

const grouped = new Map();
for (const [sourceIndex, row] of (merged.rows || []).entries()) {
  const record = compactRecord(row, sourceInstanceId(row, sourceIndex), sourceIndex);
  // Stable model identity derives only from KEA source maker + source model, never from manual family/review mapping.
  const sourceMakerKey = normalizedKey(record.maker_raw || 'source-maker-missing');
  const key = `${sourceMakerKey}|${normalizedKey(record.model)}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(record);
}

const previousById = new Map((previous.groups || []).map(g => [g.catalog_id, g]));
const activeGroups = [];
const added = [];
const changed = [];
const unchanged = [];

for (const [key, recordsRaw] of grouped) {
  const records = recordsRaw.sort((a,b) => sortText(a.model,b.model) || sortText(a.type,b.type) || (a.combined_efficiency ?? 999) - (b.combined_efficiency ?? 999) || sortText(a.record_id,b.record_id));
  const displayMakers = [...new Set(records.map(r => r.maker).filter(Boolean))];
  const sourceMakers = [...new Set(records.map(r => r.maker_raw).filter(Boolean))];
  const maker = displayMakers.length === 1 ? displayMakers[0] : (sourceMakers[0] || '제조사 미표기');
  const model = records[0]?.model || '모델명 미표기';
  const catalogId = stableId(key);
  const families = [...new Set(records.map(r => r.family_id).filter(Boolean))];
  const reviewedCurrent = records.find(r => r.current_generation_candidate && r.reviewed_generation_ready && r.family_id && reviewedDetailPaths[r.family_id]);
  const group = {
    catalog_id: catalogId,
    maker,
    source_makers: sourceMakers,
    model,
    source_status: 'active',
    first_seen_at: previousById.get(catalogId)?.first_seen_at || today,
    last_seen_at: today,
    removed_at: null,
    row_count: records.length,
    vehicle_classes: [...new Set(records.map(r => r.vehicle_class).filter(Boolean))],
    types: [...new Set(records.map(r => r.type).filter(Boolean))],
    family_ids: families,
    has_current_generation_candidate: records.some(r => r.current_generation_candidate),
    reviewed_detail_path: reviewedCurrent ? reviewedDetailPaths[reviewedCurrent.family_id] : null,
    records
  };
  group.signature = signature(group);
  const prev = previousById.get(catalogId);
  if (!prev) {
    group.change_status = 'added';
    added.push(catalogId);
  } else if (prev.signature !== group.signature || prev.source_status !== 'active') {
    group.change_status = 'changed';
    changed.push(catalogId);
  } else {
    group.change_status = 'unchanged';
    unchanged.push(catalogId);
  }
  activeGroups.push(group);
}

const currentIds = new Set(activeGroups.map(g => g.catalog_id));
const archivedGroups = [];
const removed = [];
for (const prev of previous.groups || []) {
  if (currentIds.has(prev.catalog_id)) continue;
  const archived = {
    ...prev,
    source_status: 'removed_from_latest',
    change_status: prev.source_status === 'removed_from_latest' ? 'unchanged_archived' : 'removed',
    removed_at: prev.removed_at || today
  };
  if (archived.change_status === 'removed') removed.push(archived.catalog_id);
  archivedGroups.push(archived);
}

const groups = [...activeGroups, ...archivedGroups].sort((a,b) => {
  if (a.source_status !== b.source_status) return a.source_status === 'active' ? -1 : 1;
  return sortText(a.maker,b.maker) || sortText(a.model,b.model);
});

const makerStats = new Map();
for (const g of activeGroups) makerStats.set(g.maker, (makerStats.get(g.maker) || 0) + 1);
const catalog = {
  schema_version: 2,
  grouping_version: GROUPING_VERSION,
  generated_at: generatedAt,
  source_fetched_at: merged.fetched_at || null,
  source_rows: merged.display_source_rows || (merged.rows || []).length,
  active_group_count: activeGroups.length,
  archived_group_count: archivedGroups.length,
  total_group_count: groups.length,
  active_record_count: activeGroups.reduce((n,g) => n + g.records.length, 0),
  maker_count: makerStats.size,
  makers: [...makerStats.entries()].map(([maker,count]) => ({maker,count})).sort((a,b) => b.count-a.count || sortText(a.maker,b.maker)),
  policy: 'All KEA source rows are searchable, including exact duplicate source rows as separate row instances. Stable model IDs depend only on source maker + source model. Detailed SEO/model pages remain quality-gated; missing groups are archived rather than silently deleted.',
  groups
};
const delta = {
  schema_version: 2,
  grouping_version: GROUPING_VERSION,
  generated_at: generatedAt,
  source_fetched_at: catalog.source_fetched_at,
  baseline_reset: previousRaw.grouping_version !== GROUPING_VERSION,
  added_count: added.length,
  changed_count: changed.length,
  removed_count: removed.length,
  unchanged_count: unchanged.length,
  added_group_ids: added,
  changed_group_ids: changed,
  removed_group_ids: removed
};
const status = {
  ok: true,
  grouping_version: GROUPING_VERSION,
  generated_at: generatedAt,
  active_groups: catalog.active_group_count,
  archived_groups: catalog.archived_group_count,
  active_records: catalog.active_record_count,
  makers: catalog.maker_count,
  added: delta.baseline_reset ? 0 : delta.added_count,
  changed: delta.baseline_reset ? 0 : delta.changed_count,
  removed: delta.baseline_reset ? 0 : delta.removed_count,
  baseline_reset: delta.baseline_reset
};

fs.mkdirSync(path.dirname(outPath), {recursive:true});
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2) + '\n');
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
console.log(`All-car catalog: ${catalog.active_group_count} active groups / ${catalog.active_record_count} active rows / +${status.added} ~${status.changed} -${status.removed}${status.baseline_reset?' (baseline reset)':''}`);

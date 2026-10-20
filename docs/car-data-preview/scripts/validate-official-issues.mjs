import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeRows, sha256, validateAliases, rawSnapshotPath, exactKey, buildIndex} from './official-issues-data.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.OFFICIAL_ISSUES_DATA_DIR || path.join(root, 'car-data-preview/data/official-issues');
const indexFile = process.env.OFFICIAL_ISSUES_INDEX_FILE || path.join(root, 'docs/car-data-preview/data/generated/official-issues-index.json');
const statusFile = process.env.OFFICIAL_ISSUES_STATUS_FILE || path.join(root, 'docs/car-data-preview/data/generated/official-issues-status.json');
const catalogFile = process.env.OFFICIAL_ISSUES_CATALOG_FILE || path.join(root, 'docs/car-data-preview/data/generated/catalog-list-index.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = condition => {if (!condition) throw new Error('Official issue data validation failed');};
const index = read(indexFile), catalog = read(catalogFile), aliases = read(path.join(dataDir, 'aliases-reviewed.json'));
const manifests = read(path.join(dataDir, 'source-manifest.json')).sources;
const aliasMap = validateAliases(aliases, catalog.families);
const snapshots = {};
fail(index.schema_version === 1 && Array.isArray(index.families));
fail(index.families.length === catalog.families.length && new Set(index.families.map(f => f.family_id)).size === index.families.length);
const catalogIds = new Set(catalog.families.map(f => f.family_id));
for (const f of index.families) {
  fail(catalogIds.has(f.family_id) && ['verified', 'unmapped'].includes(f.match_status));
  fail(Number.isInteger(f.report_count) && f.report_count >= 0);
  fail(f.by_model_year.reduce((n, r) => n + r.count, 0) === f.report_count);
  fail(f.by_received_month.reduce((n, r) => n + r.count, 0) === f.report_count);
  fail(f.reports.reduce((n, r) => n + r.count, 0) === f.report_count);
  fail(f.reports.every(r => Number.isInteger(r.model_year) && /^\d{4}-\d{2}$/.test(r.received_month) && Number.isInteger(r.count) && r.count > 0));
  fail(f.match_status === 'verified' || f.report_count === 0 && f.historical_recalls.length === 0);
  for (const r of f.historical_recalls) fail(r.source_url === index.sources.recalls.source_url && r.production_from <= r.production_to && r.reason && r.model && r.id);
}
for (const kind of ['reports', 'recalls']) {
  const s = index.sources[kind];
  fail(s.dataset_id === (kind === 'reports' ? '15016450' : '3048950'));
  fail(s.source_url === `https://www.data.go.kr/data/${s.dataset_id}/fileData.do`);
  fail(s.rows === s.matched_rows + s.unmatched_rows + s.held_rows && s.unmatched_rows === index.unmatched_summary[kind].rows);
  const displayed = kind === 'reports' ? index.families.reduce((n, f) => n + f.report_count, 0) : index.families.reduce((n, f) => n + f.historical_recalls.length, 0);
  fail(displayed === s.matched_rows);
  if (!s.available) {fail(s.coverage_status === 'unavailable' && s.rows === 0 && s.sha256 === null); continue;}
  fail(s.coverage_status === 'observed_only' && s.duplicate_policy === 'preserve_source_rows');
  const bytes = fs.readFileSync(rawSnapshotPath(dataDir, kind, manifests[kind], path));
  const snapshot = normalizeRows(bytes, kind);
  snapshots[kind] = {...snapshot, sha256: s.sha256};
  fail(sha256(bytes) === s.sha256 && snapshot.rows === s.rows && snapshot.held.length === s.held_rows);
  fail(JSON.stringify(snapshot.period) === JSON.stringify(s.period));
  fail(snapshot.normalized.filter(r => aliasMap.has(`${exactKey(r.maker)}\0${exactKey(r.model)}`)).length === s.matched_rows);
  fail(Boolean(s.checked_at) && Boolean(s.content_changed_at));
}
// Check each family/month/year partition against the source, not just equal grand totals.
const rebuilt = buildIndex({families: catalog.families, aliases, snapshots, manifests, previous: index});
fail(JSON.stringify(rebuilt) === JSON.stringify(index));
if (process.argv.includes('--require-source-health')) {
  const status = read(statusFile);
  fail(status.schema_version === 1 && status.ok === true && status.source_states?.reports?.ok === true && status.source_states?.recalls?.ok === true);
  fail(Object.values(index.sources).every(s => s.available));
}
console.log(JSON.stringify({ok: true, families: index.families.length, reports: index.sources.reports.rows, recalls: index.sources.recalls.rows, matched_reports: index.sources.reports.matched_rows, held_reports: index.sources.reports.held_rows}));

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildIndex, normalizeRows, sha256, rawSnapshotPath} from './official-issues-data.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.OFFICIAL_ISSUES_DATA_DIR || path.join(root, 'car-data-preview/data/official-issues');
const indexFile = process.env.OFFICIAL_ISSUES_INDEX_FILE || path.join(root, 'docs/car-data-preview/data/generated/official-issues-index.json');
const catalogFile = process.env.OFFICIAL_ISSUES_CATALOG_FILE || path.join(root, 'docs/car-data-preview/data/generated/catalog-list-index.json');
const read = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
const config = read(path.join(dataDir, 'sources.json'), null);
const manifest = read(path.join(dataDir, 'source-manifest.json'), {sources: {}});
const aliases = read(path.join(dataDir, 'aliases-reviewed.json'), {schema_version: 1, entries: []});
const previous = read(indexFile, null);
const snapshots = {}, manifests = {};
for (const kind of ['reports', 'recalls']) {
  manifests[kind] = manifest.sources[kind] || {...config[kind], available: false};
  const raw = rawSnapshotPath(dataDir, kind, manifests[kind], path);
  if (manifests[kind].available && !fs.existsSync(raw)) throw new Error(`${kind} last-good raw snapshot is missing; public aggregate was preserved`);
  if (!manifests[kind].available && previous?.sources?.[kind]?.available) throw new Error(`${kind} source manifest cannot downgrade an available public aggregate`);
  if (manifests[kind].available && fs.existsSync(raw)) {
    const bytes = fs.readFileSync(raw), digest = sha256(bytes);
    if (digest !== manifests[kind].sha256) throw new Error(`${kind} raw snapshot hash mismatch`);
    snapshots[kind] = {schema_version: 1, kind, sha256: digest, ...normalizeRows(bytes, kind)};
  }
}
const families = read(catalogFile, {families: []}).families;
if (!families.length) throw new Error('Official issues requires the existing family catalog');
const index = buildIndex({families, aliases, snapshots, manifests, previous});
fs.mkdirSync(path.dirname(indexFile), {recursive: true});
const text = JSON.stringify(index) + '\n';
const changed = !fs.existsSync(indexFile) || fs.readFileSync(indexFile, 'utf8') !== text;
if (changed) {fs.writeFileSync(`${indexFile}.tmp`, text); fs.renameSync(`${indexFile}.tmp`, indexFile);}
console.log(JSON.stringify({ok: true, changed, families: index.families.length, reports: index.sources.reports, recalls: index.sources.recalls}));

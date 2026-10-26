import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeCsv, normalizeRows, sha256, assertSnapshotQuality, rawSnapshotPath} from './official-issues-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.OFFICIAL_ISSUES_DATA_DIR || path.join(root, 'car-data-preview/data/official-issues');
const statusFile = process.env.OFFICIAL_ISSUES_STATUS_FILE || path.join(root, 'docs/car-data-preview/data/generated/official-issues-status.json');
const read = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); const temp = `${file}.tmp`; fs.writeFileSync(temp, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temp, file);};
const config = read(path.join(dataDir, 'sources.json'), null);
if (config?.schema_version !== 1) throw new Error('Official issues source configuration is missing');
const manifestFile = path.join(dataDir, 'source-manifest.json');
const previous = read(manifestFile, {schema_version: 1, sources: {}});
const oldStatus = read(statusFile, {});
const checkedAt = new Date().toISOString();
const next = structuredClone(previous); const sourceStates = {}; const errors = [];

// Keep enough information to distinguish connection, TLS and parsing failures
// without publishing request URLs, response bodies, arbitrary messages or stacks.
const safeErrorNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError', 'AggregateError']);
const safeErrorCodes = new Set(['ABORT_ERR', 'EACCES', 'EPERM', 'ENOENT', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER']);
const stageMessages = {metadata: 'Official dataset metadata request or validation failed', csv: 'Official CSV download failed', snapshot: 'Official CSV snapshot validation failed', storage: 'Official snapshot storage failed'};
function failureDiagnostics(error, stage) {
  const diagnostics = {stage, error_name: safeErrorNames.has(error?.name) ? error.name : 'Error'};
  if (safeErrorCodes.has(error?.code)) diagnostics.error_code = error.code;
  if (safeErrorCodes.has(error?.cause?.code)) diagnostics.cause_code = error.cause.code;
  if (Number.isInteger(error?.http_status) && error.http_status >= 100 && error.http_status <= 599) diagnostics.http_status = error.http_status;
  return diagnostics;
}

async function request(url, binary = false) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !['data.go.kr', 'www.data.go.kr'].includes(u.hostname) || u.username || u.password) throw new Error('Unexpected official source host');
  const response = await fetch(u, {headers: {accept: binary ? '*/*' : 'text/html', 'user-agent': 'PeekMyCarOfficialIssues/1.0 (+https://peekmycar.com/data-sources/)'}, signal: AbortSignal.timeout(45000), redirect: 'error'});
  if (!response.ok) throw Object.assign(new Error('Official source HTTP failure'), {http_status: response.status});
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}

export function discoverDistribution(html, datasetId) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let item; try {item = JSON.parse(block[1]);} catch {continue;}
    const nodes = Array.isArray(item) ? item : item['@graph'] || [item];
    for (const d of nodes) {
      if (d['@type'] !== 'Dataset' || !String(d.url || '').includes(`/data/${datasetId}/`)) continue;
      const csv = (Array.isArray(d.distribution) ? d.distribution : [d.distribution]).find(v => v && /^csv$/i.test(v.encodingFormat));
      if (!csv?.contentUrl) throw new Error('Official CSV distribution is missing');
      const url = new URL(csv.contentUrl);
      if (!['www.data.go.kr', 'data.go.kr'].includes(url.hostname) || url.protocol !== 'https:' || url.pathname !== '/cmm/cmm/fileDownload.do' || !/^FILE_\d+$/.test(url.searchParams.get('atchFileId') || '')) throw new Error('Unrecognized official CSV distribution');
      return {download_url: url.href, provider_updated_at: /^\d{4}-\d{2}-\d{2}$/.test(d.dateModified || '') ? d.dateModified : null};
    }
  }
  throw new Error('Official dataset metadata is missing; no CAPTCHA or access restriction is bypassed');
}

// The collector is the only network step. Every successful response replaces a complete source snapshot.
for (const kind of ['reports', 'recalls']) {
  let stage = 'metadata';
  try {
    const source = config[kind];
    const html = await request(source.source_url);
    const distribution = discoverDistribution(html, source.dataset_id);
    stage = 'csv';
    const bytes = await request(distribution.download_url, true);
    stage = 'snapshot';
    if (bytes.length > 30_000_000) throw new Error('Official CSV exceeds the reviewable size limit');
    decodeCsv(bytes, kind);
    const normalized = normalizeRows(bytes, kind);
    const digest = sha256(bytes), before = previous.sources[kind];
    const changed = digest !== before?.sha256;
    const snapshot = {schema_version: 1, kind, sha256: digest, ...normalized};
    const priorRaw = before?.available ? rawSnapshotPath(dataDir, kind, before, path) : null;
    const priorBytes = priorRaw && fs.existsSync(priorRaw) ? fs.readFileSync(priorRaw) : null;
    if (priorBytes && sha256(priorBytes) !== before.sha256) throw new Error('Previous official raw snapshot hash is invalid');
    const priorSnapshot = priorBytes ? {...normalizeRows(priorBytes, kind), sha256: before.sha256} : null;
    assertSnapshotQuality(snapshot, priorSnapshot, source.reviewed_snapshot_exceptions || []);
    // Only write validated payloads. Failed fetch/schema checks leave the previous raw file and snapshot intact.
    stage = 'storage';
    const rawFile = `${kind}-${digest}.csv`;
    if (!fs.existsSync(path.join(dataDir, 'raw', rawFile))) write(path.join(dataDir, 'raw', rawFile), bytes);
    if (changed || !fs.existsSync(path.join(dataDir, `${kind}-snapshot.json`))) {
      write(path.join(dataDir, `${kind}-snapshot.json`), snapshot);
    }
    // Publish this pointer only after the immutable raw file has been written and validated.
    // A crash before the manifest rename leaves the old last-good pointer usable.
    next.sources[kind] = {...source, ...distribution, checked_at: checkedAt, last_successful_at: checkedAt, content_changed_at: changed ? checkedAt : before.content_changed_at, sha256: digest, raw_file: rawFile, rows: normalized.rows, available: true};
    sourceStates[kind] = {ok: true, available: true, changed, checked_at: checkedAt, last_successful_at: checkedAt, content_changed_at: next.sources[kind].content_changed_at, sha256: digest};
  } catch (error) {
    const message = stageMessages[stage], diagnostics = failureDiagnostics(error, stage);
    errors.push({source: kind, message, ...diagnostics});
    const last = previous.sources[kind];
    next.sources[kind] = last || {...config[kind], available: false, sha256: null, checked_at: null, last_successful_at: null, content_changed_at: null};
    sourceStates[kind] = {ok: false, available: Boolean(last?.available), changed: false, checked_at: checkedAt, last_successful_at: last?.last_successful_at || null, content_changed_at: last?.content_changed_at || null, sha256: last?.sha256 || null, error: message, error_diagnostics: diagnostics};
  }
}
write(manifestFile, next);
const ok = errors.length === 0;
const changedTimes = Object.values(next.sources).map(s => s.content_changed_at).filter(Boolean).sort();
write(statusFile, {schema_version: 1, ok, checked_at: checkedAt, last_successful_at: ok ? checkedAt : oldStatus.last_successful_at || null, content_changed_at: changedTimes.at(-1) || null, source_states: sourceStates, errors});
console.log(JSON.stringify({ok, changed: Object.values(sourceStates).some(s => s.changed), sources: Object.fromEntries(Object.entries(sourceStates).map(([kind, s]) => [kind, {ok: s.ok, available: s.available, changed: s.changed}])), ...(errors.length ? {errors} : {})}));
if (!ok) process.exitCode = 1;

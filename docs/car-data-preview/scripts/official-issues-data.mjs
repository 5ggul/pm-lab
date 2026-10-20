import crypto from 'node:crypto';

export const SOURCE_FIELDS = {
  reports: ['접수일자', '제작사', '차명', '모델년도'],
  recalls: ['제작자', '차명', '생산기간(부터)', '생산기간(까지)', '리콜개시일', '리콜사유'],
};
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const exactKey = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

// RFC 4180-style quoted fields, including embedded commas, quotes and newlines.
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false, afterQuote = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else field += c;
      continue;
    }
    if (c === '"') { if (field || afterQuote) throw new Error('CSV unexpected quote'); quoted = true; continue; }
    if (afterQuote && c !== ',' && c !== '\r' && c !== '\n') throw new Error('CSV text after closing quote');
    if (c === ',') { row.push(field); field = ''; afterQuote = false; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v !== '')) rows.push(row);
      row = []; field = ''; afterQuote = false; continue;
    }
    field += c;
  }
  if (quoted) throw new Error('CSV unclosed quote');
  if (field || row.length || afterQuote) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

export function decodeCsv(bytes, kind) {
  if (!SOURCE_FIELDS[kind]) throw new Error('Unknown source kind');
  let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { text = new TextDecoder('euc-kr', {fatal: true}).decode(bytes); }
  if (/^\s*</.test(text)) throw new Error('Source returned HTML instead of CSV');
  const rows = parseCsv(text);
  const headers = rows.shift()?.map(v => v.trim());
  const expected = SOURCE_FIELDS[kind];
  if (!headers || headers.length !== expected.length || expected.some((v, i) => v !== headers[i])) throw new Error(`${kind} CSV schema changed`);
  if (!rows.length) throw new Error(`${kind} CSV is empty`);
  return rows.map((values, i) => ({line: i + 2, values, shape_valid: values.length === headers.length}));
}

export function isoDate(value) {
  const raw = String(value ?? '').trim();
  const m = raw.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === date ? date : null;
}

export function normalizeRows(bytes, kind) {
  const rows = decodeCsv(bytes, kind), normalized = [], held = [];
  for (const row of rows) {
    const v = row.values.map(s => s.trim());
    const reason = !row.shape_valid ? 'column_count' : !v[0] || !v[1] ? 'missing_identity' : null;
    if (reason) { held.push({line: row.line, reason}); continue; }
    if (kind === 'reports') {
      const received = isoDate(v[0]);
      const year = /^\d{4}$/.test(v[3]) && +v[3] >= 1900 && +v[3] <= 2200 ? +v[3] : null;
      if (!received || !v[2] || !year) { held.push({line: row.line, reason: !received ? 'invalid_received_date' : !year ? 'invalid_model_year' : 'missing_model'}); continue; }
      normalized.push({source_row: row.line, received_date: received, maker: v[1], model: v[2], model_year: year});
    } else {
      const start = isoDate(v[2]), end = isoDate(v[3]), recall = isoDate(v[4]);
      if (!start || !end || !recall || start > end || !v[5]) { held.push({line: row.line, reason: 'invalid_recall_fields'}); continue; }
      normalized.push({source_row: row.line, maker: v[0], model: v[1], production_from: start, production_to: end, recall_start: recall, reason: v[5]});
    }
  }
  if (!normalized.length) throw new Error(`${kind} CSV contains no valid rows`);
  const dateField = kind === 'reports' ? 'received_date' : 'recall_start';
  const dates = normalized.map(r => r[dateField]).sort();
  return {rows: rows.length, normalized, held, period: {from: dates[0], to: dates.at(-1), basis: dateField}};
}

export function assertSnapshotQuality(snapshot, previous = null, reviewedExceptions = []) {
  if (!snapshot.rows || snapshot.normalized.length / snapshot.rows < 0.95) throw new Error('Official CSV valid-row coverage fell below 95%');
  if (!previous) return;
  const reviewed = reviewedExceptions.some(e => e.sha256 === snapshot.sha256 && /^\d{4}-\d{2}-\d{2}$/.test(e.reviewed_at || '') && String(e.evidence || '').trim().length >= 10);
  const majorCountChange = snapshot.rows < previous.rows * 0.75 || snapshot.rows > previous.rows * 4;
  const periodRegressed = snapshot.period.to < previous.period.to;
  if (!reviewed && (majorCountChange || periodRegressed)) throw new Error('Official CSV scope changed substantially; exact snapshot review is required');
}

export function rawSnapshotPath(dataDir, kind, manifest, pathModule) {
  const name = manifest?.raw_file || `${kind}.csv`;
  if (name !== `${kind}.csv` && !new RegExp(`^${kind}-[a-f0-9]{64}\\.csv$`).test(name)) throw new Error('Invalid official raw snapshot pointer');
  return pathModule.join(dataDir, 'raw', name);
}

export function validateAliases(aliases, families) {
  if (aliases.schema_version !== 1 || !Array.isArray(aliases.entries)) throw new Error('Invalid alias schema');
  const ids = new Set(families.map(f => f.family_id)); const keys = new Map();
  for (const a of aliases.entries) {
    if (!ids.has(a.family_id) || !a.maker || !a.model || a.status !== 'verified' || !a.reviewed_at || !a.evidence) throw new Error('Invalid reviewed alias');
    const key = `${exactKey(a.maker)}\0${exactKey(a.model)}`;
    if (keys.has(key) && keys.get(key) !== a.family_id) throw new Error('Ambiguous reviewed alias');
    keys.set(key, a.family_id);
  }
  return keys;
}

export function aggregateSource(normalized, aliasMap, kind) {
  const matched = [], unmatched = [];
  for (const row of normalized) {
    const family_id = aliasMap.get(`${exactKey(row.maker)}\0${exactKey(row.model)}`);
    (family_id ? matched : unmatched).push(family_id ? {...row, family_id} : row);
  }
  return {matched, unmatched};
}

export function groupCount(rows, key, property) {
  const groups = new Map(); for (const row of rows) groups.set(key(row), (groups.get(key(row)) || 0) + 1);
  return [...groups].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([value, count]) => ({[property]: value, count}));
}

export function buildIndex({families, aliases, snapshots, manifests, previous = null}) {
  const aliasMap = validateAliases(aliases, families), sources = {}, partitions = {};
  for (const kind of ['reports', 'recalls']) {
    const manifest = manifests[kind], snapshot = snapshots[kind];
    const available = Boolean(snapshot && manifest?.available !== false && manifest?.sha256 === snapshot.sha256);
    const partition = available ? aggregateSource(snapshot.normalized, aliasMap, kind) : {matched: [], unmatched: []};
    partitions[kind] = partition;
    const unchanged = available && previous?.sources?.[kind]?.sha256 === snapshot.sha256;
    sources[kind] = {
      dataset_id: manifest.dataset_id, source_url: manifest.source_url, available,
      coverage_status: available ? 'observed_only' : 'unavailable',
      period: available ? snapshot.period : {from: null, to: null, basis: kind === 'reports' ? 'received_date' : 'recall_start'},
      declared_period: manifest.declared_period ?? null,
      provider_updated_at: manifest.provider_updated_at ?? null,
      // Latest check lives in official-issues-status.json. Keep this content snapshot stable when only a check changes.
      checked_at: unchanged ? previous.sources[kind].checked_at : manifest.checked_at ?? null,
      content_changed_at: manifest.content_changed_at ?? null, sha256: available ? snapshot.sha256 : null,
      rows: available ? snapshot.rows : 0, matched_rows: partition.matched.length,
      unmatched_rows: partition.unmatched.length, held_rows: available ? snapshot.held.length : 0,
      duplicate_policy: 'preserve_source_rows', refresh_interval: 'annual',
    };
  }
  const verifiedIds = new Set(aliases.entries.map(a => a.family_id));
  const outputFamilies = families.map(f => {
    const reports = partitions.reports.matched.filter(r => r.family_id === f.family_id);
    const recalls = partitions.recalls.matched.filter(r => r.family_id === f.family_id);
    const cross = new Map(); for (const row of reports) { const key = `${row.model_year}|${row.received_date.slice(0, 7)}`; cross.set(key, (cross.get(key) || 0) + 1); }
    return {
      family_id: f.family_id, maker: f.maker, name: f.family_name,
      match_status: verifiedIds.has(f.family_id) ? 'verified' : 'unmapped',
      source_names: [...new Set([...reports, ...recalls].map(r => r.model))].sort(),
      report_count: reports.length,
      by_model_year: groupCount(reports, r => r.model_year, 'year'),
      by_received_month: groupCount(reports, r => r.received_date.slice(0, 7), 'month'),
      reports: [...cross].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => { const [year, month] = key.split('|'); return {model_year: +year, received_month: month, count}; }),
      historical_recalls: recalls.map(r => ({id: `official-${manifests.recalls.dataset_id}-${r.source_row}-${sha256(JSON.stringify(r)).slice(0, 12)}`, maker: r.maker, model: r.model, production_from: r.production_from, production_to: r.production_to, recall_start: r.recall_start, reason: r.reason, source_url: manifests.recalls.source_url})),
    };
  }).sort((a, b) => a.maker.localeCompare(b.maker, 'ko') || a.name.localeCompare(b.name, 'ko'));
  return {
    schema_version: 1, sources, families: outputFamilies,
    makers: [...new Set(families.map(f => f.maker))].sort((a,b) => a.localeCompare(b, 'ko')).map(name => ({id: name, name})),
    unmatched_summary: Object.fromEntries(['reports', 'recalls'].map(kind => [kind, {
      rows: partitions[kind].unmatched.length,
      models: groupCount(partitions[kind].unmatched, r => `${r.maker}\0${r.model}`, 'key').map(({key, count}) => {const [maker, model] = key.split('\0'); return {maker, model, count};}),
      held_reasons: snapshots[kind] ? groupCount(snapshots[kind].held, r => r.reason, 'reason') : [],
    }])),
    notice: '공식 접수 기록은 확정 결함이나 고장률이 아닙니다. 제공 파일에 포함된 기간·차명 범위만 집계하며, 세대·엔진을 추정하지 않습니다.',
  };
}

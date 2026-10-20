import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const COPY_META_KEYS = [
  'platform', 'contentIdentity', 'intent', 'styleMode', 'titleStrategy', 'bodyStrategy', 'skeleton',
  'titleOpeningKey', 'openingKey', 'closingKey', 'sentenceCount', 'sentenceLengthPattern',
  'endingForms', 'repeatedEndingPairs', 'linkPosition', 'cuteEndingCount', 'ctaCount',
  'emojiCount', 'rhythmSignature', 'normalizedTitle', 'normalizedBody', 'layoutFamily',
  'surfaceFamily', 'leadFamily', 'paragraphPattern', 'closingFamily', 'frameSignature', 'managedSurface'
];
const pickCopyMeta = value => Object.fromEntries(COPY_META_KEYS.flatMap(key => {
  const data = value?.[key];
  if (['string', 'number', 'boolean'].includes(typeof data)) return [[key, data]];
  if (Array.isArray(data) && data.every(x => ['string', 'number', 'boolean'].includes(typeof x))) return [[key, [...data]]];
  return [];
}));

function expectedSnapshot(item) {
  const content = { title: String(item.postTitle || ''), body: String(item.postBody || ''), board: String(item.board || '') };
  return {
    version: 1,
    ...content,
    contentSha256: createHash('sha256').update(JSON.stringify(content), 'utf8').digest('hex'),
    type: item.type || null,
    contentKind: item.copyContext?.kind || null,
    category: item.copyContext?.category || null,
    intent: item.copyContext?.intent || null,
    semanticKey: item.semanticKey || item.id || null,
    sellerKey: item.sellerKey || null,
    sourceStore: item.sourceStore || null,
    copyMeta: pickCopyMeta(item.copyMeta),
    imagePolicy: { required: item.imageRequired === true, usageApproved: item.imageUsageApproved === true }
  };
}

function savedVerification(value) {
  if (!value || typeof value !== 'object') return null;
  const evidence = {};
  for (const key of ['expectedBoard', 'observedBoard', 'expectedImageCount', 'observedImageCount', 'normalizedTitleSha256', 'normalizedBodySha256', 'postUrl', 'datePublished', 'submissionStartedAt', 'observedAt', 'navigationSource']) {
    const data = value.evidence?.[key];
    if (data === null || ['string', 'number', 'boolean'].includes(typeof data)) evidence[key] = data;
  }
  if (value.evidence?.parserDiagnostics) {
    evidence.parserDiagnostics = Object.fromEntries(['articleCount', 'streamChunkCount', 'detailEventCount', 'matchingDetailEventCount', 'distinctBoardCount'].flatMap(key => {
      const n = value.evidence.parserDiagnostics[key];
      return Number.isSafeInteger(n) && n >= 0 ? [[key, n]] : [];
    }));
  }
  return {
    ok: value.ok === true,
    status: ['published', 'publish_unknown'].includes(value.status) ? value.status : 'publish_unknown',
    errors: Array.isArray(value.errors) ? value.errors.filter(x => typeof x === 'string').slice(0, 30) : [],
    evidence
  };
}

const observedTime = values => {
  for (const value of values) if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  return null;
};
const canonicalPostUrl = value => {
  try { const url = new URL(value); return url.origin + decodeURIComponent(url.pathname).replace(/\/$/, ''); }
  catch { return null; }
};

/** Submission history is for conservative capacity and copy diversity only, never success metrics. */
export function submissionHistory(published = [], ledger = {}) {
  const candidates = published.filter(row => row?.status === 'published').map(row => ({
    ...structuredClone(row),
    submittedAt: observedTime([row.publishedAt, row.submittedAt]),
    historySource: 'confirmed_index'
  }));
  for (const [slot, entry] of Object.entries(ledger)) {
    if (!entry || !['published', 'publishing', 'publish_unknown'].includes(entry.status)) continue;
    const record = entry.status === 'published' && entry.record ? structuredClone(entry.record) : {};
    const expected = entry.expectedSnapshot || {};
    const row = {
      ...record,
      status: entry.status,
      title: record.title ?? expected.title ?? entry.title ?? null,
      sourceUrl: record.sourceUrl ?? entry.sourceUrl ?? null,
      postUrl: record.postUrl ?? entry.postUrl ?? null,
      idempotencyKey: record.idempotencyKey ?? entry.key ?? null,
      submittedAt: observedTime([record.publishedAt, entry.startedAt, entry.finishedAt]),
      historySlot: slot,
      historySource: entry.status === 'published' ? 'confirmed_ledger' : 'unconfirmed_submission'
    };
    if (typeof record.bodyText !== 'string' && typeof expected.body === 'string') row.bodyText = expected.body;
    for (const [key, source] of Object.entries({ type: 'type', contentKind: 'contentKind', topic: 'category', intent: 'intent', semanticKey: 'semanticKey', sellerKey: 'sellerKey', sourceStore: 'sourceStore', board: 'board' })) {
      if (row[key] == null && expected[source] != null) row[key] = expected[source];
      else if (row[key] == null && entry[key] != null) row[key] = entry[key];
    }
    if (!row.copyMeta && expected.copyMeta) row.copyMeta = pickCopyMeta(expected.copyMeta);
    candidates.push(row);
  }

  // Known distinct post URLs remain separate even if an old key was reused.
  // A URL-less reservation can still merge with the confirmed record for its key.
  const groups = [];
  const aliases = new Map();
  const priority = row => row.status === 'published' ? (row.historySource === 'confirmed_index' ? 3 : 2) : 1;
  for (const row of candidates.sort((a, b) => priority(b) - priority(a))) {
    const url = canonicalPostUrl(row.postUrl);
    const keys = [url && 'url:' + url, row.idempotencyKey && 'key:' + row.idempotencyKey, row.historySlot && 'slot:' + row.historySlot].filter(Boolean);
    const possible = [...new Set(keys.flatMap(key => [...(aliases.get(key) || [])]))]
      .filter(group => group.active!==false && (!url || !group.url || group.url === url));
    let group = possible[0];
    if (!group) { group = { row, url }; groups.push(group); }
    else {
      // Preserve the higher-confidence row; enrich only missing observations.
      for (const [key, value] of Object.entries(row)) if (group.row[key] == null && value != null) group.row[key] = structuredClone(value);
      if (!group.url) group.url = url;
    }
    for (const other of possible.slice(1)) {
      if (group.url && other.url && group.url !== other.url) continue;
      for (const [key, value] of Object.entries(other.row)) if (group.row[key] == null && value != null) group.row[key] = structuredClone(value);
      if (!group.url) group.url = other.url;
      other.active = false;
      for (const values of aliases.values()) if (values.delete(other)) values.add(group);
    }
    for (const key of keys) {
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key).add(group);
    }
  }
  return groups.filter(group => group.active!==false).map(group => group.row).sort((a, b) => {
    const left = Date.parse(a.submittedAt || ''), right = Date.parse(b.submittedAt || '');
    // Undated active reservations remain visible at the end for conservative handling.
    return (Number.isFinite(left) ? left : Infinity) - (Number.isFinite(right) ? right : Infinity);
  });
}

export async function readState(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return structuredClone(fallback); throw error; }
}
export async function saveState(file, value) {
  const temporary = file + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temporary, file);
}

// A durable reservation MUST reach main before the external publish click.
// A killed runner leaves "publishing" behind, requiring reconciliation.
export async function persistJournal(file, journal, { env = process.env, fetcher = fetch } = {}) {
  await saveState(file, journal);
  if (env.GITHUB_ACTIONS !== 'true') return;
  if (env.GITHUB_EVENT_NAME === 'pull_request' || env.GITHUB_REF !== 'refs/heads/main') throw new Error('PUBLISH_REQUIRES_MAIN');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) throw new Error('DURABLE_JOURNAL_AUTH_MISSING');
  const endpoint = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/ops/daangn-cloud/state/publish-ledger.json`;
  const headers = { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' };
  const current = await fetcher(endpoint + '?ref=main', { headers, signal: AbortSignal.timeout(20000) });
  if (!current.ok && current.status !== 404) throw new Error(`JOURNAL_READ_${current.status}`);
  const existing = current.ok ? await current.json() : null;
  const response = await fetcher(endpoint, { method: 'PUT', headers, signal: AbortSignal.timeout(20000), body: JSON.stringify({
    message: 'chore: persist Daangn publish reservation [skip ci]', branch: 'main', ...(existing ? { sha: existing.sha } : {}),
    content: Buffer.from(JSON.stringify(journal, null, 2) + '\n').toString('base64')
  }) });
  if (!response.ok) throw new Error(`JOURNAL_WRITE_${response.status}`);
}

export async function runReservedPublish({ item, key, slot, journal, persist, publish, now = () => new Date() }) {
  if (Object.values(journal).some(e => e.key === key && ['publishing', 'publish_unknown', 'published'].includes(e.status))) return { status: 'blocked_reservation' };
  const previous = journal[slot];
  journal[slot] = { key, status: 'publishing', attempts: (previous?.attempts || 0) + 1, sourceUrl: item.sourceUrl, title: item.postTitle, expectedSnapshot: expectedSnapshot(item), startedAt: now().toISOString() };
  await persist();
  let result;
  try { result = await publish(item); }
  catch (error) {
    // Only a positively identified pre-submit failure may be retried.
    result = { status: error.beforeSubmit === true ? 'technical_failure' : 'publish_unknown', reason: String(error.message).slice(0, 160) };
  }
  const status = result.status === 'needs_review' ? 'publish_unknown' : result.status;
  journal[slot] = {
    ...journal[slot], status, postUrl: result.postUrl || null, reason: result.reason || null,
    imageAttached: typeof result.imageAttached === 'boolean' ? result.imageAttached : null,
    savedVerification: savedVerification(result.savedVerification),
    finishedAt: now().toISOString()
  };
  if (status === 'published') {
    journal[slot].record = {
      status, postUrl: result.postUrl, publishedAt: now().toISOString(), title: item.postTitle, bodyText: item.postBody,
      sourceUrl: item.sourceUrl, sourceStore: new URL(item.buyUrl || item.sourceUrl).hostname.replace(/^www\./, ''), sellerKey: item.sellerKey,
      type: item.type, board: result.board || item.board, imageAttached: result.imageAttached === true, topic: item.copyContext?.category || item.copyContext?.intent || item.type,
      intent: item.copyContext?.intent, semanticKey: item.semanticKey || item.id, idempotencyKey: key,
      editorialPlan: item.editorialPlan, styleMode: item.styleMode, titleStrategy: item.titleStrategy,
      expiresAt:item.expiresAt||null, sourceFingerprint:item.verification?.fingerprint||null, savedVerification:result.savedVerification||null,
      copyMeta: item.copyMeta, qualityScores: item.qualityScores, verification: item.verification, contentVersion: item.contentVersion || '1', priceRecord: item.priceRecord, contentKind: item.copyContext?.kind
    };
  }
  await persist();
  return { ...result, status };
}

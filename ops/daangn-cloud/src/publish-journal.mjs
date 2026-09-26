import fs from 'node:fs/promises';

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
  journal[slot] = { key, status: 'publishing', attempts: (previous?.attempts || 0) + 1, sourceUrl: item.sourceUrl, title: item.postTitle, startedAt: now().toISOString() };
  await persist();
  let result;
  try { result = await publish(item); }
  catch (error) {
    // Only a positively identified pre-submit failure may be retried.
    result = { status: error.beforeSubmit === true ? 'technical_failure' : 'publish_unknown', reason: String(error.message).slice(0, 160) };
  }
  const status = result.status === 'needs_review' ? 'publish_unknown' : result.status;
  journal[slot] = { ...journal[slot], status, postUrl: result.postUrl || null, reason: result.reason || null, finishedAt: now().toISOString() };
  if (status === 'published') {
    journal[slot].record = {
      status, postUrl: result.postUrl, publishedAt: now().toISOString(), title: item.postTitle, bodyText: item.postBody,
      sourceUrl: item.sourceUrl, sourceStore: new URL(item.buyUrl || item.sourceUrl).hostname.replace(/^www\./, ''),
      type: item.type, board: result.board || item.board, topic: item.copyContext?.category || item.copyContext?.intent || item.type,
      intent: item.copyContext?.intent, semanticKey: item.semanticKey || item.id, idempotencyKey: key,
      editorialPlan: item.editorialPlan, styleMode: item.styleMode, titleStrategy: item.titleStrategy,
      copyMeta: item.copyMeta, qualityScores: item.qualityScores, verification: item.verification, contentVersion: item.contentVersion || '1'
    };
  }
  await persist();
  return { ...result, status };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHotdeals, collectOfficial, collectEvents, canonicalSource } from './collectors.mjs';
import { collectServices, buildComparisons, buildDigest } from './editorial-sources.mjs';
import { planItem, slotFor, slotDecision, contentKey, chooseItem, kstDay, semanticTopic } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import { learningFactorForItem } from './learning-engine.mjs';
import { publishOne } from './publisher.mjs';
import { recheckItem } from './source-recheck.mjs';
import { readState, saveState, persistJournal, runReservedPublish } from './publish-journal.mjs';
import { sourceStore } from './quality-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'state');
const file = name => path.join(STATE, name + '.json');
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'growth-config.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(ROOT, 'source-registry.json'), 'utf8'));
const dry = process.argv.includes('--collect-only') || process.argv.includes('--preview') || process.env.GITHUB_EVENT_NAME === 'pull_request';
await fs.mkdir(STATE, { recursive: true });

async function cycle() {
  const now = new Date(), today = kstDay(now), slot = slotFor(now, config);
  const [published, reviews, priceHistory, ledger, weights, legacy, submissions] = await Promise.all([
    readState(file('published'), []), readState(file('needs-review'), []), readState(file('price-history'), {}),
    readState(file('publish-ledger'), {}), readState(file('learning-weights'), {}),
    readState(file('legacy-daily-counts'), {}), readState(file('member-submissions'), [])
  ]);
  // Recover a confirmed URL whose runner died before saving published.json.
  for (const entry of Object.values(ledger)) {
    if (entry.status === 'published' && entry.record && !published.some(p => p.postUrl === entry.record.postUrl)) published.push(entry.record);
  }
  if (!dry) await saveState(file('published'), published.slice(-1500));
  const persist = () => persistJournal(file('publish-ledger'), ledger);
  const decision = slotDecision(ledger, slot, config);
  if (!dry && !config.enabled) return { mode: 'growth_disabled', publishedThisRun: 0 };
  if (!dry && !decision.run) return { mode: decision.reason, slot, publishedThisRun: 0 };
  const todayPosts = published.filter(p => p.status === 'published' && kstDay(new Date(p.publishedAt)) === today);
  const legacyCount = typeof legacy[today] === 'number' ? legacy[today] : Number(legacy[today]?.total || 0);
  const already = todayPosts.length + legacyCount;
  if (!dry && already >= config.dailyMax) {
    ledger[slot] = { status: 'daily_cap', attempts: 0, finishedAt: now.toISOString() };
    await persist();
    return { mode: 'daily_cap', publishedToday: already, publishedThisRun: 0 };
  }
  const state = { priceHistory };
  const collectors = [
    ['hotdeals', () => collectHotdeals(state)], ['official', collectOfficial],
    ...(config.primaryRegions.length ? [['events', collectEvents]] : []),
    ...(config.features.publicServices ? [['services', () => collectServices(registry)]] : [])
  ];
  const results = await Promise.allSettled(collectors.map(([, fn]) => fn()));
  const collection = results.map((r, i) => ({ source: collectors[i][0], ok: r.status === 'fulfilled', count: r.status === 'fulfilled' ? r.value.length : 0, error: r.status === 'rejected' ? String(r.reason?.message).slice(0, 120) : null }));
  let items = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (config.features.memberSubmissions) items.push(...submissions.filter(x => x.reviewApproval && x.consent && x.verification?.status === 'verified'));
  if (config.features.comparisons) items.push(...buildComparisons(items, now));
  const oldBlocked = await readState(file('legacy-blocklist'), []);
  const blockedUrls = new Set([...published.map(x => x.sourceUrl), ...reviews.filter(x => ['needs_review', 'publish_unknown'].includes(x.status)).map(x => x.sourceUrl), ...oldBlocked].filter(Boolean).map(canonicalSource));
  const reservedKeys = new Set(Object.values(ledger).filter(x => ['publishing', 'publish_unknown', 'published'].includes(x.status)).map(x => x.key));
  const seen = new Set();
  const seenTopics = new Set(published.map(semanticTopic).filter(Boolean));
  const rejected = [], queue = [];
  const consider = item => {
    const key = contentKey(item), url = canonicalSource(item.sourceUrl);
    const topic = semanticTopic(item);
    if (seen.has(key) || reservedKeys.has(key) || blockedUrls.has(url) || seenTopics.has(topic)) return;
    seen.add(key);
    seenTopics.add(topic);
    const editorialPlan = planItem(item, config, new Date());
    const candidate = { ...item, semanticKey: topic, editorialPlan, idempotencyKey: key, queuedAt: now.toISOString(), status: 'queued' };
    if (editorialPlan.status !== 'eligible') rejected.push({ id: item.id, sourceUrl: item.sourceUrl, title: item.title || item.copyContext?.sourceTitle || item.copyContext?.name, status: 'editorial_review', reasons: editorialPlan.reasons, editorialPlan, createdAt: now.toISOString() });
    else queue.push(candidate);
  };
  items.forEach(consider);
  // One weekly roundup only when three distinct verified components exist.
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(now);
  if (config.features.digests && weekday === 'Fri') {
    const digest = buildDigest(queue, today, now);
    if (digest) consider(digest);
  }
  const recent = published.filter(p => p.status === 'published').slice(-100);
  const previews = queue.map(item => selectCommunityCopy(item, recent, 'daangn', weights));
  const report = { at: now.toISOString(), version: 4, mode: dry ? 'preview' : 'cycle', slot, publishedToday: already, collection, queueCount: queue.length, rejected, previews: previews.map(x => ({ id: x.id, title: x.postTitle, body: x.postBody, rejected: x.copyRejected, reasons: x.copyRejectReasons, editorialPlan: x.editorialPlan })) };
  await saveState(file('editorial-report'), report);
  await saveState(file('queue'), queue);
  await saveState(file('price-history'), priceHistory);
  const reviewMap = new Map(reviews.map(x => [x.id || x.sourceUrl, x]));
  rejected.forEach(x => { if (!['needs_review', 'publish_unknown'].includes(reviewMap.get(x.id)?.status)) reviewMap.set(x.id, x); });
  await saveState(file('needs-review'), [...reviewMap.values()].slice(-500));
  if (dry) return report;
  if (!process.env.DAANGN_AUTH_STATE_B64) return { ...report, mode: 'auth_missing', publishedThisRun: 0 };
  let pending = [...queue];
  while (pending.length) {
    const base = chooseItem(pending, recent, todayPosts, config, x => learningFactorForItem(x, weights));
    if (!base) break;
    pending = pending.filter(x => x.idempotencyKey !== base.idempotencyKey);
    const selected = selectCommunityCopy(base, recent, 'daangn', weights);
    if (selected.copyRejected) {
      rejected.push({ id: base.id, reasons: selected.copyRejectReasons, status: 'copy_rejected' });
      continue;
    }
    const recheck = await recheckItem(selected, registry);
    if (!recheck.ok) {
      rejected.push({ id: base.id, sourceUrl: base.sourceUrl, reasons: [recheck.reason], status: 'recheck_rejected' });
      continue;
    }
    const result = await runReservedPublish({ item: selected, key: selected.idempotencyKey, slot, journal: ledger, persist, publish: publishOne });
    if (result.status === 'published') {
      const record = {
        status: 'published', postUrl: result.postUrl, publishedAt: new Date().toISOString(), title: selected.postTitle, bodyText: selected.postBody,
        sourceUrl: selected.sourceUrl, sourceStore: sourceStore(selected.buyUrl || selected.sourceUrl), type: selected.type, board: result.board || selected.board,
        topic: selected.copyContext.category || selected.copyContext.intent || selected.type, intent: selected.copyContext.intent,
        semanticKey: selected.semanticKey || selected.id, idempotencyKey: selected.idempotencyKey, editorialPlan: selected.editorialPlan,
        styleMode: selected.styleMode, titleStrategy: selected.titleStrategy, copyMeta: selected.copyMeta, qualityScores: selected.qualityScores,
        verification: selected.verification, contentVersion: selected.contentVersion || '1'
      };
      ledger[slot].record = record;
      // Persist the recoverable record before saving the secondary index.
      await persist();
      published.push(record);
      await saveState(file('published'), published.slice(-1500));
      await saveState(file('queue'), pending);
    }
    if (['publish_unknown', 'technical_failure', 'auth_expired'].includes(result.status)) process.exitCode = 1;
    return { ...report, mode: result.status, result, rejected, publishedThisRun: result.status === 'published' ? 1 : 0 };
  }
  // Deliberate skips are terminal for this slot; backups cannot fill the gap.
  const status = collection.every(x => !x.ok) ? 'technical_failure' : queue.length ? 'quality_or_category_skip' : 'no_candidate';
  ledger[slot] = { status, attempts: (ledger[slot]?.attempts || 0) + 1, finishedAt: new Date().toISOString() };
  await persist();
  if (status === 'technical_failure') process.exitCode = 1;
  return { ...report, mode: status, rejected, publishedThisRun: 0 };
}

const lockPath = path.join(STATE, '.cycle.lock');
let lock;
try {
  lock = await fs.open(lockPath, 'wx');
  const report = await cycle();
  await saveState(file('editorial-report'), report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, reason: String(error.message) }));
  process.exitCode = 1;
} finally {
  if (lock) { await lock.close(); await fs.unlink(lockPath); }
}

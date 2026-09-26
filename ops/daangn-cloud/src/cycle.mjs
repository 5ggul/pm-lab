import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHotdeals, collectOfficial, collectEvents, canonicalSource, kstDate, normalizeTitle } from './collectors.mjs';
import { publishOne } from './publisher.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import { itemQuality, sourceStore } from './quality-engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STATE = path.join(ROOT, 'state');
const COLLECT_ONLY = process.argv.includes('--collect-only');
const DAILY_MAX = 15;
const DAILY_TYPE_CAPS = Object.freeze({
  hotdeal: 6,
  tip: 4,
  event: 3,
  life: 2,
  card: 2
});

const FILES = {
  queue: path.join(STATE, 'queue.json'),
  published: path.join(STATE, 'published.json'),
  reviews: path.join(STATE, 'needs-review.json'),
  priceHistory: path.join(STATE, 'price-history.json'),
  legacyBlocklist: path.join(STATE, 'legacy-blocklist.json'),
  legacyDailyCounts: path.join(STATE, 'legacy-daily-counts.json')
};

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return structuredClone(fallback); }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function titleKey(s = '') {
  return normalizeTitle(s)
    .toLowerCase()
    .replace(/[0-9,.]+원/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function publishedToday(published, today) {
  return published.filter(x => x.status === 'published' && kstDate(new Date(x.publishedAt)) === today);
}
function kstHour(d = new Date()) {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit'
  }).format(d);
  return Number(value);
}
function scheduledTargetCount(d = new Date()) {
  const hour = kstHour(d);
  if (hour < 8 || hour > 22) return 0;
  return Math.min(DAILY_MAX, hour - 7);
}
function score(item) {
  const q = itemQuality(item);
  const discountBonus = item.type === 'hotdeal' ? Math.min(80, Number(item.discountPct || 0) * 2) : 0;
  return q.qualityScore * 10 + q.audienceFitScore * 3 + discountBonus;
}
function selectForSlot(queue, slot, lastBoard, publishedTypeCounts = {}, recentPosts = []) {
  const sequence = [
    'hotdeal', 'tip', 'event', 'hotdeal', 'life',
    'hotdeal', 'tip', 'event', 'card', 'hotdeal',
    'tip', 'life', 'event', 'card', 'hotdeal'
  ];
  const preferred = sequence[slot % sequence.length];
  const fallback = [preferred, 'hotdeal', 'tip', 'event', 'life', 'card'];

  for (const type of [...new Set(fallback)]) {
    const cap = DAILY_TYPE_CAPS[type] ?? DAILY_MAX;
    if ((publishedTypeCounts[type] || 0) >= cap) continue;

    const recent3 = recentPosts.slice(-3);
    const recentStores = recent3
      .map(x => x.sourceStore || sourceStore(x.sourceUrl || ''))
      .filter(Boolean);
    const recentTopics = recent3
      .map(x => x.topic || x.intent || x.type || '')
      .filter(Boolean);
    const recentBoards = recentPosts.slice(-2).map(x => x.board).filter(Boolean);

    const candidates = queue
      .filter(x => x.type === type)
      .sort((a, b) => {
        const rank = x => {
          const store = sourceStore(x.buyUrl || x.sourceUrl || '');
          const topic = x.copyContext?.category || x.copyContext?.intent || x.type;
          const q = itemQuality(x);
          let penalty = 0;

          if (store && recentStores.includes(store)) penalty += 120;
          if (topic && recentTopics.length >= 2 && recentTopics.slice(-2).every(v => v === topic)) penalty += 100;
          if (x.board && recentBoards.length >= 2 && recentBoards.every(v => v === x.board)) penalty += 45;
          if (x.board && x.board === lastBoard) penalty += 12;

          return score(x) + q.utilityScore * 2 - penalty;
        };
        return rank(b) - rank(a);
      });

    if (candidates.length) return candidates[0];
  }

  return null;
}
async function safeCollect(label, fn) {
  try {
    const value = await fn();
    console.log(JSON.stringify({ stage: label, ok: true, count: value.length }));
    return value;
  } catch (e) {
    console.error(JSON.stringify({ stage: label, ok: false, error: String(e?.message || e) }));
    return [];
  }
}

function sourceSemanticKey(x) {
  return titleKey(
    x?.copyContext?.product ||
    x?.copyContext?.sourceTitle ||
    x?.copyContext?.name ||
    x?.title ||
    x?.sourceUrl ||
    ''
  );
}

function gateReason(x, blockedUrls, blockedTitles) {
  if (!x?.board || !x?.sourceUrl || !x?.copyContext?.kind) return 'missing_required';
  const q = itemQuality(x);
  if (!q.ok) return 'quality_gate:' + q.reasons.join(',');
  if (blockedUrls.has(canonicalSource(x.sourceUrl))) return 'source_already_used';
  const semanticKey = sourceSemanticKey(x);
  if (semanticKey && blockedTitles.has(semanticKey)) return 'topic_already_used';
  return '';
}
await fs.mkdir(STATE, { recursive: true });
const [published, reviews, priceHistory, legacyBlocklist, legacyDailyCounts] = await Promise.all([
  readJson(FILES.published, []),
  readJson(FILES.reviews, []),
  readJson(FILES.priceHistory, {}),
  readJson(FILES.legacyBlocklist, []),
  readJson(FILES.legacyDailyCounts, {})
]);

const state = { priceHistory };
const [hot, official, events] = await Promise.all([
  safeCollect('hotdeals', () => collectHotdeals(state)),
  safeCollect('official', () => collectOfficial()),
  safeCollect('events', () => collectEvents())
]);

const today = kstDate();
const blockedUrls = new Set([
  ...published.map(x => canonicalSource(x.sourceUrl)),
  ...reviews.filter(x => x.status !== 'copy_rejected').map(x => canonicalSource(x.sourceUrl)),
  ...legacyBlocklist.map(x => canonicalSource(x))
].filter(Boolean));
const blockedTitles = new Set([
  ...published.map(x => titleKey(x.title)),
  ...reviews.map(x => titleKey(x.title))
].filter(Boolean));

const collected = [...hot, ...official, ...events];
const rejected = [];
const fresh = collected.filter(x => {
  const reason = gateReason(x, blockedUrls, blockedTitles);
  if (reason) rejected.push({ type: x.type, title: x.copyContext?.product || x.copyContext?.sourceTitle || x.copyContext?.name || x.title || '', reason });
  return !reason;
});

const unique = [];
const seenUrls = new Set();
const seenTitles = new Set();
for (const x of fresh) {
  const u = canonicalSource(x.sourceUrl);
  const t = sourceSemanticKey(x);
  if (!u || !t) {
    rejected.push({ type: x.type, title: x.copyContext?.product || x.copyContext?.sourceTitle || x.copyContext?.name || '', reason: 'empty_dedupe_key' });
    continue;
  }
  if (seenUrls.has(u)) {
    rejected.push({ type: x.type, title: x.copyContext?.product || x.copyContext?.sourceTitle || x.copyContext?.name || '', reason: 'duplicate_source_in_cycle' });
    continue;
  }
  if (seenTitles.has(t)) {
    rejected.push({ type: x.type, title: x.copyContext?.product || x.copyContext?.sourceTitle || x.copyContext?.name || '', reason: 'duplicate_topic_in_cycle' });
    continue;
  }
  seenUrls.add(u); seenTitles.add(t);
  unique.push({ ...x, queuedAt: new Date().toISOString(), status: 'queued' });
}

const byType = unique.reduce((a, x) => {
  a[x.type] = (a[x.type] || 0) + 1;
  return a;
}, {});
console.log(JSON.stringify({
  stage: 'queue-built',
  collected: { hotdeal: hot.length, official: official.length, event: events.length },
  eligible: fresh.length,
  unique: unique.length,
  byType,
  rejected
}, null, 2));

await writeJson(FILES.queue, unique);
await writeJson(FILES.priceHistory, state.priceHistory);

const todayPosts = publishedToday(published, today);
const legacyEntry = legacyDailyCounts[today];
const legacyTodayCount = typeof legacyEntry === 'number'
  ? legacyEntry
  : Number(legacyEntry?.total || 0);
const legacyTypeCounts = typeof legacyEntry === 'object' && legacyEntry
  ? (legacyEntry.byType || {})
  : {};
const publishedTypeCounts = todayPosts.reduce((acc, x) => {
  acc[x.type] = (acc[x.type] || 0) + 1;
  return acc;
}, { ...legacyTypeCounts });
const publishedTodayCount = todayPosts.length + legacyTodayCount;
const eventName = process.env.GITHUB_EVENT_NAME || '';
const isTimedRun = eventName === 'schedule' || eventName === 'push';
const timedTarget = isTimedRun ? scheduledTargetCount() : null;

if (timedTarget !== null && timedTarget <= 0) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'outside-publish-window',
    date: today,
    publishedToday: publishedTodayCount
  }));
  process.exit(0);
}

if (timedTarget !== null && publishedTodayCount >= timedTarget) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'schedule-target-met',
    date: today,
    target: timedTarget,
    publishedToday: publishedTodayCount
  }));
  process.exit(0);
}

if (COLLECT_ONLY || !process.env.DAANGN_AUTH_STATE_B64) {
  console.log(JSON.stringify({
    ok: true,
    mode: COLLECT_ONLY ? 'collect-only' : 'auth-missing-collect-only',
    date: today,
    queue: unique.length,
    publishedToday: publishedTodayCount
  }, null, 2));
  process.exit(0);
}

if (publishedTodayCount >= DAILY_MAX) {
  console.log(JSON.stringify({ ok: true, mode: 'daily-cap', date: today, publishedToday: publishedTodayCount }));
  process.exit(0);
}

if (!unique.length) {
  console.log(JSON.stringify({ ok: true, mode: 'empty-queue', date: today }));
  process.exit(0);
}

const desiredCount = timedTarget !== null
  ? Math.min(DAILY_MAX, timedTarget)
  : Math.min(DAILY_MAX, publishedTodayCount + 1);
const maxPublishThisRun = timedTarget !== null
  ? Math.min(4, Math.max(0, desiredCount - publishedTodayCount))
  : 1;

let currentCount = publishedTodayCount;
let currentTypeCounts = { ...publishedTypeCounts };
let remainingQueue = [...unique];
let recentPosts = published.filter(x => x.status === 'published').slice(-100);
let lastBoard = todayPosts.at(-1)?.board || '';
let publishedThisRun = 0;
let reviewedThisRun = 0;
let attempts = 0;
let lastResult = null;

while (
  currentCount < desiredCount &&
  publishedThisRun < maxPublishThisRun &&
  remainingQueue.length &&
  attempts < 10
) {
  attempts += 1;

  const selectedBase = selectForSlot(
    remainingQueue,
    currentCount,
    lastBoard,
    currentTypeCounts,
    recentPosts
  );
  if (!selectedBase) break;

  const selected = selectCommunityCopy(selectedBase, recentPosts, 'daangn');

  if (selected.copyRejected) {
    const now = new Date().toISOString();
    reviews.push({
      status: 'copy_rejected',
      type: selected.type,
      board: selected.board,
      title: selected.copyContext?.product || selected.copyContext?.sourceTitle || selected.copyContext?.name || '',
      sourceUrl: selected.sourceUrl,
      reason: JSON.stringify(selected.copyRejectReasons || {}),
      renderCandidateCount: selected.renderCandidateCount || 0,
      createdAt: now
    });
    reviewedThisRun += 1;
    remainingQueue = remainingQueue.filter(x => x.id !== selected.id);
    await writeJson(FILES.reviews, reviews.slice(-500));
    await writeJson(FILES.queue, remainingQueue);
    console.log(JSON.stringify({
      stage: 'copy-rejected',
      type: selected.type,
      sourceUrl: selected.sourceUrl,
      reasons: selected.copyRejectReasons || {},
      renderCandidateCount: selected.renderCandidateCount || 0
    }, null, 2));
    continue;
  }

  console.log(JSON.stringify({
    stage: 'selected',
    slot: currentCount + 1,
    target: desiredCount,
    type: selected.type,
    board: selected.board,
    title: selected.postTitle,
    titleStrategy: selected.titleStrategy || null,
    bodyStrategy: selected.bodyStrategy || null,
    styleMode: selected.styleMode || null,
    skeleton: selected.copyMeta?.skeleton || null,
    qualityScores: selected.qualityScores || null,
    renderCandidateCount: selected.renderCandidateCount || 0
  }, null, 2));

  let result;
  try {
    result = await publishOne(structuredClone(selected));
  } catch (e) {
    console.error(JSON.stringify({ stage: 'publish', ok: false, error: String(e?.message || e) }));
    process.exitCode = 1;
    break;
  }
  lastResult = result;

  const now = new Date().toISOString();

  if (result.status === 'published') {
    const record = {
      status: 'published',
      type: selected.type,
      board: selected.board,
      title: selected.postTitle,
      sourceUrl: selected.sourceUrl,
      postUrl: result.postUrl,
      platform: selected.platform || 'daangn',
      intent: selected.copyContext?.intent || selected.type,
      styleMode: selected.styleMode || null,
      titleStrategy: selected.titleStrategy || null,
      bodyStrategy: selected.bodyStrategy || null,
      titlePattern: selected.titleStrategy || null,
      bodyPattern: selected.bodyStrategy || null,
      bodyText: selected.postBody,
      copyMeta: selected.copyMeta || null,
      qualityScores: selected.qualityScores || null,
      sourceStore: sourceStore(selected.buyUrl || selected.sourceUrl || ''),
      topic: selected.copyContext?.category || selected.copyContext?.intent || selected.type,
      renderCandidateCount: selected.renderCandidateCount || 0,
      publishedAt: now
    };

    published.push(record);
    recentPosts.push(record);
    currentCount += 1;
    publishedThisRun += 1;
    currentTypeCounts[selected.type] = (currentTypeCounts[selected.type] || 0) + 1;
    lastBoard = selected.board;
    remainingQueue = remainingQueue.filter(x => x.id !== selected.id);

    // Persist locally after every confirmed live post. The workflow's
    // always-run state step commits this even if a later item fails.
    await writeJson(FILES.published, published.slice(-1500));
    await writeJson(FILES.queue, remainingQueue);

    if (currentCount < desiredCount && publishedThisRun < maxPublishThisRun) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    continue;
  }

  if (result.status === 'needs_review') {
    reviews.push({
      status: 'needs_review',
      type: selected.type,
      board: selected.board,
      title: selected.postTitle,
      sourceUrl: selected.sourceUrl,
      reason: result.reason || '',
      copyMeta: selected.copyMeta || null,
      qualityScores: selected.qualityScores || null,
      createdAt: now
    });
    reviewedThisRun += 1;
    remainingQueue = remainingQueue.filter(x => x.id !== selected.id);
    await writeJson(FILES.reviews, reviews.slice(-500));
    await writeJson(FILES.queue, remainingQueue);
    continue;
  }

  if (result.status === 'auth_expired') {
    console.error('AUTH_EXPIRED: refresh DAANGN_AUTH_STATE_B64 before publishing can resume.');
    process.exitCode = 2;
    break;
  }

  if (result.status === 'auth_missing') {
    console.error('AUTH_MISSING');
    process.exitCode = 2;
    break;
  }

  remainingQueue = remainingQueue.filter(x => x.id !== selected.id);
}

console.log(JSON.stringify({
  ok: publishedThisRun > 0 || currentCount >= desiredCount,
  mode: currentCount >= desiredCount ? 'target-met' : 'target-partial',
  date: today,
  target: desiredCount,
  publishedToday: currentCount,
  publishedThisRun,
  reviewedThisRun,
  attempts,
  remainingQueue: remainingQueue.length,
  lastResult
}, null, 2));

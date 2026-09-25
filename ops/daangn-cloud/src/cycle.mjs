import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHotdeals, collectOfficial, collectEvents, canonicalSource, kstDate, normalizeTitle } from './collectors.mjs';
import { publishOne } from './publisher.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STATE = path.join(ROOT, 'state');
const COLLECT_ONLY = process.argv.includes('--collect-only');
const DAILY_MAX = 15;

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
function score(item) {
  if (item.type === 'hotdeal') return (Number(item.discountPct) || 0) * 10 + Math.min((Number(item.saving) || 0) / 1000, 100);
  if (item.type === 'event') return /무료|0원/.test(item.postBody || '') ? 300 : 200;
  if (item.type === 'tip') return 260;
  if (item.type === 'card') return 180;
  return 100;
}
function selectForSlot(queue, slot, lastBoard) {
  const sequence = [
    'tip', 'hotdeal', 'event', 'hotdeal', 'tip',
    'hotdeal', 'tip', 'event', 'hotdeal', 'card',
    'tip', 'hotdeal', 'event', 'tip', 'life'
  ];
  const preferred = sequence[slot % sequence.length];
  const fallback = [preferred, 'tip', 'hotdeal', 'event', 'card', 'life'];
  for (const type of [...new Set(fallback)]) {
    const candidates = queue
      .filter(x => x.type === type && x.board !== lastBoard)
      .sort((a, b) => score(b) - score(a));
    if (candidates.length) return candidates[0];
  }
  return [...queue].sort((a, b) => score(b) - score(a))[0] || null;
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

function gateReason(x, blockedUrls, blockedTitles) {
  if (!x.postTitle || !x.postBody || !x.board || !x.sourceUrl) return 'missing_required';
  if (x.postTitle.includes('｜')) return 'banned_separator';
  if (/(확인됩니다|확인해주세요|한 번 더 확인|쿠폰 적용 여부|가격 변동)/.test(x.postBody)) return 'banned_phrase';
  if (blockedUrls.has(canonicalSource(x.sourceUrl))) return 'source_already_used';
  if (blockedTitles.has(titleKey(x.postTitle))) return 'title_already_used';
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
  ...reviews.map(x => canonicalSource(x.sourceUrl)),
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
  if (reason) rejected.push({ type: x.type, title: x.postTitle || x.title || '', reason });
  return !reason;
});

const unique = [];
const seenUrls = new Set();
const seenTitles = new Set();
for (const x of fresh) {
  const u = canonicalSource(x.sourceUrl);
  const t = titleKey(x.postTitle);
  if (!u || !t) {
    rejected.push({ type: x.type, title: x.postTitle || '', reason: 'empty_dedupe_key' });
    continue;
  }
  if (seenUrls.has(u)) {
    rejected.push({ type: x.type, title: x.postTitle || '', reason: 'duplicate_source_in_cycle' });
    continue;
  }
  if (seenTitles.has(t)) {
    rejected.push({ type: x.type, title: x.postTitle || '', reason: 'duplicate_title_in_cycle' });
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
const legacyTodayCount = Number(legacyDailyCounts[today] || 0);
const publishedTodayCount = todayPosts.length + legacyTodayCount;
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

const lastBoard = todayPosts.at(-1)?.board || '';
const selected = selectForSlot(unique, publishedTodayCount, lastBoard);
if (!selected) process.exit(0);

console.log(JSON.stringify({
  stage: 'selected',
  slot: publishedTodayCount + 1,
  type: selected.type,
  board: selected.board,
  title: selected.postTitle
}, null, 2));

let result;
try {
  result = await publishOne(structuredClone(selected));
} catch (e) {
  console.error(JSON.stringify({ stage: 'publish', ok: false, error: String(e?.message || e) }));
  process.exitCode = 1;
  process.exit();
}

const now = new Date().toISOString();
if (result.status === 'published') {
  published.push({
    status: 'published',
    type: selected.type,
    board: selected.board,
    title: selected.postTitle,
    sourceUrl: selected.sourceUrl,
    postUrl: result.postUrl,
    publishedAt: now
  });
  await writeJson(FILES.published, published.slice(-1500));
  await writeJson(FILES.queue, unique.filter(x => x.id !== selected.id));
} else if (result.status === 'needs_review') {
  reviews.push({
    status: 'needs_review',
    type: selected.type,
    board: selected.board,
    title: selected.postTitle,
    sourceUrl: selected.sourceUrl,
    reason: result.reason || '',
    createdAt: now
  });
  await writeJson(FILES.reviews, reviews.slice(-500));
  await writeJson(FILES.queue, unique.filter(x => x.id !== selected.id));
} else if (result.status === 'auth_expired') {
  console.error('AUTH_EXPIRED: refresh DAANGN_AUTH_STATE_B64 before publishing can resume.');
  process.exitCode = 2;
} else if (result.status === 'auth_missing') {
  console.error('AUTH_MISSING');
  process.exitCode = 2;
}

console.log(JSON.stringify({ ok: result.status === 'published', result, title: selected.postTitle }, null, 2));

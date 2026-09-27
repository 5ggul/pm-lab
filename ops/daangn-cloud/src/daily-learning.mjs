import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { growthReport, communitySnapshot, parseCommunityMembers } from './growth-engine.mjs';
import {
  buildPerformanceSamples,
  normalizeLearningWeights,
  updateLearningWeights
} from './learning-engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STATE = path.join(ROOT, 'state');

const FILES = {
  published: path.join(STATE, 'published.json'),
  metrics: path.join(STATE, 'metrics-history.json'),
  weights: path.join(STATE, 'learning-weights.json'),
  reports: path.join(STATE, 'learning-reports.json')
};

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return structuredClone(fallback); }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
}

function num(s = '') {
  const n = Number(String(s).replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseDaangnStats(text = '') {
  const body = String(text || '').replace(/\u00a0/g, ' ');
  const viewMatch = body.match(/(?:^|\n)\s*조회\s*([0-9][0-9,]*)\s*(?:\n|$)/m) ||
    body.match(/조회\s*([0-9][0-9,]*)/);
  const commentMatch = body.match(/댓글\s*([0-9][0-9,]*)/) ||
    body.match(/([0-9][0-9,]*)\s*개의?\s*댓글/);
  return {
    views: viewMatch ? num(viewMatch[1]) : null,
    comments: commentMatch ? num(commentMatch[1]) : null
  };
}

function metricBase(post) {
  return {
    postUrl: post.postUrl,
    sourceUrl: post.sourceUrl || '',
    title: post.title || '',
    type: post.type || '',
    intent: post.intent || post.type || '',
    styleMode: post.styleMode || '',
    titleStrategy: post.titleStrategy || post.titlePattern || '',
    bodyStrategy: post.bodyStrategy || post.bodyPattern || '',
    topic: post.topic || post.intent || post.type || '',
    sourceStore: post.sourceStore || '',
    publishedAt: post.publishedAt,
    copyMeta: post.copyMeta || null,
    qualityScores: post.qualityScores || null,
    snapshots: []
  };
}

async function scrapeOne(context, post) {
  const page = await context.newPage();
  const started = Date.now();
  try {
    await page.goto(post.postUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10000 });
    await page.getByText(/조회\s*[0-9]/).first().waitFor({ timeout: 10000 });
    const observedTitle = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
    const text = await page.locator('body').innerText({ timeout: 5000 });
    const parsed = parseDaangnStats(text);
    const titleSeen = observedTitle === String(post.title || '').trim();
    const expectedUrl = new URL(post.postUrl);
    const actualUrl = new URL(page.url());
    const identityMatches = expectedUrl.origin === actualUrl.origin &&
      decodeURIComponent(expectedUrl.pathname).replace(/\/$/, '') === decodeURIComponent(actualUrl.pathname).replace(/\/$/, '') &&
      /\/posts\/[^/]+$/.test(actualUrl.pathname);
    if (!Number.isFinite(parsed.views) || !observedTitle || !identityMatches) {
      return {
        ok: false,
        postUrl: post.postUrl,
        reason: !identityMatches ? 'post_identity_mismatch' : 'view_count_not_found',
        titleSeen,
        elapsedMs: Date.now() - started
      };
    }
    return {
      ok: true,
      postUrl: post.postUrl,
      views: parsed.views,
      comments: Number.isFinite(parsed.comments) ? parsed.comments : null,
      titleSeen,
      observedTitle,
      titleChanged: !titleSeen,
      elapsedMs: Date.now() - started
    };
  } catch (e) {
    return {
      ok: false,
      postUrl: post.postUrl,
      reason: String(e?.message || e).slice(0, 240),
      elapsedMs: Date.now() - started
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

function topSamples(samples, n = 5) {
  return [...samples]
    .sort((a, b) => b.performanceIndex - a.performanceIndex)
    .slice(0, n)
    .map(x => ({
      title: x.title,
      type: x.type,
      styleMode: x.styleMode,
      titleStrategy: x.titleStrategy,
      topic: x.topic,
      signal: x.signal,
      views: x.views,
      rate: Number(x.rate.toFixed(3)),
      baselineRate: Number(x.baselineRate.toFixed(3)),
      performanceIndex: Number(x.performanceIndex.toFixed(3))
    }));
}

function bottomSamples(samples, n = 5) {
  return [...samples]
    .sort((a, b) => a.performanceIndex - b.performanceIndex)
    .slice(0, n)
    .map(x => ({
      title: x.title,
      type: x.type,
      styleMode: x.styleMode,
      titleStrategy: x.titleStrategy,
      topic: x.topic,
      signal: x.signal,
      views: x.views,
      rate: Number(x.rate.toFixed(3)),
      baselineRate: Number(x.baselineRate.toFixed(3)),
      performanceIndex: Number(x.performanceIndex.toFixed(3))
    }));
}

const now = new Date();
const observedAt = now.toISOString();
const [published, existingMetrics, rawWeights, existingReports] = await Promise.all([
  readJson(FILES.published, []),
  readJson(FILES.metrics, []),
  readJson(FILES.weights, {}),
  readJson(FILES.reports, [])
]);

const weightsBefore = normalizeLearningWeights(rawWeights);
const cutoff = now.getTime() - 45 * 24 * 36e5;
const posts = published
  .filter(x =>
    x.status === 'published' &&
    x.postUrl &&
    x.publishedAt &&
    new Date(x.publishedAt).getTime() >= cutoff
  )
  .slice(-300);

const metricMap = new Map(existingMetrics.map(x => [x.postUrl, x]));
for (const post of posts) {
  if (!metricMap.has(post.postUrl)) metricMap.set(post.postUrl, metricBase(post));
  const metric = metricMap.get(post.postUrl);
  Object.assign(metric, {
    sourceUrl: post.sourceUrl || metric.sourceUrl || '',
    title: post.title || metric.title || '',
    type: post.type || metric.type || '',
    intent: post.intent || post.type || metric.intent || '',
    styleMode: post.styleMode || metric.styleMode || '',
    titleStrategy: post.titleStrategy || post.titlePattern || metric.titleStrategy || '',
    bodyStrategy: post.bodyStrategy || post.bodyPattern || metric.bodyStrategy || '',
    topic: post.topic || post.intent || post.type || metric.topic || '',
    sourceStore: post.sourceStore || metric.sourceStore || '',
    publishedAt: post.publishedAt || metric.publishedAt,
    copyMeta: post.copyMeta || metric.copyMeta || null,
    qualityScores: post.qualityScores || metric.qualityScores || null
  });
}

console.log(JSON.stringify({
  stage: 'learning-scan-start',
  date: kstDate(now),
  posts: posts.length
}));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 900, height: 700 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
});

let scrapeResults;
const communitySnapshots = await readJson(path.join(STATE, 'community-metrics.json'), []);
let communityScrape = { ok: false, reason: 'not_measured' };
try {
  const communityPage = await context.newPage();
  try {
    const communityUrl = `https://cafe.daangn.com/${process.env.DAANGN_CAFE_SLUG || 'don-akkineun-sa'}`;
    await communityPage.goto(communityUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await communityPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 10000 });
    const heading = await communityPage.getByRole('heading', { level: 1 }).first().innerText();
    const members = parseCommunityMembers(await communityPage.locator('body').innerText());
    if (members !== null && heading.includes('싸그리') && communityPage.url().replace(/\/$/, '') === communityUrl) {
      communitySnapshots.push(communitySnapshot({ members, source: communityUrl }, new Date()));
      communityScrape = { ok: true, members };
    } else communityScrape = { ok: false, reason: 'community_identity_or_member_label_not_found' };
  } catch (error) { communityScrape = { ok: false, reason: String(error.message).slice(0, 160) }; }
  finally { await communityPage.close(); }
  scrapeResults = await mapLimit(posts, 5, post => scrapeOne(context, post));
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

let measured = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < posts.length; i += 1) {
  const post = posts[i];
  const result = scrapeResults[i];
  const metric = metricMap.get(post.postUrl);
  if (!result?.ok) {
    failed += 1;
    failures.push({
      title: post.title,
      postUrl: post.postUrl,
      reason: result?.reason || 'unknown'
    });
    metric.lastScrape = {
      observedAt,
      ok: false,
      reason: result?.reason || 'unknown'
    };
    continue;
  }

  measured += 1;
  // Keep original copy attribution intact. An edited title is measurable, but
  // must not teach the original title strategy using mixed-version outcomes.
  metric.observedTitle = result.observedTitle;
  metric.contentChanged = metric.contentChanged === true || result.titleChanged;
  const ageHours = Math.max(0, (now - new Date(post.publishedAt)) / 36e5);
  metric.snapshots = [
    ...(metric.snapshots || []),
    {
      observedAt,
      views: result.views,
      comments: result.comments,
      ageHours: Number(ageHours.toFixed(2))
    }
  ]
    .filter((x, index, arr) =>
      arr.findIndex(y => y.observedAt === x.observedAt) === index
    )
    .slice(-60);
  metric.lastScrape = {
    observedAt,
    ok: true,
    views: result.views,
    comments: result.comments,
    titleSeen: result.titleSeen
  };
}

const metrics = [...metricMap.values()]
  .filter(x => new Date(x.publishedAt).getTime() >= cutoff)
  .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

const samples = buildPerformanceSamples(metrics, now);
const measurementRatio = posts.length ? measured / posts.length : 1;
const measurementHealthy = posts.length > 0 && measurementRatio >= 0.90;
const todayKey = kstDate(now);
const priorReportLearnedToday = existingReports.some(x =>
  x?.date === todayKey &&
  Number(x?.performanceSamples || 0) >= 2 &&
  (x?.learned === true || (Array.isArray(x?.weightChanges) && x.weightChanges.length > 0))
);
let learned = false;
let learningSkippedReason = '';
let update = { weights: weightsBefore, changes: [] };

if (!measurementHealthy) {
  learningSkippedReason = 'measurement_health_below_90pct';
} else if (weightsBefore.lastLearnedDate === todayKey || priorReportLearnedToday) {
  update.weights.lastLearnedDate = todayKey;
  learningSkippedReason = 'already_learned_today';
} else if (measured < 3) {
  learningSkippedReason = 'not_enough_measured_posts';
} else if (samples.length < 2) {
  learningSkippedReason = 'not_enough_performance_samples';
} else {
  update = updateLearningWeights(weightsBefore, samples, now);
  update.weights.lastLearnedDate = todayKey;
  learned = update.changes.length > 0;
  if (!learned) learningSkippedReason = 'samples_collected_no_weight_change';
}

const report = {
  date: todayKey,
  observedAt,
  postsConsidered: posts.length,
  postsMeasured: measured,
  scrapeFailures: failed,
  measurementRatio: Number(measurementRatio.toFixed(4)),
  measurementHealthy,
  performanceSamples: samples.length,
  communityScrape,
  learned,
  learningSkippedReason,
  weightChanges: update.changes,
  topPerformers: topSamples(samples),
  bottomPerformers: bottomSamples(samples),
  failures: failures.slice(0, 20),
  metricsContract: { views: 'snapshot', comments: 'includes_operator', shares: null, joins: null, retention: null, exact24hViews: null },
  safety: {
    qualityGatesModified: false,
    factGatesModified: false,
    bannedPhraseRulesModified: false,
    maxDailyWeightStep: update.weights.maxDailyStep,
    weightBounds: [update.weights.minWeight, update.weights.maxWeight]
  }
};

await Promise.all([
  writeJson(path.join(STATE, 'community-metrics.json'), communitySnapshots.slice(-180)),
  writeJson(path.join(STATE, 'growth-report.json'), growthReport(published, metrics, communitySnapshots, new Date())),
  writeJson(FILES.metrics, metrics),
  writeJson(FILES.weights, update.weights),
  writeJson(FILES.reports, [...existingReports, report].slice(-120))
]);

console.log(JSON.stringify({
  stage: 'learning-complete',
  ...report
}, null, 2));

if (!measurementHealthy) {
  console.error('LEARNING_MEASUREMENT_UNHEALTHY: view scrape success below 90%; weights were not changed.');
  process.exitCode = 2;
}

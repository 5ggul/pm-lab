import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, canonicalSource } from './collectors.mjs';
import { collectSavingsBenefits } from './savings-benefits.mjs';
import { collectServices } from './editorial-sources.mjs';
import { collectResearch } from './research-supply.mjs';
import { planItem, contentKey, semanticTopic, kstDay, slotDecision } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import { recheckItem } from './source-recheck.mjs';
import { publishOne } from './publisher.mjs';
import { readState, saveState, persistJournal, runReservedPublish } from './publish-journal.mjs';
import { shoppingScope } from './content-scope.mjs';
import { learningFactorForItem } from './learning-engine.mjs';
import { burstQualityEligible, requiresBurstQuality, volumeSummary } from './volume-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'state');
const file = name => path.join(STATE, name + '.json');
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'growth-config.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(ROOT, 'source-registry.json'), 'utf8'));
const dry = process.argv.includes('--collect-only') || process.argv.includes('--preview') ||
  process.env.GITHUB_EVENT_NAME === 'pull_request' ||
  (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF !== 'refs/heads/main');

await fs.mkdir(STATE, { recursive: true });

function kstHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(date));
}

function utilitySlot(date, cfg) {
  const hour = kstHour(date);
  return (cfg.utilitySlotHoursKst || []).includes(hour) ? `${kstDay(date)}@${hour}` : null;
}

function isUtilityItem(item) {
  return ['benefit', 'service', 'researched', 'digest'].includes(item?.copyContext?.kind);
}

function recentUtilityCount(posts) {
  return posts.filter(post => !['hotdeal', 'comparison'].includes(post.contentKind || post.copyContext?.kind)).length;
}

function chooseUtility(previews, recent, today, weights) {
  const last = recent.at(-1);
  const recentKinds = recent.slice(-4).map(post => post.contentKind || post.copyContext?.kind).filter(Boolean);
  const recentSeries = recent.slice(-8).map(post => post.editorialPlan?.seriesId).filter(Boolean);
  const burstRequired = requiresBurstQuality(today.length, config, false);
  const scored = previews
    .filter(item => !item.copyRejected && isUtilityItem(item) && shoppingScope(item))
    .filter(item => item.editorialPlan?.status === 'eligible')
    .filter(item => !Number.isFinite(item.qualityScores?.finalScore) || item.qualityScores.finalScore >= (config.minCopyQuality || 0))
    .filter(item => !burstRequired || burstQualityEligible(item, config))
    .map(item => {
      const kind = item.copyContext.kind;
      const series = item.editorialPlan?.seriesId || item.copyContext.seriesId || '';
      const category = item.copyContext.category || '';
      const sameKind = recentKinds.filter(value => value === kind).length;
      const sameSeries = series ? recentSeries.filter(value => value === series).length : 0;
      const sameCategoryToday = today.filter(post => post.topic === category).length;
      const lastCategoryPenalty = last?.topic === category ? 25 : 0;
      const diversity = 100 - sameKind * 12 - sameSeries * 10 - sameCategoryToday * 18 - lastCategoryPenalty;
      const quality = item.qualityScores?.finalScore || 0;
      const editorial = item.editorialPlan?.score || 0;
      const learning = Math.min(1.25, Math.max(0.75, learningFactorForItem(item, weights)));
      return { item, score: quality * 100 + editorial * 10 + diversity + learning };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

async function run() {
  const now = new Date();
  const today = kstDay(now);
  const slot = utilitySlot(now, config);
  const [published, reviews, ledger, weights, researchCache, researchAttempts] = await Promise.all([
    readState(file('published'), []),
    readState(file('needs-review'), []),
    readState(file('publish-ledger'), {}),
    readState(file('learning-weights'), {}),
    readState(file('research-drafts'), []),
    readState(file('research-attempts'), {})
  ]);

  for (const entry of Object.values(ledger)) {
    if (entry.status === 'published' && entry.record && !published.some(post => post.postUrl === entry.record.postUrl)) {
      published.push(entry.record);
    }
  }
  if (!dry) await saveState(file('published'), published.slice(-1500));

  const persist = () => persistJournal(file('publish-ledger'), ledger);
  const decision = slotDecision(ledger, slot, config, now);
  if (!dry && !config.enabled) return { mode: 'growth_disabled', publishedThisRun: 0 };
  if (!dry && !slot) return { mode: 'outside_utility_window', publishedThisRun: 0 };
  if (!dry && !decision.run) return { mode: decision.reason, slot, publishedThisRun: 0 };

  const todayPosts = published.filter(post => post.status === 'published' && kstDay(new Date(post.publishedAt)) === today);
  if (!dry && Number.isFinite(config.dailyMax) && todayPosts.length >= config.dailyMax) {
    ledger[slot] = { status: 'daily_cap', attempts: 0, finishedAt: now.toISOString() };
    await persist();
    return { mode: 'daily_cap', publishedToday: todayPosts.length, publishedThisRun: 0 };
  }

  const state = { published };
  const collection = [];
  const items = [];

  if (config.features?.savingsBenefits) {
    try {
      const result = await collectSavingsBenefits(state, fetchText, now);
      items.push(...result.items);
      collection.push({ source: 'savings-benefits', ok: true, count: result.items.length, diagnostics: result.diagnostics });
    } catch (error) {
      collection.push({ source: 'savings-benefits', ok: false, count: 0, error: String(error.message).slice(0, 160) });
    }
  }

  if (config.features?.publicServices) {
    try {
      const services = await collectServices(registry, fetchText);
      items.push(...services);
      collection.push({ source: 'public-services', ok: true, count: services.length });
    } catch (error) {
      collection.push({ source: 'public-services', ok: false, count: 0, error: String(error.message).slice(0, 160) });
    }
  }

  let nextResearchCache = researchCache;
  if (config.features?.research) {
    try {
      const result = await collectResearch({
        cache: researchCache,
        published,
        attempts: researchAttempts,
        fetcher: fetchText,
        env: process.env,
        now,
        maxAttempts: 3
      });
      nextResearchCache = result.cache;
      items.push(...result.items);
      collection.push({ source: 'official-research', ok: true, count: result.items.length, diagnostics: result.report });
    } catch (error) {
      collection.push({ source: 'official-research', ok: false, count: 0, error: String(error.message).slice(0, 160) });
    }
  }

  const blockedUrls = new Set([
    ...published.map(post => canonicalSource(post.sourceUrl)),
    ...reviews.filter(review => ['needs_review', 'publish_unknown'].includes(review.status)).map(review => canonicalSource(review.sourceUrl)),
    ...Object.values(ledger).filter(entry => ['publishing', 'publish_unknown', 'published'].includes(entry.status)).map(entry => canonicalSource(entry.sourceUrl))
  ].filter(Boolean));
  const blockedTopics = new Set(published.map(semanticTopic).filter(Boolean));
  const seen = new Set();
  const rejected = [];
  const queue = [];

  for (const item of items) {
    const key = contentKey(item);
    const url = canonicalSource(item.sourceUrl);
    const topic = semanticTopic(item);
    if (!isUtilityItem(item) || seen.has(key) || blockedUrls.has(url) || blockedTopics.has(topic)) continue;
    seen.add(key);
    const editorialPlan = planItem(item, config, now);
    const candidate = {
      ...item,
      semanticKey: topic,
      idempotencyKey: key,
      editorialPlan,
      queuedAt: now.toISOString(),
      status: 'queued'
    };
    if (editorialPlan.status !== 'eligible') {
      rejected.push({
        id: item.id,
        sourceUrl: item.sourceUrl,
        title: item.title || item.copyContext?.sourceTitle,
        status: 'editorial_review',
        reasons: editorialPlan.reasons,
        editorialPlan,
        createdAt: now.toISOString()
      });
    } else {
      queue.push(candidate);
    }
  }

  const recent = published.filter(post => post.status === 'published').slice(-100);
  const previews = queue.map(item => selectCommunityCopy(item, recent, 'daangn', weights));
  const selected = chooseUtility(previews, recent, todayPosts, weights);
  const report = {
    at: now.toISOString(),
    version: 6,
    mode: dry ? 'preview' : selected ? 'ready' : 'quality_or_category_skip',
    slot,
    publishedToday: todayPosts.length,
    utilityPublishedToday: recentUtilityCount(todayPosts),
    publicationVolume: volumeSummary(config, todayPosts.length),
    burstQualityRequired: requiresBurstQuality(todayPosts.length, config, false),
    collection,
    queueCount: queue.length,
    rejected,
    previews: previews.map(item => ({
      id: item.id,
      title: item.postTitle,
      body: item.postBody,
      kind: item.copyContext?.kind,
      category: item.copyContext?.category,
      rejected: item.copyRejected,
      reasons: item.copyRejectReasons,
      qualityScores: item.qualityScores || null,
      burstEligible: burstQualityEligible(item, config),
      layoutFamily: item.copyMeta?.layoutFamily || item.bodyStrategy || null
    }))
  };

  await Promise.all([
    saveState(file('utility-report'), report),
    saveState(file('research-drafts'), nextResearchCache),
    saveState(file('research-attempts'), researchAttempts)
  ]);

  const reviewMap = new Map(reviews.map(review => [review.id || review.sourceUrl, review]));
  for (const entry of rejected) {
    if (!['needs_review', 'publish_unknown'].includes(reviewMap.get(entry.id)?.status)) reviewMap.set(entry.id, entry);
  }
  await saveState(file('needs-review'), [...reviewMap.values()].slice(-500));

  if (dry) return report;
  if (!process.env.DAANGN_AUTH_STATE_B64) {
    process.exitCode = 1;
    return { ...report, mode: 'auth_missing', publishedThisRun: 0 };
  }
  if (!selected) {
    ledger[slot] = {
      status: queue.length || rejected.length ? 'quality_or_category_skip' : 'no_candidate',
      attempts: (ledger[slot]?.attempts || 0) + 1,
      finishedAt: now.toISOString()
    };
    await persist();
    return { ...report, mode: ledger[slot].status, publishedThisRun: 0 };
  }

  const recheck = await recheckItem(selected, registry);
  if (!recheck.ok) {
    ledger[slot] = {
      status: /recheck_failed/.test(recheck.reason || '') ? 'technical_failure' : 'quality_or_category_skip',
      attempts: (ledger[slot]?.attempts || 0) + 1,
      finishedAt: new Date().toISOString(),
      reason: recheck.reason
    };
    await persist();
    return { ...report, mode: ledger[slot].status, recheck, publishedThisRun: 0 };
  }

  const result = await runReservedPublish({
    item: selected,
    key: selected.idempotencyKey,
    slot,
    journal: ledger,
    persist,
    publish: publishOne
  });

  if (result.status === 'published') {
    const record = ledger[slot].record;
    published.push(record);
    await saveState(file('published'), published.slice(-1500));
  }
  if (['publish_unknown', 'technical_failure', 'auth_expired'].includes(result.status)) process.exitCode = 1;
  return {
    ...report,
    mode: result.status,
    result,
    publishedThisRun: result.status === 'published' ? 1 : 0
  };
}

const lockPath = path.join(STATE, '.utility-cycle.lock');
let lock;
try {
  lock = await fs.open(lockPath, 'wx');
  const report = await run();
  await saveState(file('utility-report'), report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, reason: String(error.message) }));
  process.exitCode = 1;
} finally {
  if (lock) {
    await lock.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}

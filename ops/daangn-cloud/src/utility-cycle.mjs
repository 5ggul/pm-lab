import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, canonicalSource } from './collectors.mjs';
import { collectSavingsBenefits } from './savings-benefits.mjs';
import { collectServices } from './editorial-sources.mjs';
import { collectResearch } from './research-supply.mjs';
import { planItem, contentKey, semanticTopic, kstDay, slotDecision, isUtilityContent } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import { recheckItem } from './source-recheck.mjs';
import { publishOne } from './publisher.mjs';
import { readState, saveState, persistJournal, runReservedPublish, submissionHistory } from './publish-journal.mjs';
import { shoppingScope } from './content-scope.mjs';
import { chooseUtility, isUtilityItem } from './utility-selection.mjs';
import { burstQualityEligible, capReached, configuredCap, isBurstSlot, publicationPacing, requiresBurstQuality, volumeSummary } from './volume-policy.mjs';

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

function recentUtilityCount(posts) {
  return posts.filter(isUtilityContent).length;
}

async function run() {
  const now = new Date();
  const today = kstDay(now);
  const slot = utilitySlot(now, config);
  const burstSlot = isBurstSlot(now, config, 'utility');
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

  const submissions = submissionHistory(published, ledger);
  const confirmedToday = published.filter(post => post.status === 'published' && kstDay(new Date(post.publishedAt)) === today);
  const todayPosts = submissions.filter(post => post.submittedAt && kstDay(new Date(post.submittedAt)) === today);
  const unconfirmedToday = todayPosts.filter(post => post.status !== 'published').length;
  const burstQualityRequired = requiresBurstQuality(todayPosts.length, config, burstSlot);
  if (!dry && capReached(todayPosts.length, configuredCap(config.dailyMax, 8))) {
    ledger[slot] = { status: 'daily_cap', attempts: 0, finishedAt: now.toISOString() };
    await persist();
    return { mode: 'daily_cap', publishedToday: confirmedToday.length, submissionsToday: todayPosts.length, unconfirmedSubmissionsToday: unconfirmedToday, publishedThisRun: 0 };
  }

  const waitForSpacing = async () => {
    const pacing = publicationPacing(published, ledger, config, new Date());
    if (pacing.run) return null;
    ledger[slot] = {
      status: 'pacing_wait',
      attempts: ledger[slot]?.attempts || 0,
      nextEligibleAt: pacing.nextEligibleAt,
      reason: pacing.reason,
      finishedAt: new Date().toISOString()
    };
    await persist();
    return { mode: 'pacing_wait', slot, pacing, publishedToday: confirmedToday.length, submissionsToday: todayPosts.length, unconfirmedSubmissionsToday: unconfirmedToday, publishedThisRun: 0 };
  };
  if (!dry) { const waiting = await waitForSpacing(); if (waiting) return waiting; }

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
  const blockedTopics = new Set(submissions.map(semanticTopic).filter(Boolean));
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

  const recent = submissions.slice(-100);
  const previews = queue.map(item => selectCommunityCopy(item, recent, 'daangn', weights));
  const selected = chooseUtility(previews, recent, todayPosts, weights, config, burstQualityRequired);
  const report = {
    at: now.toISOString(),
    version: 6,
    mode: dry ? 'preview' : selected ? 'ready' : 'quality_or_category_skip',
    slot,
    burstSlot,
    burstQualityRequired,
    publishedToday: confirmedToday.length, submissionsToday: todayPosts.length, unconfirmedSubmissionsToday: unconfirmedToday,
    utilityPublishedToday: recentUtilityCount(confirmedToday),
    utilitySubmissionsToday: recentUtilityCount(todayPosts),
    publicationVolume: volumeSummary(config, todayPosts.length),
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
      selectionReady: !item.copyRejected && (!burstQualityRequired || burstQualityEligible(item, config)),
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
      burstSlot,
      burstQualityRequired,
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

  const waiting = await waitForSpacing();
  if (waiting) return { ...report, ...waiting };

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

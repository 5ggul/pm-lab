import { capReached, configuredCap, publicationPacing, volumeSummary } from './volume-policy.mjs';
import { buildLifecycleQueue, runtimeDraftFailures } from './work-hardening.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHotdeals, canonicalSource, fetchText } from './collectors.mjs';
import { collectSavingsBenefits } from './savings-benefits.mjs';
import { buildComparisons, collectServices } from './editorial-sources.mjs';
import { collectResearch } from './research-supply.mjs';
import {
  planItem,
  slotFor,
  slotDecision,
  contentKey,
  chooseItem,
  kstDay,
  semanticTopic,
  isCommercialContent,
  isUtilityContent
} from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine-v6.mjs';
import { learningFactorForItem } from './learning-engine.mjs';
import { publishOne } from './publisher.mjs';
import { recheckItem } from './source-recheck.mjs';
import { readState, saveState, persistJournal, runReservedPublish } from './publish-journal.mjs';
import { sourceStore } from './quality-engine.mjs';
import { shoppingScope } from './content-scope.mjs';
import { trackingReport, preparePriceUpdates } from './price-tracking.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'state');
const file = name => path.join(STATE, `${name}.json`);
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'growth-config.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(ROOT, 'source-registry.json'), 'utf8'));
const dry = process.argv.includes('--collect-only') ||
  process.argv.includes('--preview') ||
  process.env.GITHUB_EVENT_NAME === 'pull_request' ||
  (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF !== 'refs/heads/main');

await fs.mkdir(STATE, { recursive: true });

function contentMix(posts = []) {
  return posts.reduce((result, post) => {
    if (isCommercialContent(post)) result.commercial += 1;
    else if (isUtilityContent(post)) result.utility += 1;
    else result.other += 1;
    return result;
  }, { commercial: 0, utility: 0, other: 0 });
}

async function unifiedCycle() {
  const now = new Date();
  const today = kstDay(now);
  const slot = slotFor(now, config);
  const [
    published,
    reviews,
    priceHistory,
    ledger,
    weights,
    legacy,
    researchCache,
    researchAttempts
  ] = await Promise.all([
    readState(file('published'), []),
    readState(file('needs-review'), []),
    readState(file('price-history'), {}),
    readState(file('publish-ledger'), {}),
    readState(file('learning-weights'), {}),
    readState(file('legacy-daily-counts'), {}),
    readState(file('research-drafts'), []),
    readState(file('research-attempts'), {})
  ]);

  // Recover a confirmed URL whose runner died before saving published.json.
  for (const entry of Object.values(ledger)) {
    if (entry.status === 'published' && entry.record &&
      !published.some(post => post.postUrl === entry.record.postUrl)) {
      published.push(entry.record);
    }
  }
  if (!dry) await saveState(file('published'), published.slice(-1500));

  const persist = () => persistJournal(file('publish-ledger'), ledger);
  if (!dry && slot && process.env.DAANGN_RETRY_EMPTY_SLOT === 'true' &&
    ['no_candidate', 'quality_or_category_skip'].includes(ledger[slot]?.status) &&
    !ledger[slot]?.key) {
    delete ledger[slot];
    await persist();
  }

  const decision = slotDecision(ledger, slot, config, now);
  if (!dry && !config.enabled) return { mode: 'growth_disabled', publishedThisRun: 0 };
  if (!dry && !decision.run) return { mode: decision.reason, slot, publishedThisRun: 0 };

  const todayPosts = published.filter(post =>
    post.status === 'published' && kstDay(new Date(post.publishedAt)) === today
  );
  const legacyCount = typeof legacy[today] === 'number'
    ? legacy[today]
    : Number(legacy[today]?.total || 0);
  const already = todayPosts.length + legacyCount;
  if (!dry && capReached(already, configuredCap(config.dailyMax, 8))) {
    ledger[slot] = { status: 'daily_cap', attempts: 0, finishedAt: now.toISOString() };
    await persist();
    return { mode: 'daily_cap', publishedToday: already, publishedThisRun: 0 };
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
    return {
      mode: 'pacing_wait',
      slot,
      pacing,
      publishedToday: already,
      publishedThisRun: 0
    };
  };
  if (!dry) {
    const waiting = await waitForSpacing();
    if (waiting) return waiting;
  }

  const state = {
    priceHistory,
    published,
    shoppingSources: await readState(file('shopping-sources'), [])
  };
  const collection = [];
  const items = [];
  let nextResearchCache = researchCache;

  const collect = async (name, fn) => {
    try {
      const result = await fn();
      const found = Array.isArray(result) ? result : result.items || [];
      items.push(...found);
      collection.push({
        source: name,
        ok: true,
        count: found.length,
        diagnostics: Array.isArray(result) ? undefined : (result.diagnostics || result.report)
      });
      return result;
    } catch (error) {
      collection.push({
        source: name,
        ok: false,
        count: 0,
        error: String(error?.message || error).slice(0, 180)
      });
      return null;
    }
  };

  await collect('hotdeals', () => collectHotdeals(state));

  if (config.features?.savingsBenefits) {
    const benefits = await collect('savings-benefits', () => collectSavingsBenefits(state, fetchText, now));
    if (benefits?.diagnostics) state.benefitDiagnostics = benefits.diagnostics;
  }

  if (config.features?.publicServices) {
    await collect('public-services', () => collectServices(registry, fetchText));
  }

  if (config.features?.research) {
    const research = await collect('official-research', () => collectResearch({
      cache: researchCache,
      published,
      attempts: researchAttempts,
      fetcher: fetchText,
      env: process.env,
      now,
      maxAttempts: 3
    }));
    if (research?.cache) nextResearchCache = research.cache;
  }

  let prepared = preparePriceUpdates(items, published, ledger, new Date());
  if (config.features?.comparisons) prepared.push(...buildComparisons(prepared, now));

  const oldBlocked = await readState(file('legacy-blocklist'), []);
  const blockedUrls = new Set([
    ...published.map(item => item.sourceUrl),
    ...reviews
      .filter(item => ['needs_review', 'publish_unknown'].includes(item.status))
      .map(item => item.sourceUrl),
    ...oldBlocked
  ].filter(Boolean).map(canonicalSource));
  const hardBlockedUrls = new Set([
    ...reviews
      .filter(item => ['needs_review', 'publish_unknown'].includes(item.status))
      .map(item => item.sourceUrl),
    ...oldBlocked,
    ...Object.values(ledger)
      .filter(item => ['publishing', 'publish_unknown'].includes(item.status))
      .map(item => item.sourceUrl)
  ].filter(Boolean).map(canonicalSource));
  const reservedKeys = new Set(Object.values(ledger)
    .filter(item => ['publishing', 'publish_unknown', 'published'].includes(item.status))
    .map(item => item.key));
  const seen = new Set();
  const seenTopics = new Set(published.map(semanticTopic).filter(Boolean));
  const rejected = [];
  const queue = [];

  for (const item of prepared) {
    const key = contentKey(item);
    const url = canonicalSource(item.sourceUrl);
    const topic = semanticTopic(item);
    if (seen.has(key) || reservedKeys.has(key) || hardBlockedUrls.has(url) ||
      (!item.priceUpdate && (blockedUrls.has(url) || seenTopics.has(topic)))) continue;
    seen.add(key);
    seenTopics.add(topic);
    const editorialPlan = planItem(item, config, now);
    const candidate = {
      ...item,
      semanticKey: topic,
      editorialPlan,
      idempotencyKey: key,
      queuedAt: now.toISOString(),
      status: 'queued'
    };
    if (editorialPlan.status !== 'eligible') {
      rejected.push({
        id: item.id,
        sourceUrl: item.sourceUrl,
        title: item.title || item.copyContext?.sourceTitle || item.copyContext?.name,
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
  const readyMix = contentMix(previews.filter(item => !item.copyRejected));
  const report = {
    at: now.toISOString(),
    version: 6,
    mode: dry ? 'preview' : 'cycle',
    slot,
    publishedToday: already,
    publishedMixToday: contentMix(todayPosts),
    readyMix,
    publicationVolume: volumeSummary(config, already),
    collection,
    shoppingDiagnostics: state.shoppingDiagnostics,
    priceTracking: trackingReport(priceHistory),
    lifecycleReview: buildLifecycleQueue(published, now),
    benefitDiagnostics: state.benefitDiagnostics,
    queueCount: queue.length,
    rejected,
    copyQualityFloor: config.minCopyQuality ?? 0,
    previews: previews.map(item => ({
      id: item.id,
      title: item.postTitle,
      body: item.postBody,
      kind: item.copyContext?.kind,
      category: item.copyContext?.category,
      rejected: item.copyRejected,
      reasons: item.copyRejectReasons,
      integrityFailures: runtimeDraftFailures(item),
      editorialPlan: item.editorialPlan,
      qualityScores: item.qualityScores || null,
      layoutFamily: item.copyMeta?.layoutFamily || item.bodyStrategy || null,
      surfaceFamily: item.copyMeta?.surfaceFamily || null,
      selectionReady: !item.copyRejected &&
        runtimeDraftFailures(item).length === 0 &&
        (!Number.isFinite(item.qualityScores?.finalScore) ||
          item.qualityScores.finalScore >= (config.minCopyQuality ?? 0))
    }))
  };

  await Promise.all([
    saveState(file('editorial-report'), report),
    saveState(file('queue'), queue),
    saveState(file('price-history'), priceHistory),
    saveState(file('shopping-sources'), state.shoppingSources || []),
    saveState(file('research-drafts'), nextResearchCache),
    saveState(file('research-attempts'), researchAttempts)
  ]);

  const reviewMap = new Map(reviews.map(item => [item.id || item.sourceUrl, item]));
  for (const entry of rejected) {
    if (!['needs_review', 'publish_unknown'].includes(reviewMap.get(entry.id)?.status)) {
      reviewMap.set(entry.id, entry);
    }
  }
  await saveState(file('needs-review'), [...reviewMap.values()].slice(-500));

  if (dry) return report;
  if (!process.env.DAANGN_AUTH_STATE_B64) {
    process.exitCode = 1;
    return { ...report, mode: 'auth_missing', publishedThisRun: 0 };
  }

  let pending = previews.filter(item => !item.copyRejected);
  let recheckUnavailable = false;
  while (pending.length) {
    const base = chooseItem(
      pending,
      recent,
      todayPosts,
      config,
      item => learningFactorForItem(item, weights)
    );
    if (!base) break;
    pending = pending.filter(item => item.idempotencyKey !== base.idempotencyKey);

    const selected = selectCommunityCopy(base, recent, 'daangn', weights);
    if (selected.copyRejected) {
      rejected.push({
        id: base.id,
        reasons: selected.copyRejectReasons,
        status: 'copy_rejected'
      });
      continue;
    }
    if (!shoppingScope(selected)) throw new Error('OUTSIDE_COMMUNITY_SCOPE');

    const recheck = await recheckItem(selected, registry);
    if (!recheck.ok) {
      if (/^(?:recheck_failed:|benefit_source_unavailable)/.test(recheck.reason || '')) {
        recheckUnavailable = true;
      }
      rejected.push({
        id: base.id,
        sourceUrl: base.sourceUrl,
        reasons: [recheck.reason],
        status: 'recheck_rejected'
      });
      continue;
    }

    const integrityFailures = runtimeDraftFailures(selected);
    if (integrityFailures.length) {
      rejected.push({ id: base.id, reasons: integrityFailures, status: 'integrity_rejected' });
      continue;
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
      const record = {
        status: 'published',
        postUrl: result.postUrl,
        publishedAt: new Date().toISOString(),
        title: selected.postTitle,
        bodyText: selected.postBody,
        sourceUrl: selected.sourceUrl,
        sourceStore: sourceStore(selected.buyUrl || selected.sourceUrl),
        sellerKey: selected.sellerKey,
        type: selected.type,
        board: result.board || selected.board,
        imageAttached: result.imageAttached === true,
        topic: selected.copyContext.category || selected.copyContext.intent || selected.type,
        intent: selected.copyContext.intent,
        semanticKey: selected.semanticKey || selected.id,
        idempotencyKey: selected.idempotencyKey,
        editorialPlan: selected.editorialPlan,
        styleMode: selected.styleMode,
        titleStrategy: selected.titleStrategy,
        copyMeta: selected.copyMeta,
        qualityScores: selected.qualityScores,
        learningMeta: selected.learningMeta || null,
        expiresAt: selected.expiresAt || null,
        sourceFingerprint: selected.verification?.fingerprint || null,
        savedVerification: result.savedVerification || null,
        verification: selected.verification,
        contentVersion: selected.contentVersion || '1',
        priceRecord: selected.priceRecord,
        contentKind: selected.copyContext.kind
      };
      ledger[slot].record = record;
      await persist();
      published.push(record);
      await saveState(file('published'), published.slice(-1500));
      await saveState(file('queue'), pending);
    }

    if (['publish_unknown', 'technical_failure', 'auth_expired'].includes(result.status)) {
      process.exitCode = 1;
    }
    return {
      ...report,
      mode: result.status,
      result,
      rejected,
      publishedThisRun: result.status === 'published' ? 1 : 0
    };
  }

  const status = collection.every(entry => !entry.ok) || recheckUnavailable
    ? 'technical_failure'
    : queue.length || rejected.length
      ? 'quality_or_category_skip'
      : 'no_candidate';
  ledger[slot] = {
    status,
    attempts: (ledger[slot]?.attempts || 0) + 1,
    finishedAt: new Date().toISOString(),
    mix: contentMix(todayPosts)
  };
  await persist();
  if (status === 'technical_failure' ||
    (status === 'no_candidate' && config.publishingMode !== 'quality-led' &&
      config.publishingMode !== 'adaptive-quality')) {
    process.exitCode = 1;
  }
  return { ...report, mode: status, rejected, publishedThisRun: 0 };
}

const lockPath = path.join(STATE, '.cycle.lock');
let lock;
try {
  lock = await fs.open(lockPath, 'wx');
  const report = await unifiedCycle();
  if (['technical_failure', 'auth_missing', 'auth_expired', 'publish_unknown'].includes(report.mode) ||
    (report.mode === 'no_candidate' && config.publishingMode !== 'quality-led' &&
      config.publishingMode !== 'adaptive-quality')) {
    process.exitCode = 1;
  }
  await saveState(file('editorial-report'), report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, reason: String(error?.message || error) }));
  process.exitCode = 1;
} finally {
  if (lock) {
    await lock.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}

import * as v4 from './growth-engine-v4.mjs';
export * from './growth-engine-v4.mjs';
import { baseDailyTarget, burstQualityEligible, capReached, configuredCap } from './volume-policy.mjs';
import { applyTopicRoute, isUtilityPublicationType, publicationRouteAllowed, topicFamilyFor } from './topic-routing.mjs';
import { normalizeUtilityItem } from './utility-language.mjs';

const COMMERCIAL_KINDS = new Set(['hotdeal', 'comparison']);
const UTILITY_KINDS = new Set(['benefit', 'service', 'researched', 'digest', 'event', 'policy', 'question']);
const MAX_COLLECTION_CLOCK_DRIFT_MS = 5 * 60e3;

export function isCommercialContent(item = {}) {
  const kind = item?.copyContext?.kind || item?.contentKind;
  return COMMERCIAL_KINDS.has(kind) || item?.type === 'hotdeal' || item?.topic === '생활비 비교';
}

export function isUtilityContent(item = {}) {
  const kind = item?.copyContext?.kind || item?.contentKind;
  return UTILITY_KINDS.has(kind) || (isUtilityPublicationType(item?.type) && !isCommercialContent(item));
}

// A submitted post with missing old metadata could have been commercial.
// Reserve capacity without labelling it a confirmed deal or a utility success.
function unclassifiedSubmission(item = {}) {
  return ['publishing', 'publish_unknown'].includes(item.status) &&
    !isCommercialContent(item) && !isUtilityContent(item);
}

function configuredNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function consecutiveCommercial(posts = []) {
  let count = 0;
  for (let index = posts.length - 1; index >= 0; index -= 1) {
    if (!isCommercialContent(posts[index]) && !unclassifiedSubmission(posts[index])) break;
    count += 1;
  }
  return count;
}

function copyQuality(item = {}) {
  return Number.isFinite(item?.qualityScores?.finalScore)
    ? Number(item.qualityScores.finalScore)
    : 0;
}

function categoryKey(item = {}) {
  return item?.copyContext?.category || item?.topic || item?.copyContext?.intent || item?.type || '';
}

function sellerKey(item = {}) {
  return item?.sellerKey || item?.sourceStore || '';
}

function freshTopQualityWinner(candidates, recent, today, config, learningFactor) {
  if (candidates.length < 2) return null;
  const maximum = Math.max(...candidates.map(copyQuality));
  const top = candidates.filter(item => copyQuality(item) === maximum);
  if (top.length < 2) return null;

  const window = recent.slice(-8);
  const recentCategories = new Set(window.map(categoryKey).filter(Boolean));
  const recentSellers = new Set(window.map(sellerKey).filter(Boolean));
  const fresh = top.filter(item => {
    const category = categoryKey(item);
    const seller = sellerKey(item);
    return (!category || !recentCategories.has(category)) &&
      (!seller || !recentSellers.has(seller));
  });

  return fresh.length
    ? v4.chooseItem(fresh, recent, today, config, learningFactor)
    : null;
}

function freshnessReferenceTime(item, now) {
  const reference = now instanceof Date ? now : new Date(now);
  const observedAt = Date.parse(item?.verification?.observedAt || '');
  const drift = observedAt - reference.getTime();
  if (Number.isFinite(observedAt) && drift > 0 && drift <= MAX_COLLECTION_CLOCK_DRIFT_MS) {
    return new Date(observedAt);
  }
  return reference;
}

function familyCount(posts, family) {
  return posts.filter(item => topicFamilyFor(item) === family).length;
}

export function prioritizeTopicFamilies(candidates = [], today = [], config = {}) {
  const caps = config.topicFamilyDailyCaps || {};
  let eligible = candidates.filter(item => {
    if (!publicationRouteAllowed(item)) return false;
    const family = topicFamilyFor(item);
    const cap = Number(caps[family]);
    return !Number.isFinite(cap) || familyCount(today, family) < cap;
  });
  if (!eligible.length) return eligible;

  const targets = config.topicFamilyTargets || {};
  const priority = config.topicFamilyPriority || [
    'life', 'card', 'benefit', 'service', 'comparison', 'event', 'refund', 'deal', 'utility'
  ];

  for (const family of priority) {
    const target = Number(targets[family]);
    if (!Number.isFinite(target) || target <= 0 || familyCount(today, family) >= target) continue;
    const familyCandidates = eligible.filter(item => topicFamilyFor(item) === family);
    if (familyCandidates.length) return familyCandidates;
  }

  const unseenFamilies = new Set(eligible.map(topicFamilyFor).filter(family => familyCount(today, family) === 0));
  if (unseenFamilies.size) {
    for (const family of priority) {
      if (!unseenFamilies.has(family)) continue;
      const familyCandidates = eligible.filter(item => topicFamilyFor(item) === family);
      if (familyCandidates.length) return familyCandidates;
    }
  }
  return eligible;
}

export function planItem(item, config, now = new Date()) {
  normalizeUtilityItem(item);
  applyTopicRoute(item);
  const planned = v4.planItem(item, config, freshnessReferenceTime(item, now));
  const kind = item?.copyContext?.kind;
  const reasons = [...new Set(planned.reasons || [])];

  if (!publicationRouteAllowed(item)) reasons.push('publication_category_paused');
  if (kind === 'service' && !config.features?.publicServices) reasons.push('public_services_disabled');
  if (kind === 'researched' && !config.features?.research) reasons.push('research_disabled');
  if (kind === 'digest' && !config.features?.digests) reasons.push('digests_disabled');

  const uniqueReasons = [...new Set(reasons)];
  const status = uniqueReasons.length
    ? 'review'
    : planned.score >= config.topicAutoThreshold
      ? 'eligible'
      : planned.score >= config.topicReviewThreshold
        ? 'review'
        : 'rejected';

  return {
    ...planned,
    version: 6,
    reasons: uniqueReasons,
    status,
    topicFamily: topicFamilyFor(item),
    publicationType: item.type,
    publicationBoard: item.board,
    contentClass: isCommercialContent(item) ? 'commercial' : isUtilityContent(item) ? 'utility' : 'other'
  };
}

export function chooseItem(queue, recent, today, config, learningFactor = () => 1) {
  const hardCap = configuredCap(config.dailyMax, 8);
  if (capReached(today.length, hardCap)) return null;

  const commercialCount = today.filter(item => isCommercialContent(item) || unclassifiedSubmission(item)).length;
  const utilityCount = today.filter(isUtilityContent).length;
  const commercialMax = configuredNumber(config.commercialDailyMax, 4);
  const utilityTarget = configuredNumber(config.utilityDailyTarget, 3);
  const maxConsecutive = configuredNumber(config.maxConsecutiveCommercial, 1);
  const recentCommercialRun = consecutiveCommercial(recent);
  const finiteHardCap = hardCap === null ? Number.MAX_SAFE_INTEGER : hardCap;
  const remainingSlots = Math.max(0, finiteHardCap - today.length);
  const utilitiesStillNeeded = Math.max(0, utilityTarget - utilityCount);
  const burstRequired = config.requireBurstQuality === true || today.length >= baseDailyTarget(config);

  let candidates = [...queue];

  if (burstRequired) candidates = candidates.filter(item => burstQualityEligible(item, config));

  if (commercialCount >= commercialMax || recentCommercialRun >= maxConsecutive) {
    candidates = candidates.filter(item => !isCommercialContent(item));
  }

  if (utilitiesStillNeeded > 0 && remainingSlots <= utilitiesStillNeeded) {
    candidates = candidates.filter(isUtilityContent);
  }

  candidates = prioritizeTopicFamilies(candidates, today, config);
  const freshWinner = freshTopQualityWinner(candidates, recent, today, config, learningFactor);
  return freshWinner || v4.chooseItem(candidates, recent, today, config, learningFactor);
}

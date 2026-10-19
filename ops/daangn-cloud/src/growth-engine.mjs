import * as v4 from './growth-engine-v4.mjs';
export * from './growth-engine-v4.mjs';

const COMMERCIAL_KINDS = new Set(['hotdeal', 'comparison']);
const UTILITY_KINDS = new Set(['benefit', 'service', 'researched', 'digest']);

export function isCommercialContent(item = {}) {
  const kind = item?.copyContext?.kind || item?.contentKind;
  return COMMERCIAL_KINDS.has(kind) || item?.type === 'hotdeal' || item?.topic === '생활비 비교';
}

export function isUtilityContent(item = {}) {
  const kind = item?.copyContext?.kind || item?.contentKind;
  return UTILITY_KINDS.has(kind) || (item?.type === 'tip' && !isCommercialContent(item));
}

function configuredNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function consecutiveCommercial(posts = []) {
  let count = 0;
  for (let index = posts.length - 1; index >= 0; index -= 1) {
    if (!isCommercialContent(posts[index])) break;
    count += 1;
  }
  return count;
}

export function planItem(item, config, now = new Date()) {
  const planned = v4.planItem(item, config, now);
  const kind = item?.copyContext?.kind;
  const reasons = [...new Set(planned.reasons || [])];

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
    version: 5,
    reasons: uniqueReasons,
    status,
    contentClass: isCommercialContent(item) ? 'commercial' : isUtilityContent(item) ? 'utility' : 'other'
  };
}

export function chooseItem(queue, recent, today, config, learningFactor = () => 1) {
  const dailyMax = configuredNumber(config.dailyMax, 5);
  if (today.length >= dailyMax) return null;

  const commercialCount = today.filter(isCommercialContent).length;
  const utilityCount = today.filter(isUtilityContent).length;
  const commercialMax = configuredNumber(config.commercialDailyMax, 3);
  const utilityTarget = configuredNumber(config.utilityDailyTarget, 2);
  const maxConsecutive = configuredNumber(config.maxConsecutiveCommercial, 2);
  const recentCommercialRun = consecutiveCommercial(recent);
  const remainingSlots = Math.max(0, dailyMax - today.length);
  const utilitiesStillNeeded = Math.max(0, utilityTarget - utilityCount);

  let candidates = [...queue];

  if (commercialCount >= commercialMax || recentCommercialRun >= maxConsecutive) {
    candidates = candidates.filter(item => !isCommercialContent(item));
  }

  // When only enough slots remain to satisfy the utility target, commercial
  // content cannot consume those slots. If no verified utility candidate is
  // available the slot is skipped instead of turning the feed into an ad list.
  if (utilitiesStillNeeded > 0 && remainingSlots <= utilitiesStillNeeded) {
    candidates = candidates.filter(isUtilityContent);
  }

  return v4.chooseItem(candidates, recent, today, config, learningFactor);
}

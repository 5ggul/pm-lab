/** null is an explicitly uncapped editorial limit; 0 still disables a type. */
export const configuredCap = (value, fallback) => value === undefined ? fallback : value;

export function capReached(count, limit) {
  if (!Number.isSafeInteger(count) || count < 0) return true;
  if (limit === null) return false;
  if (!Number.isSafeInteger(limit) || limit < 0) return true;
  return count >= limit;
}

export function baseDailyTarget(config = {}) {
  const hardCap = configuredCap(config.dailyMax, 8);
  const configuredBase = configuredCap(config.baseDailyTarget, 5);
  if (!Number.isSafeInteger(configuredBase) || configuredBase < 0) return 0;
  if (hardCap === null) return configuredBase;
  if (!Number.isSafeInteger(hardCap) || hardCap < 0) return 0;
  return Math.min(configuredBase, hardCap);
}

export function kstHour(date = new Date()) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(+parsed)) return null;
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(parsed));
}

export function isBurstSlot(date, config = {}, channel = 'commercial') {
  const hour = kstHour(date);
  if (!Number.isSafeInteger(hour)) return false;
  const hours = channel === 'utility'
    ? config.utilityBurstSlotHoursKst
    : config.burstSlotHoursKst;
  return Array.isArray(hours) && hours.includes(hour);
}

export function burstQualityEligible(item = {}, config = {}) {
  const copyScore = Number(item?.qualityScores?.finalScore);
  const editorialScore = Number(item?.editorialPlan?.score);
  const minCopy = Number(config.burstMinCopyQuality ?? 88);
  const minEditorial = Number(config.burstMinEditorialScore ?? 85);
  if (!Number.isFinite(copyScore) || copyScore < minCopy) return false;
  if (!Number.isFinite(editorialScore) || editorialScore < minEditorial) return false;
  if (config.burstRequireVerified !== false && item?.verification?.status !== 'verified') return false;
  return item?.editorialPlan?.status === 'eligible';
}

export function requiresBurstQuality(count, config = {}, burstSlot = false) {
  if (!Number.isSafeInteger(count) || count < 0) return true;
  return burstSlot || count >= baseDailyTarget(config);
}

export function volumeSummary(config, count) {
  const cap = configuredCap(config.dailyMax, 8);
  const baseTarget = baseDailyTarget(config);
  const hardRemaining = cap === null
    ? null
    : Number.isSafeInteger(cap) && cap >= 0
      ? Math.max(0, cap - count)
      : 0;
  const baseRemaining = Math.max(0, baseTarget - count);
  return {
    mode: config.publishingMode || 'adaptive-quality',
    baseDailyTarget: baseTarget,
    dailyCap: cap,
    capLabel: cap === null
      ? `기본 ${baseTarget}건 · 고정 상한 없음 · 우수 후보만 추가 발행`
      : Number.isSafeInteger(cap) && cap >= 0
        ? `기본 ${baseTarget}건 · 우수 후보 시 최대 ${cap}건`
        : '발행 상한 설정 오류',
    remaining: hardRemaining,
    baseRemaining,
    burstStage: count >= baseTarget,
    minPublishGapMinutes: config.minPublishGapMinutes ?? 0
  };
}

export function publicationPacing(published, ledger, config, now = new Date()) {
  const minutes = config.minPublishGapMinutes ?? 0;
  if (!Number.isSafeInteger(minutes) || minutes < 0 || !Number.isFinite(+now)) return { run: false, reason: 'pacing_config_invalid', nextEligibleAt: null };
  if (minutes === 0) return { run: true, reason: 'pacing_disabled', nextEligibleAt: null };
  const times = published.filter(x => x.status === 'published').map(x => Date.parse(x.publishedAt));
  for (const x of Object.values(ledger)) {
    if (!['published', 'publishing', 'publish_unknown'].includes(x.status)) continue;
    const time = Date.parse(x.record?.publishedAt || x.finishedAt || x.startedAt || '');
    if (!Number.isFinite(time) && ['publishing', 'publish_unknown'].includes(x.status)) return { run: false, reason: 'pacing_history_unverified', nextEligibleAt: null };
    times.push(time);
  }
  const valid = times.filter(Number.isFinite);
  if (!valid.length) return { run: true, reason: 'no_recent_submission', nextEligibleAt: null };
  const last = Math.max(...valid), next = last + minutes * 60000;
  return { run: +now >= next, reason: +now >= next ? 'gap_satisfied' : 'pacing_wait', lastSubmissionAt: new Date(last).toISOString(), nextEligibleAt: new Date(next).toISOString() };
}

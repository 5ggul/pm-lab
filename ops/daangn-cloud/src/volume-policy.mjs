/** null is an explicitly uncapped editorial limit; 0 still disables a type. */
export const configuredCap = (value, fallback) => value === undefined ? fallback : value;
export function capReached(count, limit) {
  if (!Number.isSafeInteger(count) || count < 0) return true;
  if (limit === null) return false;
  if (!Number.isSafeInteger(limit) || limit < 0) return true;
  return count >= limit;
}
export function volumeSummary(config, count) {
  const cap = configuredCap(config.dailyMax, 5);
  return { mode: config.publishingMode || 'fixed-cap', dailyCap: cap,
    capLabel: cap === null ? '고정 일일 상한 없음 · 품질 통과 시 발행' : Number.isSafeInteger(cap) && cap >= 0 ? `일일 상한 ${cap}건` : '발행 상한 설정 오류',
    remaining: cap === null ? null : Number.isSafeInteger(cap) && cap >= 0 ? Math.max(0, cap - count) : 0,
    minPublishGapMinutes: config.minPublishGapMinutes ?? 0 };
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

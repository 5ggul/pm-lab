import { kstDay } from './growth-engine.mjs';

const validTime = value => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
};

// A successful Actions run or an unconfirmed submission is not a publication.
export function publicationHealth(published, now = new Date(), thresholdHours = 48) {
  if (!Array.isArray(published) || !Number.isFinite(+now) ||
      !Number.isFinite(thresholdHours) || thresholdHours <= 0) {
    throw new Error('PUBLICATION_HEALTH_INPUT_INVALID');
  }
  const confirmed = published.filter(item =>
    item?.status === 'published' && typeof item?.postUrl === 'string' &&
    /^https:\/\/cafe\.daangn\.com\/don-akkineun-sa\/posts\/[^/?#]+/.test(item.postUrl) &&
    validTime(item.publishedAt) !== null && validTime(item.publishedAt) <= +now
  );
  const latest = confirmed.reduce((time, item) => Math.max(time, validTime(item.publishedAt)), -Infinity);
  const idleHours = Number.isFinite(latest) ? (+now - latest) / 36e5 : null;
  return {
    stalled: idleHours === null || idleHours >= thresholdHours,
    lastConfirmedAt: Number.isFinite(latest) ? new Date(latest).toISOString() : null,
    confirmedToday: confirmed.filter(item => kstDay(new Date(item.publishedAt)) === kstDay(now)).length,
    idleHours,
    thresholdHours
  };
}

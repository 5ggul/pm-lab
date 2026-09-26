const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const DEFAULT_LEARNING_WEIGHTS = Object.freeze({
  version: 1,
  updatedAt: null,
  minSamples: 20,
  minDays: 7,
  maxDailyStep: 0.05,
  minWeight: 0.75,
  maxWeight: 1.25,
  explorationBonus: 0.04,
  dimensions: {
    styleMode: {},
    titleStrategy: {},
    linkPosition: {},
    topic: {},
    sourceStore: {},
    typeHour: {}
  }
});

export function normalizeLearningWeights(raw = {}) {
  const base = structuredClone(DEFAULT_LEARNING_WEIGHTS);
  const out = {
    ...base,
    ...raw,
    dimensions: { ...base.dimensions }
  };
  for (const key of Object.keys(base.dimensions)) {
    out.dimensions[key] = { ...(raw?.dimensions?.[key] || {}) };
  }
  out.minSamples = Math.max(20, Number(raw.minSamples) || 20);
  out.minDays = Math.max(7, Number(raw.minDays) || 7);
  out.maxDailyStep = Math.min(0.05, Math.max(0, Number(raw.maxDailyStep) || 0.05));
  out.minWeight = 0.75;
  out.maxWeight = 1.25;
  return out;
}

export function kstHourBucket(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit'
  }).format(date));
  if (hour >= 8 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 16) return 'afternoon';
  if (hour >= 17 && hour <= 22) return 'evening';
  return 'offhours';
}

function entryWeight(weights, dimension, key) {
  if (!key) return 1;
  const value = Number(weights?.dimensions?.[dimension]?.[key]?.weight);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function entrySamples(weights, dimension, key) {
  if (!key) return 0;
  const value = Number(weights?.dimensions?.[dimension]?.[key]?.samples);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function storeKey(item = {}) {
  if (item?.sourceStore) return item.sourceStore;
  const url = item?.buyUrl || item?.sourceUrl || item?.copyContext?.buyUrl || '';
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return item?.copyContext?.merchant || ''; }
}

function typeHourKey(item = {}, date = new Date()) {
  const type = item?.type || item?.copyContext?.kind || 'unknown';
  return type + '@' + kstHourBucket(date);
}

export function learningFactorForCandidate(item, candidate, meta, rawWeights = {}) {
  const weights = normalizeLearningWeights(rawWeights);
  const topic = item?.copyContext?.category || item?.copyContext?.intent || item?.type || '';
  const store = storeKey(item);
  const fields = [
    ['styleMode', candidate?.styleMode || meta?.styleMode || '', 0.36],
    ['titleStrategy', candidate?.titleStrategy || meta?.titleStrategy || '', 0.26],
    ['linkPosition', meta?.linkPosition || '', 0.14],
    ['topic', topic, 0.16],
    ['sourceStore', store, 0.06],
    ['typeHour', typeHourKey(item), 0.08]
  ];
  let weighted = 0;
  let total = 0;
  for (const [dimension, key, importance] of fields) {
    if (!key) continue;
    weighted += entryWeight(weights, dimension, key) * importance;
    total += importance;
  }
  return total ? clamp(weighted / total, weights.minWeight, weights.maxWeight) : 1;
}

export function learningFactorForItem(item, rawWeights = {}) {
  const weights = normalizeLearningWeights(rawWeights);
  const topic = item?.copyContext?.category || item?.copyContext?.intent || item?.type || '';
  const store = storeKey(item);
  const topicWeight = entryWeight(weights, 'topic', topic);
  const sourceWeight = entryWeight(weights, 'sourceStore', store);
  const timeWeight = entryWeight(weights, 'typeHour', typeHourKey(item));
  return clamp(
    topicWeight * 0.58 + sourceWeight * 0.17 + timeWeight * 0.25,
    weights.minWeight,
    weights.maxWeight
  );
}

export function explorationBonusForCandidate(item, candidate, meta, rawWeights = {}) {
  const weights = normalizeLearningWeights(rawWeights);
  const keys = [
    ['styleMode', candidate?.styleMode || meta?.styleMode || ''],
    ['titleStrategy', candidate?.titleStrategy || meta?.titleStrategy || ''],
    ['linkPosition', meta?.linkPosition || '']
  ];
  const needs = keys
    .filter(([, key]) => key)
    .map(([dimension, key]) => {
      const samples = entrySamples(weights, dimension, key);
      return clamp((weights.minSamples - samples) / Math.max(1, weights.minSamples), 0, 1);
    });
  if (!needs.length) return 0;
  return weights.explorationBonus * (needs.reduce((a, b) => a + b, 0) / needs.length);
}

function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function latestRate(metric, now = new Date()) {
  const snapshots = [...(metric?.snapshots || [])]
    .filter(x => typeof x.views === 'number' && Number.isFinite(x.views) && x.views >= 0 && Number.isFinite(Date.parse(x.observedAt)))
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  if (!snapshots.length || !metric?.publishedAt || metric.lastScrape?.ok === false || metric.contentChanged === true) return null;

  const latest = snapshots.at(-1);
  const latestAt = new Date(latest.observedAt);
  const publishedAt = new Date(metric.publishedAt);
  if (Number.isNaN(latestAt.getTime()) || Number.isNaN(publishedAt.getTime())) return null;

  if (latestAt > now || now - latestAt > 36 * 36e5) return null;
  if (snapshots.some((x, i) => i > 0 && x.views < snapshots[i - 1].views)) return null;
  const ageHours = (latestAt - publishedAt) / 36e5;
  if (ageHours < 6 || ageHours > 72) return null;

  let prior = null;
  let bestDistance = Infinity;
  for (const snap of snapshots.slice(0, -1)) {
    const h = (latestAt - new Date(snap.observedAt)) / 36e5;
    if (h < 18 || h > 34) continue;
    const distance = Math.abs(h - 24);
    if (distance < bestDistance) {
      bestDistance = distance;
      prior = snap;
    }
  }

  if (prior) {
    const deltaHours = (latestAt - new Date(prior.observedAt)) / 36e5;
    const deltaViews = Number(latest.views) - Number(prior.views);
    if (deltaHours > 0 && deltaViews >= 0) {
      return {
        rate: deltaViews / deltaHours,
        views: Number(latest.views),
        ageHours,
        windowHours: deltaHours,
        signal: 'daily_delta'
      };
    }
  }

  if (ageHours <= 36 && Number(latest.views) >= 0) {
    return {
      rate: Number(latest.views) / Math.max(1, ageHours),
      views: Number(latest.views),
      ageHours,
      windowHours: ageHours,
      signal: 'early_lifetime'
    };
  }
  return null;
}

export function buildPerformanceSamples(metrics = [], now = new Date()) {
  const raw = [];
  for (const metric of metrics) {
    const perf = latestRate(metric, now);
    if (!perf || !Number.isFinite(perf.rate)) continue;
    raw.push({
      postUrl: metric.postUrl,
      title: metric.title,
      type: metric.type || 'unknown',
      intent: metric.intent || '',
      styleMode: metric.styleMode || '',
      titleStrategy: metric.titleStrategy || '',
      linkPosition: metric.linkPosition || metric.copyMeta?.linkPosition || '',
      topic: metric.topic || metric.intent || metric.type || '',
      sourceStore: metric.sourceStore || '',
      publishHourBucket: kstHourBucket(metric.publishedAt),
      typeHour: (metric.type || 'unknown') + '@' + kstHourBucket(metric.publishedAt),
      ageBucket: perf.ageHours < 12 ? '6-12' : perf.ageHours < 24 ? '12-24' : perf.ageHours < 48 ? '24-48' : '48-72',
      ...perf
    });
  }

  const globalRates = raw.map(x => x.rate);
  for (const sample of raw) {
    const exact = raw.filter(x =>
      x.type === sample.type && x.signal === sample.signal && x.ageBucket === sample.ageBucket &&
      x.publishHourBucket === sample.publishHourBucket
    ).map(x => x.rate);
    const typeOnly = raw.filter(x => x.type === sample.type && x.signal === sample.signal && x.ageBucket === sample.ageBucket).map(x => x.rate);
    const baseline = exact.length >= 3 ? median(exact)
      : typeOnly.length >= 3 ? median(typeOnly)
        : 0;
    sample.cohort = exact.length >= 3 ? 'type+time+age+signal' : typeOnly.length >= 3 ? 'type+age+signal' : 'insufficient';
    sample.baselineRate = baseline;
    sample.performanceIndex = baseline > 0
      ? clamp(sample.rate / baseline, 0.40, 2.50)
      : 1;
  }
  return raw;
}

function dimensionKeys(sample) {
  return {
    styleMode: sample.styleMode,
    titleStrategy: sample.titleStrategy,
    linkPosition: sample.linkPosition,
    topic: sample.topic,
    sourceStore: sample.sourceStore,
    typeHour: sample.typeHour
  };
}

export function updateLearningWeights(rawWeights = {}, samples = [], now = new Date()) {
  const next = normalizeLearningWeights(rawWeights);
  const changes = [];
  const observedAt = now.toISOString();
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
  if (next.lastEvidenceDate === day) return { weights: next, changes };
  for (const dimension of Object.keys(next.dimensions)) {
    const groups = new Map();
    for (const sample of samples) {
      const key = dimensionKeys(sample)[dimension];
      if (!key || !sample.postUrl || sample.cohort === 'insufficient' || !Number.isFinite(sample.performanceIndex)) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sample);
    }
    for (const [key, group] of groups) {
      const prev = next.dimensions[dimension][key] || { weight: 1 };
      const evidence = { ...(prev.evidence || {}) };
      for (const sample of group) evidence[sample.postUrl] = { index: sample.performanceIndex, at: observedAt };
      const recent = Object.entries(evidence).filter(([, v]) => Date.parse(v.at) >= now.getTime() - 45 * 864e5).slice(-300);
      const n = recent.length;
      const avg = recent.reduce((sum, [, v]) => sum + v.index, 0) / Math.max(1, n);
      const firstObservedAt = prev.firstObservedAt || observedAt;
      const days = (now - new Date(firstObservedAt)) / 864e5;
      const ema = prev.emaIndex == null ? avg : prev.emaIndex * 0.7 + avg * 0.3;
      const step = n >= next.minSamples && days >= next.minDays ? clamp((ema - 1) * n / (n + 6) * 0.18, -next.maxDailyStep, next.maxDailyStep) : 0;
      const oldWeight = clamp(Number(prev.weight) || 1, next.minWeight, next.maxWeight);
      const weight = Number(clamp(oldWeight * (1 + step), next.minWeight, next.maxWeight).toFixed(4));
      next.dimensions[dimension][key] = { weight, samples: n, firstObservedAt, updatedAt: observedAt, emaIndex: ema, lastIndex: avg, evidence: Object.fromEntries(recent), dailySamples: group.length };
      if (Math.abs(weight - oldWeight) >= 0.0001) changes.push({ dimension, key, from: oldWeight, to: weight, evidenceSamples: n, observationDays: days, step: weight / oldWeight - 1 });
    }
  }
  next.updatedAt = observedAt;
  next.lastEvidenceDate = day;
  next.lastSampleCount = samples.length;
  next.lastChanges = changes;
  return { weights: next, changes };
}

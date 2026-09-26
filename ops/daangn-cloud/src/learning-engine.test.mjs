import assert from 'node:assert/strict';
import {
  buildPerformanceSamples,
  DEFAULT_LEARNING_WEIGHTS,
  explorationBonusForCandidate,
  kstHourBucket,
  learningFactorForCandidate,
  learningFactorForItem,
  normalizeLearningWeights,
  updateLearningWeights
} from './learning-engine.mjs';

assert.equal(kstHourBucket('2026-09-26T00:00:00Z'), 'morning');
assert.equal(kstHourBucket('2026-09-26T06:00:00Z'), 'afternoon');
assert.equal(kstHourBucket('2026-09-26T11:00:00Z'), 'evening');

const empty = normalizeLearningWeights({});
assert.equal(empty.dimensions.styleMode.PRICE_FIRST, undefined);
assert.equal(learningFactorForItem({ type: 'hotdeal' }, empty), 1);

const weighted = normalizeLearningWeights({
  dimensions: {
    styleMode: {
      PRICE_FIRST: { weight: 1.2, samples: 8 }
    },
    titleStrategy: {
      PRICE: { weight: 1.1, samples: 8 }
    },
    linkPosition: {
      end: { weight: 1.05, samples: 8 }
    },
    topic: {
      생활용품: { weight: 1.08, samples: 8 }
    },
    sourceStore: {
      'testmall': { weight: 1.03, samples: 8 }
    }
  }
});
const factor = learningFactorForCandidate(
  { type: 'hotdeal', copyContext: { category: '생활용품', merchant: 'testmall' } },
  { styleMode: 'PRICE_FIRST', titleStrategy: 'PRICE' },
  { linkPosition: 'end' },
  weighted
);
assert.ok(factor > 1.08 && factor <= 1.25);
assert.ok(learningFactorForItem(
  { type: 'hotdeal', copyContext: { category: '생활용품', merchant: 'testmall' } },
  weighted
) > 1);

const explore = explorationBonusForCandidate(
  { type: 'hotdeal' },
  { styleMode: 'NEW_MODE', titleStrategy: 'NEW_TITLE' },
  { linkPosition: 'middle' },
  weighted
);
assert.ok(explore > 0 && explore <= DEFAULT_LEARNING_WEIGHTS.explorationBonus);

const now = new Date('2026-09-27T14:40:00Z');
const metrics = [
  {
    postUrl: 'a',
    title: 'A',
    type: 'hotdeal',
    styleMode: 'PRICE_FIRST',
    titleStrategy: 'PRICE',
    topic: '생활용품',
    sourceStore: 'mall-a',
    publishedAt: '2026-09-26T10:00:00Z',
    copyMeta: { linkPosition: 'end' },
    snapshots: [
      { observedAt: '2026-09-26T14:40:00Z', views: 20 },
      { observedAt: '2026-09-27T14:40:00Z', views: 140 }
    ]
  },
  {
    postUrl: 'b',
    title: 'B',
    type: 'hotdeal',
    styleMode: 'PRICE_FIRST',
    titleStrategy: 'PRICE',
    topic: '생활용품',
    sourceStore: 'mall-b',
    publishedAt: '2026-09-26T10:10:00Z',
    copyMeta: { linkPosition: 'end' },
    snapshots: [
      { observedAt: '2026-09-26T14:40:00Z', views: 15 },
      { observedAt: '2026-09-27T14:40:00Z', views: 125 }
    ]
  },
  {
    postUrl: 'c',
    title: 'C',
    type: 'hotdeal',
    styleMode: 'CONTEXT',
    titleStrategy: 'SAVING',
    topic: '식품',
    sourceStore: 'mall-c',
    publishedAt: '2026-09-26T10:20:00Z',
    copyMeta: { linkPosition: 'middle' },
    snapshots: [
      { observedAt: '2026-09-26T14:40:00Z', views: 20 },
      { observedAt: '2026-09-27T14:40:00Z', views: 45 }
    ]
  }
];

const samples = buildPerformanceSamples(metrics, now);
assert.equal(samples.length, 3);
assert.ok(samples.every(x => Number.isFinite(x.performanceIndex)));
assert.ok(samples[0].rate > samples[2].rate);

const updated = updateLearningWeights({}, samples, now);
assert.ok(updated.weights.dimensions.styleMode.PRICE_FIRST.weight > 1);
assert.ok(updated.weights.dimensions.styleMode.PRICE_FIRST.weight <= 1.05);
assert.equal(updated.weights.dimensions.styleMode.CONTEXT.weight, 1, 'single sample must not move production weight');
assert.ok(updated.changes.some(x => x.dimension === 'styleMode' && x.key === 'PRICE_FIRST'));

const bounded = updateLearningWeights({
  maxDailyStep: 0.05,
  minWeight: 0.75,
  maxWeight: 1.25,
  dimensions: {
    styleMode: {
      PRICE_FIRST: { weight: 1.24, samples: 100 }
    }
  }
}, samples, now);
assert.ok(bounded.weights.dimensions.styleMode.PRICE_FIRST.weight <= 1.25);

console.log('learning-engine tests passed');

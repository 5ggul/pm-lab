import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { shoppingScope } from './content-scope.mjs';
import { chooseItem, planItem } from './growth-engine.mjs';
import { publishOne } from './publisher.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const now = new Date();
const deal = {
  type: 'hotdeal', buyUrl: 'https://shop.example/product/1', sourceUrl: 'https://shop.example/product/1',
  price: 10000, discountPct: 20, saving: 2500,
  verification: { status: 'verified', observedAt: now.toISOString() },
  copyContext: { kind: 'hotdeal', product: '세제 2개', price: 10000, category: '생활용품',
    returnReason: '장보기 가격 비교', claims: [{ verified: true, sourceUrl: 'https://shop.example/product/1' }] }
};
deal.editorialPlan = planItem(deal, config, now);
assert.equal(deal.editorialPlan.status, 'eligible');
assert.equal(chooseItem([deal], [], [], config), deal);
assert.equal(config.dailyMax, 10);
assert.equal(config.typeCaps.hotdeal, 6);
for (const kind of ['service', 'researched', 'policy', 'event', 'digest', 'question']) {
  // Cached approved plans and shopping keywords cannot bypass the scope guard.
  const stale = { ...deal, copyContext: { ...deal.copyContext, kind, sourceTitle: '보험료 할인 혜택 쿠폰' } };
  assert.equal(shoppingScope(stale), false);
  assert.ok(planItem(stale, config, now).reasons.includes('outside_shopping_scope'));
  assert.equal(chooseItem([stale], [], [], config), null);
  await assert.rejects(() => publishOne(stale), error => error.message === 'OUTSIDE_SHOPPING_SCOPE' && error.beforeSubmit);
}
const comparison = { copyContext: { kind: 'comparison' }, componentItems: [deal, deal] };
assert.equal(shoppingScope(comparison), true);
assert.equal(shoppingScope({ ...comparison, componentItems: [] }), false);
assert.equal(shoppingScope({ ...comparison, componentItems: [deal, { copyContext: { kind: 'service' } }] }), false);
const currentDeal = { ...deal, copyContext: { ...deal.copyContext, currentOffer: true } };
assert.equal(chooseItem([currentDeal], [{ topic: deal.copyContext.category }], [], config), null, 'current offers cannot repeat the last category');
const sixDeals = Array.from({ length: 6 }, (_, n) => ({ type: 'hotdeal', sourceStore: `shop${n}`, topic: `topic${n}` }));
const comparisonCandidate = { ...comparison, type: 'tip', copyContext: { kind: 'comparison', category: '생활비 비교' }, editorialPlan: { status: 'eligible', bucket: 'utility', score: 90 } };
assert.equal(chooseItem([comparisonCandidate], [], sixDeals, config), null, 'comparisons cannot evade commercial cap');
assert.equal(chooseItem([currentDeal], [], [...sixDeals.slice(0, 5), { type: 'tip', topic: '생활비 비교' }], config), null, 'historical comparisons count toward cap');
assert.equal(chooseItem([currentDeal], [], Array.from({ length: 10 }, () => ({ type: 'unrelated' })), config), null, 'daily cap applies independently of type');
console.log('shopping scope blocks unrelated sources, stale queue plans and direct publishing');

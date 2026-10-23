import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { planItem, growthCopyFailures } from './growth-engine.mjs';
import { renderCommunityCandidates, selectCommunityCopy, validateGeneratedCopy } from './copy-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { shoppingScope } from './content-scope.mjs';
import { publishOne } from './publisher.mjs';
import { approvedDealClaimGroups, bodyContainsApprovedDealClaim } from './editorial-diversity.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const ctx = {
  kind: 'hotdeal', currentOffer: true, product: '베베숲 물티슈 70매 캡 20팩',
  category: '생필품', price: 23900, referencePrice: 34130, referenceLabel: '판매처 할인 전 표시가',
  saving: 10230, benefitPercent: 29, priceLabel: '상품가', buyUrl: 'https://shop.example/20',
  shipping: '기본배송 무료 (제주·도서산간 조건 별도)',
  requiredConditions: ['즉시할인가 · 카드할인·적립금 제외', '구매 한도 5개'],
  returnReason: '생활용품 할인 비교',
  claims: [{ verified: true, sourceUrl: 'https://shop.example/20', value: 23900 },
    { verified: true, sourceUrl: 'https://shop.example/20', value: 34130 }]
};
const item = { type: 'hotdeal', title: ctx.product, price: ctx.price, buyUrl: ctx.buyUrl, sourceUrl: ctx.buyUrl,
  trustScore: 96, expiresAt: new Date(Date.now() + 864e5).toISOString(), verification: { status: 'verified', observedAt: new Date().toISOString() }, copyContext: ctx };
item.editorialPlan = planItem(item, config);
assert.equal(item.editorialPlan.status, 'eligible');
assert.ok(planItem({ ...item, trustScore: 80 }, config).reasons.includes('editorial_quality_below_minimum'), 'weak current offers cannot qualify for curation');
const facts = dealPriceFacts(ctx);
const approved = approvedDealClaimGroups(ctx, facts);
for (const candidate of renderCommunityCandidates(item)) {
  assert.ok(candidate.postTitle.includes('23,900원'), 'every hook retains the full item price');
  assert.ok(candidate.postBody.includes(facts.purchaseFit));
  assert.ok(growthCopyFailures(item, { ...candidate, postTitle: '팩당 1,195원 · 물티슈' }).includes('title_total_price_omitted'));
  assert.equal(validateGeneratedCopy(item, candidate.postTitle, candidate.postBody).ok, true);
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.comparisonDiscount));
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.unit));
  const unitClaim = approved.unit.find(phrase => candidate.postBody.includes(phrase));
  // Remove the reference and saving independently, preserving the rest of the
  // approved sentence. Each missing fact must still fail direct-publish QA.
  for (const [claim, reason] of [
    [`${facts.referenceLabel} ${facts.referencePrice.toLocaleString('ko-KR')}원`, 'price_comparison_omitted'],
    [`${facts.saving.toLocaleString('ko-KR')}원`, 'price_discount_omitted'],
    [unitClaim, 'unit_price_omitted']
  ]) {
    assert.ok(claim && candidate.postBody.includes(claim), 'negative test must remove an actual rendered claim');
    const changed = { ...candidate, postBody: candidate.postBody.replace(claim, '') };
    assert.ok(growthCopyFailures(item, changed).includes(reason));
    assert.equal(validateGeneratedCopy(item, changed.postTitle, changed.postBody).ok, false);
    assert.ok(growthCopyFailures({ ...item, editorialPlan: undefined }, changed).includes(reason), 'direct publishing cannot skip required price facts');
  }
  assert.equal(validateGeneratedCopy(item, '팩당 900원 · 베베숲 물티슈 20팩', candidate.postBody).ok, false, 'invented unit price is rejected');
}
const picked = selectCommunityCopy(item);
const longProduct = { ...item, copyContext: { ...ctx, coupon: true, product: '베베숲 프리미엄 두꺼운 부드러운 아기용 순한 물티슈 대용량 캡형 가정용 특가 70매 20팩' } };
for (const candidate of renderCommunityCandidates(longProduct)) {
  assert.ok(candidate.postTitle.length <= 62);
  assert.ok(candidate.postTitle.includes('23,900원') && candidate.postTitle.includes('쿠폰가'));
  assert.ok(candidate.postTitle.includes('20팩'), 'shortening preserves pack configuration');
  assert.ok(!candidate.postTitle.endsWith('→'));
}
assert.equal(picked.copyRejected, false);
assert.equal(selectCommunityCopy(item, [{ title: picked.postTitle, bodyText: picked.postBody, copyMeta: picked.copyMeta }]).copyRejected, true);
for (const phrase of ['10,230원 아끼고 23,900원', '10,230원 덜 들어요', '관심 상품부터 골라보세요']) {
  assert.equal(validateGeneratedCopy(item, phrase, picked.postBody).ok, false);
}
const forged = { ...item, type: 'tip', copyContext: { kind: 'benefit', sourceTitle: '누구나 환급 10만원', verified: true }, verification: { status: 'verified', method: 'official_savings_v1' } };
assert.equal(shoppingScope(forged), false);
await assert.rejects(() => publishOne(forged), error => error.beforeSubmit && error.message === 'OUTSIDE_SHOPPING_SCOPE');
assert.equal(config.baseDailyTarget, 5);
assert.equal(config.dailyMax, 9);
assert.equal(config.commercialDailyMax, 3);
assert.equal(config.utilityDailyTarget, 4);
assert.equal(config.maxConsecutiveCommercial, 1);
assert.equal(config.publishingMode, 'adaptive-quality');
assert.equal(config.typeCaps.hotdeal, 3);
assert.equal(config.typeCaps.tip, 6);
assert.equal(config.burstMinCopyQuality, 88);
assert.equal(config.burstMinEditorialScore, 85);
assert.ok(config.dailyMax > config.baseDailyTarget);
assert.ok(config.utilityDailyTarget > config.commercialDailyMax);
assert.ok(config.audience.includes('시니어'));
const headlineGuard = { copyContext: { kind: 'benefit', headlineCandidates: ['기초연금 받는 SKT 고객, 월 최대 12,100원 감면'] } };
assert.ok(growthCopyFailures(headlineGuard, { postTitle: 'SKT 고객 전원 월 12,100원 감면', postBody: '' }).includes('unverified_benefit_headline'));
console.log('savings integration: factual hooks, direct-publish guard, adaptive 5-to-9 utility-first mix and forged benefit rejection passed');

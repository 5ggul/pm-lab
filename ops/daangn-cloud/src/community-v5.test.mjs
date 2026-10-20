import assert from 'node:assert/strict';
import { renderCommunityCandidates } from './copy-engine.mjs';
import { buildCopyMeta } from './quality-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { approvedDealClaimGroups, bodyContainsApprovedDealClaim } from './editorial-diversity.mjs';

const shopping = {
  type: 'hotdeal',
  sourceUrl: 'https://shop.example/product/1',
  buyUrl: 'https://shop.example/product/1',
  copyContext: {
    kind: 'hotdeal',
    currentOffer: true,
    intent: 'CURRENT_OFFER',
    product: '베베숲 물티슈 70매 캡 20팩',
    category: '육아·아동',
    price: 23900,
    priceLabel: '상품가',
    referencePrice: 34130,
    referenceLabel: '판매처 할인 전 표시가',
    saving: 10230,
    shipping: '기본배송 무료 (제주·도서산간 조건 별도)',
    delivery: { total: 23900 },
    requiredConditions: ['카드할인·적립금 제외.', '구매수량 최대 5개.'],
    conditions: ['카드할인·적립금 제외.', '구매수량 최대 5개.'],
    buyUrl: 'https://shop.example/product/1'
  }
};

const shoppingFacts = dealPriceFacts(shopping.copyContext);
const shoppingCandidates = renderCommunityCandidates(shopping, 'daangn', []);
const shoppingLayouts = new Set(shoppingCandidates.map(candidate => candidate.layoutFamily));
assert.ok(shoppingCandidates.length >= 30, 'shopping renderer should produce a broad candidate pool');
assert.ok(shoppingLayouts.size >= 8, 'shopping renderer needs at least eight real body layouts');
const claimGroups = approvedDealClaimGroups(shopping.copyContext, shoppingFacts);
for (const candidate of shoppingCandidates) {
  for (const key of ['price', 'comparisonDiscount', 'unit', 'delivery']) {
    assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, claimGroups[key]), `V5 fact invariant survives V6 wording: ${key}`);
  }
}
assert.ok(shoppingCandidates.every(candidate => candidate.postBody.includes(shopping.copyContext.shipping)));
assert.ok(shoppingCandidates.every(candidate => shopping.copyContext.requiredConditions.every(condition => candidate.postBody.includes(condition))));

const shoppingOpenings = new Set(shoppingCandidates.map(candidate => candidate.postBody.split(/\n\n/)[0]));
assert.ok(shoppingOpenings.size >= 5, 'shopping openings must vary by information order, not synonyms only');
assert.ok(shoppingCandidates.some(candidate => candidate.postBody.split(/\n\n/)[0].includes('배송')));
assert.ok(shoppingCandidates.some(candidate => candidate.postBody.split(/\n\n/)[0].includes('비교하면')));
assert.ok(shoppingFacts.purchaseFit);
assert.ok(shoppingCandidates.some(candidate => candidate.postBody.startsWith(shoppingFacts.purchaseFit)));

const service = {
  type: 'tip',
  sourceUrl: 'https://official.example/service',
  copyContext: {
    kind: 'service',
    intent: 'PUBLIC_SERVICE',
    sourceTitle: '도서관 회원증 하나로 여러 곳에서 대출 가능',
    category: '도서관 이용',
    readerNeed: '책을 구매하기 전에 이용할 수 있는 도서관 찾기',
    editorialAngle: '통합회원증을 사용할 수 있는 참여도서관 확인 순서',
    facts: [
      '참여도서관은 회원증 하나로 이용할 수 있어요.',
      '참여도서관 목록은 공식 홈페이지에 있습니다.',
      '가입과 이용 절차는 도서관별 안내를 따라야 합니다.'
    ],
    requiredFacts: [
      '참여도서관은 회원증 하나로 이용할 수 있어요.',
      '참여도서관 목록은 공식 홈페이지에 있습니다.',
      '가입과 이용 절차는 도서관별 안내를 따라야 합니다.'
    ],
    conditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
    requiredConditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
    url: 'https://official.example/service'
  }
};

const serviceCandidates = renderCommunityCandidates(service, 'daangn', []);
const serviceLayouts = new Set(serviceCandidates.map(candidate => candidate.layoutFamily));
assert.ok(serviceCandidates.length >= 12, 'utility renderer should cross title and body strategies');
assert.ok(serviceLayouts.size >= 8, 'utility renderer needs at least eight real body layouts');
assert.ok(serviceCandidates.every(candidate => service.copyContext.requiredFacts.every(fact => candidate.postBody.includes(fact))));
assert.ok(serviceCandidates.every(candidate => service.copyContext.requiredConditions.every(condition => candidate.postBody.includes(condition))));

const utilityOpenings = new Set(serviceCandidates.map(candidate => candidate.postBody.split(/\n\n/)[0]));
assert.ok(utilityOpenings.size >= 4);
assert.ok(serviceCandidates.some(candidate => candidate.postBody.startsWith(service.copyContext.conditions[0])));
assert.ok(serviceCandidates.some(candidate => candidate.postBody.split(/\n\n/)[1]?.includes(service.copyContext.url)), 'source link can appear after the first paragraph regardless of approved label');

for (const candidate of [...shoppingCandidates, ...serviceCandidates]) {
  const meta = buildCopyMeta(candidate.postTitle, candidate.postBody, {
    styleMode: candidate.styleMode,
    titleStrategy: candidate.titleStrategy,
    bodyStrategy: candidate.bodyStrategy,
    skeleton: candidate.skeleton,
    platform: 'daangn'
  });
  assert.ok(meta.sentenceCount >= 2);
  assert.equal(/저도|제가|써봤|먹어봤|대박|역대급/.test(candidate.postTitle + candidate.postBody), false);
}

console.log('v5 shopping and utility layout diversity checks passed');

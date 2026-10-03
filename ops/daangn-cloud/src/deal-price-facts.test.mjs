import assert from 'node:assert/strict';
import { dealPriceFacts, verifiedDealQuantity } from './deal-price-facts.mjs';
import { renderCommunityCandidates, selectCommunityCopy } from './copy-engine.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import { buildCopyMeta } from './quality-engine.mjs';

const quantity = product => verifiedDealQuantity({ product });
for (const [product, count, unit] of [
  ['베베숲 물티슈 70매 캡 20팩', 20, '팩'],
  ['정성곳간 파불고기 300g x 10팩', 10, '팩'],
  ['물티슈 70매 20팩 x2', 40, '팩'],
  ['물티슈 70매 20팩 × 2박스', 40, '팩'],
  ['두유 190ml 24팩 x2 x3', 144, '팩'],
  ['생리대 20개입 3팩', 3, '팩'],
  ['물티슈 총 40팩 (20팩 x 2)', 40, '팩'],
  ['화장솜 1,000매', 1000, '매'],
  ['마스크 50매 x2박스', 2, '박스'],
  ['미역국 5개입 1세트', 5, '개'],
  ['물티슈 70매 20팩 1박스', 20, '팩'],
  ['밥클럽 아침밥 210g 24개+24개', 48, '개'],
  ['물티슈 70매 10팩 + 20팩', 30, '팩'],
  ['알로에 수분크림 1000ml 2개', 2, '개']
]) {
  assert.deepEqual([quantity(product)?.count, quantity(product)?.unit], [count, unit], product);
}
for (const product of ['샴푸 1+1 2개', '샴푸 1+1', 'A샴푸 2개+B크림 2개', '물티슈 20팩 + 10팩 증정', '물티슈 10~20팩', '물티슈 10팩/20팩 선택', '여성 원피스 55 66', '쌀 10kg', '물티슈 10팩 20팩', '혼합 간식 20봉', '물티슈 2박스 20팩', '츠바키 프리미엄 볼륨 앤 리페어 샴푸 + 트리트먼트 + 츠바키 샤쉐 4매', '샴푸 및 트리트먼트 2개', '샴푸 & 트리트먼트 2개', '샴푸 사은품 4개', '물티슈 총 20팩 x2', '샴푸 3개 묶음 x2', 'x2 샴푸 3개', '아기 이유식 6개월부터', '유산균 60정 2개월분', '물티슈 총 80팩 (20팩 x2)']) {
  assert.equal(quantity(product), null, product);
}
assert.equal(verifiedDealQuantity({ product: '샴푸 1+1', quantity: { count: 2, unit: '개', verified: false } }), null);
assert.equal(verifiedDealQuantity({ product: '샴푸 1+1', quantity: { count: 2, unit: '개', verified: true } }).count, 2);

const ctx = { kind: 'hotdeal', currentOffer: true, product: '베베숲 물티슈 70매 캡 20팩', price: 23900,
  referencePrice: 34130, referenceLabel: '판매처 할인 전 표시가', saving: 10230, priceLabel: '상품가',
  shipping: '기본배송 무료 (제주·도서산간 조건 별도)', requiredConditions: ['카드할인·적립금 제외.', '구매수량 최대 5개.'], buyUrl: 'https://example.test/product' };
const facts = dealPriceFacts(ctx);
assert.equal(facts.saving, 10230);
assert.equal(facts.discountPct, 29.9);
assert.equal(facts.discountPctFloor, 29);
assert.equal(facts.unitPriceRounded, 1195);
assert.equal(facts.unitPriceText, '팩당 1,195원');
assert.equal(facts.priceLine, '상품가는 23,900원입니다.');
assert.equal(facts.comparisonLine, '판매처 할인 전 표시가 34,130원과 비교하면');
assert.equal(facts.discountLine, '10,230원 낮아졌고, 할인율은 약 29.9%예요.');
assert.equal(facts.unitLine, '총 20팩 구성이고, 상품가 기준 팩당 1,195원이에요.');
const recurring = dealPriceFacts({ ...ctx, product: '샴푸 3개', price: 10000, referencePrice: 15000, saving: 5000 });
assert.equal(recurring.unitPriceText, '개당 약 3,334원');
assert.equal(recurring.unitPriceRounded >= recurring.unitPrice, true, 'approximate prices must never understate the calculated cost');
assert.equal(dealPriceFacts({ ...ctx, saving: 12000 }).hasComparison, false, 'inconsistent savings must not produce a comparison');
assert.equal(dealPriceFacts({ ...ctx, referenceLabel: '' }).hasComparison, false, 'do not invent a normal/standard price label');
assert.equal(dealPriceFacts({ ...ctx, product: '쌀 10kg' }).unitLine, '', 'unknown item counts cannot produce a per-item price');
assert.equal(dealPriceFacts({ ...ctx, product: '샴푸 + 트리트먼트 + 샤쉐 4매', price: 23320 }).unitLine, '', 'gift/sample counts must not divide the bundle price');

for (const candidate of renderCommunityCandidates({ copyContext: ctx })) {
  assert.ok(candidate.postTitle.length <= 62);
  assert.ok(candidate.postTitle.includes('베베숲'));
  assert.ok(candidate.postBody.includes(facts.comparisonLine));
  assert.ok(candidate.postBody.includes(facts.priceLine));
  assert.ok(candidate.postBody.includes(facts.discountLine));
  assert.ok(candidate.postBody.includes(facts.unitLine));
  assert.ok(candidate.postBody.includes(ctx.shipping));
  assert.ok(ctx.requiredConditions.every(condition => candidate.postBody.includes(condition)));
  assert.ok(!/아끼|덜 들어|최저가|역대급|써봤/.test(candidate.postTitle + candidate.postBody));
}
const couponCandidates = renderCommunityCandidates({ copyContext: { ...ctx, coupon: true, priceLabel: '쿠폰 적용가' } });
assert.ok(couponCandidates.every(candidate => candidate.postTitle.includes('쿠폰가') && candidate.postBody.includes('쿠폰 적용가는 23,900원')));
const longNameCandidates = renderCommunityCandidates({ copyContext: { ...ctx, product: '수분크림 60ml 2개 ' + '피부 보습 관리 '.repeat(10) } });
for (const candidate of longNameCandidates) {
  assert.ok(candidate.postTitle.length <= 62);
  assert.equal((candidate.postTitle.match(/60ml/g) || []).length, 1);
  assert.equal((candidate.postTitle.match(/2개/g) || []).length, 1);
}
const deliveryCtx = { ...ctx, delivery: { total: 23900 } };
const deliveryCandidate = renderCommunityCandidates({ copyContext: deliveryCtx })[0];
assert.ok(deliveryCandidate.postTitle.startsWith('물티슈 떨어져 가는 집,'));
assert.equal(deliveryCandidate.postBody.split('\n\n')[0].includes('상품가는 23,900원'), true);
assert.ok(deliveryCandidate.postBody.includes('기본배송 지역에서는 배송비까지 23,900원입니다.'));
assert.ok(!/구매 조건은|입니다\.입니다|제외\.,/.test(deliveryCandidate.postBody));
assert.deepEqual(growthCopyFailures({ copyContext: deliveryCtx }, deliveryCandidate), []);
for (const [field, reason] of [['priceLine', 'price_total_omitted'], ['deliveryLine', 'delivered_total_omitted']]) {
  const body = deliveryCandidate.postBody.replace(dealPriceFacts(deliveryCtx)[field], '');
  assert.ok(growthCopyFailures({ copyContext: deliveryCtx }, { ...deliveryCandidate, postBody: body }).includes(reason));
}
// Find a deterministic product that receives an occasional question. Legacy
// history without prompt metadata must still suppress it after two questions.
let questionCtx;
for (let i = 0; i < 20; i += 1) {
  const candidateCtx = { ...ctx, product: `${String.fromCharCode(65 + i)} 물티슈 70매 20팩` };
  if (renderCommunityCandidates({ copyContext: candidateCtx })[0].postBody.includes('다시 주문하세요?')) { questionCtx = candidateCtx; break; }
}
assert.ok(questionCtx);
const withQuestion = renderCommunityCandidates({ copyContext: questionCtx })[0];
assert.equal(buildCopyMeta(withQuestion.postTitle, withQuestion.postBody).ctaCount, 1);
const recentQuestions = [{ bodyText: '질문 하나?\nhttps://example.test/a' }, { bodyText: '질문 둘?', copyMeta: { ctaCount: 0 } }];
assert.ok(renderCommunityCandidates({ copyContext: questionCtx }, 'daangn', recentQuestions).every(candidate => !candidate.postBody.includes('다시 주문하세요?')));
const recentActions = [{ bodyText: '공지를 참고하세요.' }, { bodyText: '조건을 확인하세요.', copyMeta: { ctaCount: 0 } }];
assert.ok(renderCommunityCandidates({ copyContext: questionCtx }, 'daangn', recentActions).every(candidate => !candidate.postBody.includes('다시 주문하세요?')));
const selected = selectCommunityCopy({ type: 'hotdeal', price: ctx.price, sourceUrl: ctx.buyUrl, verification: { status: 'verified' }, copyContext: ctx });
assert.equal(selected.copyRejected, false);
assert.equal(selected.titleStrategy, 'SHOPPING_READER_PRICE');
console.log('deal price facts: verified reference, non-inflated discount, nested pack counts, conservative unknowns, unit arithmetic and copy passed');


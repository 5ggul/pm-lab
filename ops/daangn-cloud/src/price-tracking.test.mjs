import assert from 'node:assert/strict';
import { observePrice, trackingCopy, trackingWatchlist, deliveryQuote, preparePriceUpdates, trackingReport } from './price-tracking.mjs';
import { buildComparisons } from './editorial-sources.mjs';
import { verifiedGtin } from './shopping-offers.mjs';
import { renderCommunityCandidates, selectCommunityCopy } from './copy-engine.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import { runReservedPublish } from './publish-journal.mjs';

const url = 'https://www.11st.co.kr/products/123';
const start = new Date('2026-10-01T03:00:00Z');
const on = n => new Date(+start + n * 864e5);
const offer = { ok: true, category: '생필품', product: '테스트 물티슈 70매 10팩', productIdentity: '11st:123', sellerKey: '11st:seller',
  price: 10000, shippingCost: null, baseShippingCost: 0, coupon: false, options: [] };
const history = { oldUnverifiedPrices: [5000] };
let snapshot = observePrice(history, offer, url, start);
assert.equal(trackingCopy(snapshot).hook, '');
assert.match(trackingCopy(snapshot).line, /기록이 1일뿐이라.*더 지켜봐야/);
assert.equal(observePrice(history, { ...offer, ok: false }, url, start), null);
assert.equal(observePrice(history, { ...offer, options: ['10팩', '20팩'] }, url, start), null);
assert.equal(deliveryQuote({ price: 10000, shippingCost: null }), null, 'unknown shipping cannot become free');
assert.equal(deliveryQuote({ price: 10000, shippingCost: 3000 }).total, 13000);
observePrice(history, offer, url, start);
assert.equal(Object.values(history.trackedOffersV1)[0].days[0].count, 1, 'same observation must be idempotent');
for (let n = 1; n <= 6; n++) snapshot = observePrice(history, offer, url, on(n));
assert.equal(trackingCopy(snapshot).enough7, false, 'today plus six earlier days is not seven prior days');
snapshot = observePrice(history, { ...offer, price: 9000 }, url, on(7));
const facts = trackingCopy(snapshot);
assert.equal(facts.enough7, true);
assert.equal(facts.median7, 10000);
assert.equal(facts.weekDrop, 1000);
assert.match(facts.hook, /1,000원/);
assert.equal(facts.enough30, false);
const changedPack = observePrice(history, { ...offer, product: '테스트 물티슈 70매 20팩' }, url, on(7));
assert.notEqual(changedPack.key, snapshot.key);
assert.equal(trackingCopy(changedPack).observedDays, 1);
assert.notEqual(observePrice(history, { ...offer, coupon: true }, url, on(7)).key, snapshot.key);
assert.notEqual(observePrice(history, { ...offer, sellerKey: 'another' }, url, on(7)).key, snapshot.key);
assert.equal(trackingCopy({ ...snapshot, days: snapshot.days.filter(x => x.day !== '2026-10-03') }).enough7, false);
assert.ok(trackingWatchlist(history, [{ status: 'published', topic: '생필품', sourceUrl: url }], on(7)).some(x => x.url === url));
assert.ok(trackingReport(history).dailyObservations >= 8);

const ctx = { kind: 'hotdeal', currentOffer: true, product: offer.product, category: '생필품', price: 9000,
  referencePrice: 12000, referenceLabel: '판매처 할인 전 표시가', saving: 3000, benefitPercent: 25,
  shipping: '기본배송 무료 (제주·도서산간 조건 별도)', delivery: deliveryQuote({ ...offer, price: 9000 }),
  tracking: snapshot, buyUrl: url, requiredConditions: ['카드할인·적립금 제외'], claims: [{ value: 9000, verified: true, sourceUrl: url }] };
const item = { id: 'hot:' + url, sourceUrl: url, buyUrl: url, type: 'hotdeal', price: 9000, trustScore: 96,
  verification: { status: 'verified', observedAt: on(7).toISOString() }, copyContext: ctx };
const published = [{ status: 'published', publishedAt: start.toISOString(), sourceUrl: url, priceRecord: { key: snapshot.key, price: 10000 } }];
const update = preparePriceUpdates([item], published, {}, on(7))[0];
assert.equal(update.priceUpdate, true);
assert.equal(preparePriceUpdates([item], published, {}, on(6))[0].priceUpdate, undefined);
assert.equal(preparePriceUpdates([item], [{ ...published[0], priceRecord: undefined }], {}, on(7))[0].priceUpdate, undefined, 'never infer an old published price');
assert.equal(preparePriceUpdates([item], published, { unknown: { sourceUrl: url, status: 'publish_unknown' } }, on(7))[0].priceUpdate, undefined);
const small = { ...item, copyContext: { ...ctx, tracking: { ...snapshot, price: 9800 } } };
assert.equal(preparePriceUpdates([small], published, {}, on(7))[0].priceUpdate, undefined);
const updateCopy = selectCommunityCopy(update);
assert.equal(updateCopy.copyRejected, false, JSON.stringify(updateCopy.copyRejectReasons));
assert.ok(updateCopy.postBody.includes('이전 게시가 10,000원 → 9,000원'));
for (const copy of renderCommunityCandidates(item)) {
  assert.ok(copy.postBody.includes(facts.line));
  assert.ok(copy.postBody.includes('기본배송 지역에서는 배송비까지 9,000원입니다.'));
  assert.ok(growthCopyFailures(item, { ...copy, postBody: copy.postBody.replace(facts.line, '') }).includes('price_history_omitted'));
}
const journal = {};
await runReservedPublish({ item: updateCopy, key: 'fixture', slot: 'fixture-slot', journal, persist: async () => {}, publish: async () => ({ status: 'published', postUrl: 'https://example.test/post' }), now: () => on(7) });
assert.deepEqual(journal['fixture-slot'].record.priceRecord, update.priceRecord, 'price proof survives a runner crash after publishing');
assert.equal(preparePriceUpdates([item], [...published, journal['fixture-slot'].record], {}, on(15))[0].priceUpdate, undefined, 'same price never sends another alert');
for (let n = 8; n < 30; n++) observePrice(history, offer, url, on(n));
const lowest = observePrice(history, { ...offer, price: 8000 }, url, on(30));
assert.equal(trackingCopy(lowest).enough30, true);
assert.equal(trackingCopy(lowest).hook, '최근 30일 관측 최저가');
assert.equal(verifiedGtin('8801234567893'), '08801234567893');
assert.equal(verifiedGtin('8801234567890'), '');
assert.equal(verifiedGtin('0000000000000'), '');

const comparable = (sourceUrl, cost) => ({ ...item, sourceUrl, copyContext: { ...ctx, productIdentity: 'verified-gtin', productIdentityVerified: true, quantityVerified: true, unitInfo: { count: 10, unit: '팩' }, deliveredPrice: cost, deliveryScope: '기본배송 지역', eligibilityKey: 'public' } });
const a = comparable(url, 10000), b = comparable('https://www.gsshop.com/prd/prd.gs?prdid=99', 12000);
assert.equal(buildComparisons([a, b]).length, 1);
for (const patch of [{ productIdentity: '' }, { productIdentity: 'other' }, { unitInfo: { count: 20, unit: '팩' } }, { deliveryScope: '제주' }, { eligibilityKey: 'members' }, { deliveredPrice: null }]) {
  assert.equal(buildComparisons([a, { ...b, copyContext: { ...b.copyContext, ...patch } }]).length, 0);
}
console.log('price tracking: cold start, 7/30-day coverage, shipping basis, identity separation, safe re-alerts, durable proof and comparable bundles passed');

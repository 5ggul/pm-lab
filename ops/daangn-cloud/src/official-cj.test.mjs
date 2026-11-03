import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CJ_MARKET_HOME, CJ_MARKET_METHOD, parseCjOfficialListings, readCjOfficialDetail, verifyCjOfficialDetail } from './official-cj.mjs';
import { collectShopping } from './shopping-supply.mjs';
import { recheckItem } from './source-recheck.mjs';
import { imageSafetyPlan, buildInfoCardModel } from './image-safety.mjs';
import { planItem } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine-v6.mjs';
import { runtimeDraftFailures } from './work-hardening.mjs';

const ID = '40213293';
const NAME = '[UPCYCLE]햇반 윤기가득쌀밥 210g, 36개';
const URL = 'https://www.cjthemarket.com/the/product/product-main?prdCd=' + ID;

// The official page uses Nuxt's indexed JSON table. This fixture deliberately
// produces those references instead of a flat JSON object that production
// parsers never encounter.
function html({
  id = ID, name = NAME, stockAmount = '99999', isSoldOutStatus = false,
  stockYn = 'Y', status = 'P', origin = 75600, price = 40824,
  discountPercent = 46, freeShip = true, orginFreeShip = true,
  maxBuy = 3, timeSaleFlag = 'N', pageTitle = name, visiblePrice = price,
  visibleReference = origin, showFreeShipping = true, addDuplicate = false
} = {}) {
  const refs = [];
  const put = value => (refs.push(value), refs.length - 1);
  const putObj = shape => put(Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, put(value)])
  ));
  const base = putObj({
    prdCd: id, prdNm: name, prdTyCd: '01',
    prdStatCd: status, stockYn, isSoldOutStatus,
    reservationSaleUseYn: 'N', slpkPrdYn: 'N',
    nplusnYn: false, minBuyQty: 1, onceMaxBuyQty: maxBuy
  });
  const priceInfo = putObj({
    origin, discount: price, percent: discountPercent,
    primeDiscount: 0, firstBuyDiscount: 5000, staffDiscountPrice: 0
  });
  const deliveryInfo = putObj({
    freeShip, orginFreeShip, thirdPartyShip: false, storeShip: false
  });
  const stockInfo = putObj({ amount: stockAmount });
  const timeSale = putObj({ flagYn: timeSaleFlag });
  const record = { base, priceInfo, deliveryInfo, stockInfo, timeSale };
  put(record);
  if (addDuplicate) put(record);
  const won = value => Number(value).toLocaleString('ko-KR') + '원';
  return '<!doctype html><html><head><title>' + pageTitle + '</title></head><body>' +
    '<main><h1>' + name + '</h1><span>' + won(visiblePrice) + '</span>' +
    '<span>' + won(visibleReference) + '</span><span>' +
    (showFreeShipping ? '무료배송' : '배송비 별도') + '</span></main>' +
    '<script id="__NUXT_DATA__" type="application/json">' + JSON.stringify(refs) +
    '</script></body></html>';
}

test('the official CJ Nuxt page yields one public, in-stock, free-shipping discount', () => {
  const offers = parseCjOfficialListings(html({ addDuplicate: true }));
  assert.equal(offers.length, 1);
  const offer = offers[0];
  assert.equal(offer.url, URL);
  assert.equal(offer.price, 40824);
  assert.equal(offer.referencePrice, 75600);
  assert.equal(offer.category, '먹거리·장보기');
  assert.equal(offer.shippingCost, null);
  assert.equal(offer.expiresAt, null);
  assert.equal(offer.imageUrl, '');
  assert.equal(offer.coupon, false);
  assert.equal(offer.method, CJ_MARKET_METHOD);
  assert.equal(offer.conditions.some(x => x.includes('첫구매')), true);
  assert.equal(readCjOfficialDetail(html(), URL)?.fingerprint, offer.fingerprint);
});

test('CJ source rejects unknown stock, conditional offers and misleading shipping', () => {
  const changes = [
    { stockAmount: '0' },
    { stockAmount: 'unknown' },
    { stockYn: 'N' },
    { isSoldOutStatus: true },
    { status: 'S' },
    { origin: 40824 },
    { price: 0 },
    { price: 5000 },
    { origin: 80600 },
    { discountPercent: 50 },
    { freeShip: false },
    { orginFreeShip: false },
    { timeSaleFlag: 'Y' },
    { name: '첫구매 특가상품 햇반 36개' },
    { name: '햇반 24개 골라담기' },
    { name: '불분명한 상품' },
    { maxBuy: 0 }
  ];
  for (const change of changes) {
    assert.equal(parseCjOfficialListings(html(change)).length, 0, JSON.stringify(change));
  }
});

test('CJ detail must match product identity and visible public price', () => {
  assert.equal(readCjOfficialDetail(html({ visiblePrice: 40000 }), URL), null);
  assert.equal(readCjOfficialDetail(html({ visibleReference: 77000 }), URL), null);
  assert.equal(readCjOfficialDetail(html({ showFreeShipping: false }), URL), null);
  assert.equal(readCjOfficialDetail(html({ pageTitle: '다른 상품' }), URL), null);
  assert.equal(readCjOfficialDetail(html(), 'https://example.com/?prdCd=' + ID), null);
  assert.equal(readCjOfficialDetail(html(), URL.replace(ID, '40111111')), null);
  assert.equal(parseCjOfficialListings('<html><body>No merchant data</body></html>').length, 0);
});

test('CJ listings enter the existing quality, image and just-before-publish recheck gates', async () => {
  const merchant = html();
  const state = { published: [], priceHistory: {} };
  const fetcher = async url => {
    if (url === CJ_MARKET_HOME || url === URL) return { url, text: merchant };
    throw new Error('no other source in integration fixture');
  };
  const collected = await collectShopping(state, fetcher, new Date());
  assert.equal(collected.length, 1);
  const item = collected[0];
  assert.equal(item.buyUrl, URL);
  assert.equal(item.originUrl, CJ_MARKET_HOME);
  assert.equal(item.verification.method, CJ_MARKET_METHOD);
  assert.equal(item.verification.evidenceUrl, URL);
  assert.ok(item.copyContext.claims.every(claim => claim.sourceUrl === URL));
  assert.equal(item.imageUsageApproved, false);
  assert.equal(imageSafetyPlan(item).mode, 'generated_card');
  assert.equal(buildInfoCardModel(item).badge, 'CJ더마켓 상품 페이지 확인값');
  assert.equal(state.shoppingDiagnostics.cjOfficialListing.verifiedOffers, 1);
  assert.equal((await recheckItem(item, [], fetcher)).ok, true);

  const settings = JSON.parse(fs.readFileSync(new globalThis.URL('../growth-config.json', import.meta.url), 'utf8'));
  const editorialPlan = planItem(item, settings, new Date());
  assert.equal(editorialPlan.status, 'eligible', JSON.stringify(editorialPlan.reasons));
  const post = selectCommunityCopy({ ...item, editorialPlan }, [], 'daangn', {});
  assert.equal(post.copyRejected, false);
  assert.ok(post.qualityScores.finalScore >= settings.minCopyQuality);
  assert.deepEqual(runtimeDraftFailures(post), []);

  const changedHtml = html({ price: 35000, discountPercent: 54, visiblePrice: 35000 });
  assert.equal(verifyCjOfficialDetail(item, changedHtml, URL).ok, false);
  assert.equal((await recheckItem(item, [], async url => ({ url, text: changedHtml }))).ok, false);
  assert.equal(verifyCjOfficialDetail({ ...item, originUrl: 'https://untrusted.invalid' }, merchant, URL).ok, false);
});

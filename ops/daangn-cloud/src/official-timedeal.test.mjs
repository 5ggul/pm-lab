import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialTimeDeals, verifyOfficialTimeDeal, ELEVEN_TIMEDEAL_URL, ELEVEN_TIMEDEAL_METHOD } from './official-timedeal.mjs';
import { collectShopping } from './shopping-supply.mjs';
import { recheckItem } from './source-recheck.mjs';
import { buildInfoCardModel, imageSafetyPlan } from './image-safety.mjs';
import { planItem } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine-v6.mjs';
import { runtimeDraftFailures } from './work-hardening.mjs';
import fs from 'node:fs';

const NOW = new Date('2026-11-03T02:00:00.000Z');
const DEADLINE = NOW.getTime() + 2 * 3600_000;
const PRODUCT = '팔도 뽀로로 어린이 음료 24병';
const PRODUCT_ID = '8877032932';
const PRODUCT_URL = 'https://www.11st.co.kr/products/' + PRODUCT_ID;

function card({
  id = PRODUCT_ID, title = PRODUCT, displayPrice = '15,900',
  displayReference = '23,250원', logPrice = '15900', logReference = '23250',
  logStatus = 'on_sale', status = '판매중', special = '타임딜가',
  shipping = '무료배송', stock = '492개 남음', expiry = DEADLINE,
  href = 'http://m.11st.co.kr/MW/Product/productBasicInfo.tmall?prdNo=' + id
} = {}) {
  const log = JSON.stringify({
    product_no: id, product_price: logReference,
    last_discount_price: logPrice, deal_status: logStatus
  }).replaceAll('"', '&quot;');
  return '<a class="c-card c-card__deal" href="' + href + '" data-log-body="' + log + '">' +
    '<span class="c-card-badge__status--active">' + status + '</span>' +
    '<span class="c-card__special">' + special + '</span>' +
    '<span class="c-card__name">' + title + '</span>' +
    '<span class="c-card__price"><strong>' + displayPrice + '</strong><del>' + displayReference + '</del></span>' +
    '<span class="c-card__benefit"><span class="benefit">' + shipping + '</span></span>' +
    '<span class="c-card__qty">' + stock + '</span>' +
    '<span class="c-card-badge__time" data-enddt="' + expiry + '"></span></a>';
}

function offers(html, at = NOW) { return parseOfficialTimeDeals(html, at); }

test('parses only a complete official offer with current price, shipping, stock and end time', () => {
  const parsed = offers(card());
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, PRODUCT_URL);
  assert.equal(parsed[0].price, 15900);
  assert.equal(parsed[0].referencePrice, 23250);
  assert.equal(parsed[0].category, '육아·아동');
  assert.equal(parsed[0].shippingCost, null);
  assert.equal(parsed[0].imageUrl, '');
  assert.equal(parsed[0].method, ELEVEN_TIMEDEAL_METHOD);
  assert.ok(parsed[0].fingerprint.length >= 32);
  assert.equal(parsed[0].conditions.some(x => x.startsWith('할인 기한: ')), true);
});

test('deduplicates identical official product cards', () => {
  assert.equal(offers(card() + card()).length, 1);
});

test('rejects incomplete, paid-shipping, expired, stockless or mismatched claims', () => {
  const cases = [
    { displayPrice: '15,800' },
    { displayReference: '23,000원' },
    { displayPrice: '15,900~' },
    { displayReference: '' },
    { logPrice: '15000' },
    { logReference: '23500' },
    { logStatus: 'sold_out' },
    { status: '판매종료' },
    { special: '특가' },
    { shipping: '배송비 별도' },
    { stock: '품절' },
    { stock: '0개 남음' },
    { expiry: NOW.getTime() - 1 },
    { expiry: NOW.getTime() + 10 * 60_000 },
    { expiry: NOW.getTime() + 49 * 3600_000 },
    { href: 'https://example.com/MW/Product/productBasicInfo.tmall?prdNo=' + PRODUCT_ID },
    { href: 'http://m.11st.co.kr/MW/Product/productBasicInfo.tmall?prdNo=99999123' },
    { title: '팔도 음료 골라담기 24병' },
    { title: '팔도 음료 옵션 선택 24병' },
    { title: '팔도 음료 신규회원 24병' },
    { title: '팔도 음료 유통기한 임박 24병' },
    { title: '불명확한 상품명' }
  ];
  for (const change of cases) {
    assert.equal(offers(card(change)).length, 0, JSON.stringify(change));
  }
});

test('collects listing-only official deals without claiming photo rights or product page check', async () => {
  const runtimeNow = new Date();
  const html = card({ expiry: runtimeNow.getTime() + 4 * 3600_000 });
  const state = { published: [], priceHistory: {} };
  const fetcher = async url => {
    if (url === ELEVEN_TIMEDEAL_URL) return { url, text: html };
    throw new Error('test: other feeds unavailable');
  };
  const found = await collectShopping(state, fetcher, runtimeNow);
  assert.equal(found.length, 1);
  const item = found[0];
  assert.equal(item.sourceUrl, PRODUCT_URL);
  assert.equal(item.originUrl, ELEVEN_TIMEDEAL_URL);
  assert.equal(item.verification.method, ELEVEN_TIMEDEAL_METHOD);
  assert.equal(item.verification.evidenceUrl, ELEVEN_TIMEDEAL_URL);
  assert.ok(item.copyContext.claims.every(claim => claim.sourceUrl === ELEVEN_TIMEDEAL_URL));
  assert.equal(item.imageUsageApproved, false);
  assert.equal(imageSafetyPlan(item).mode, 'generated_card');
  assert.equal(buildInfoCardModel(item).badge, '판매처 타임딜 목록 확인값');
  assert.equal(state.shoppingDiagnostics.officialListing.verifiedOffers, 1);
  const config = JSON.parse(fs.readFileSync(new URL('../growth-config.json', import.meta.url), 'utf8'));
  const editorialPlan = planItem(item, config, runtimeNow);
  assert.equal(editorialPlan.status, 'eligible');
  const draft = selectCommunityCopy({ ...item, editorialPlan }, [], 'daangn', {});
  assert.equal(draft.copyRejected, false);
  assert.ok(draft.qualityScores.finalScore >= config.minCopyQuality);
  assert.deepEqual(runtimeDraftFailures(draft), []);
  assert.equal((await recheckItem(item, [], fetcher)).ok, true);
  const redirected = await recheckItem(item, [], async url => ({ url: url + '/other', text: html }));
  assert.equal(redirected.ok, false);
  const changed = await recheckItem(item, [], async url => ({ url, text: card({
    expiry: runtimeNow.getTime() + 4 * 3600_000, stock: '0개 남음'
  }) }));
  assert.equal(changed.ok, false);
});

test('recheck rejects a changed offer and unsafe evidence source, accepts exact unchanged offer', () => {
  const [offer] = offers(card());
  const item = {
    originUrl: ELEVEN_TIMEDEAL_URL, buyUrl: PRODUCT_URL,
    verification: { method: ELEVEN_TIMEDEAL_METHOD, evidenceUrl: ELEVEN_TIMEDEAL_URL, fingerprint: offer.fingerprint },
    copyContext: { price: 15900 }
  };
  assert.equal(verifyOfficialTimeDeal(item, card(), NOW).ok, true);
  assert.equal(verifyOfficialTimeDeal(item, card({ displayPrice:'15,500', logPrice:'15500' }), NOW).ok, false);
  assert.equal(verifyOfficialTimeDeal(item, card({ stock:'0개 남음' }), NOW).ok, false);
  assert.equal(verifyOfficialTimeDeal(item, card(), new Date(DEADLINE + 1)).ok, false);
  assert.equal(verifyOfficialTimeDeal({ ...item, originUrl:'https://example.com/' }, card(), NOW).ok, false);
  assert.equal(verifyOfficialTimeDeal({ ...item, buyUrl:'https://example.com/' }, card(), NOW).ok, false);
});

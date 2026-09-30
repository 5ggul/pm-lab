import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readShoppingOffer, familyCategory, shoppingUrl } from './shopping-offers.mjs';
import { collectShopping } from './shopping-supply.mjs';
import { planItem, chooseItem } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import { recheckItem } from './source-recheck.mjs';

const now = new Date('2026-09-28T04:00:00Z');
const url = 'https://www.gsshop.com/prd/prd.gs?prdid=123';
const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const data = {
  prd: { prdCd: 123, exposPrdNm: '물티슈 70매 10팩', tempoutYn: 'N', prdSaleSt: 'Y', salePsblGbn: { ordButtn: 'Y' },
    attrTypCnt: 0, attrTypGrgCnt: 0, freeDlvFlg: 'Y', prdDtlArea: { supCd: 456 },
    dlvRfnArea: { dlvInfoGrp: { dlvTxt: '무료배송', addDlvcInfo: '제주 5,000원' } } },
  pmo: { cpnFlg: 'Y', cpnApplyPrc: 12960, gsPrc: 12960, cpnTypCd: '1', dbcpnNo: 0, cpnLabel: '10%', cpnRtAmt: 10,
    couponUseStr: '2026/09/28 (월) 23시', prc: { salePrc: 14400, flgdPrc: 12960, cpnDcAmt: 1440, totDcAmt: 1440 } }
};
const html = (j = data, displayed = 12960) => `<meta property="og:image" content="https://shop.example/test.jpg"><span class="price-definition-ins"><strong>${displayed}</strong></span><script>var renderJson = ${JSON.stringify(j)};</script>`;
const good = readShoppingOffer(html(), url, { product: '물티슈 70매 10팩', price: 12960 }, now);
assert.equal(good.ok, true);
assert.equal(good.category, '생필품');
assert.ok(good.conditions.some(x => x.includes('제주 5,000원')));
assert.ok(good.conditions.some(x => x.includes('10%')));
const change = fn => { const j = structuredClone(data); fn(j); return html(j); };
for (const bad of [
  change(j => j.prd.tempoutYn = 'Y'), change(j => j.prd.prdCd = 124),
  change(j => j.pmo.prc.cpnDcAmt = 2000), change(j => j.pmo.cpnLabel = '30%'),
  change(j => j.pmo.couponUseStr = '2026/09/27 (일) 23시'),
  change(j => j.pmo.isVipCouponlimitMsg = true), change(j => j.prd.attrTypCnt = 1),
  change(j => j.prd.dlvRfnArea.dlvInfoGrp.dlvTxt = '조건부 무료'), html(data, 13960)
]) assert.equal(readShoppingOffer(bad, url, {}, now).ok, false);
assert.equal(readShoppingOffer(html(), url, { product: '여성 니트 원피스', price: 12960 }, now).ok, false);
assert.equal(readShoppingOffer(html(), 'https://evil.example/prd/prd.gs?prdid=123', {}, now).ok, false);
const optionData = structuredClone(data);
Object.assign(optionData.prd, { attrTypCnt: 1, attrTypGrgCnt: 1, prdAttrTypCd: 'S', addCmposPrdExistFlg: 'N',
  attrTypList: [{ attrPrdCd: 123001, attrTypVal: '캡형 10팩', stockFlg: 'N' }, { attrPrdCd: 123002, attrTypVal: '리필 10팩', stockFlg: 'Y' }] });
optionData.pmo.prc.minPrc = 12960;
const optionOffer = readShoppingOffer(html(optionData), url, {}, now);
assert.equal(optionOffer.ok, true);
assert.ok(optionOffer.conditions.some(x => x.includes('캡형 10팩')));
assert.ok(optionOffer.conditions.every(x => !x.includes('리필 10팩')));
optionData.pmo.prc.minPrc = 10000;
assert.equal(readShoppingOffer(html(optionData), url, {}, now).ok, false);
for (const title of ['배달 종사자 보험료 할인', '남성 니트', 'RTX 5090', '골프채', '대출 우대금리']) assert.equal(familyCategory(title), null);
for (const title of ['아기 기저귀', '선크림', '여성 가디건', '주방 밀폐용기', '쌀 10kg', '물티슈 10팩']) assert.ok(familyCategory(title));
assert.equal(shoppingUrl('https://m.harimmall.com/product/detail.html?product_no=1927&cate_no=12'), shoppingUrl('https://harimmall.com/product/detail.html?product_no=1927'));

const cafeUrl = 'https://harimmall.com/product/detail.html?product_no=1927';
const cafeHtml = ({ price = 24000, displayed = 24000, extra = 0, soldout = 'F' } = {}) => {
  const variants = ['고소한맛 15팩', '흑임자 15팩'].map(name => ({ '@type': 'Product', name: '닭가슴살 프로틴 ' + name,
    image: ['https://shop.example/product.jpg'], brand: { name: '하림몰' }, offers: { price: 45000, availability: 'https://schema.org/InStock', priceValidUntil: '2099-10-01 00:00' } }));
  const group = { '@type': 'ProductGroup', productGroupID: 'cafe24_fixture_1_1927', name: '닭가슴살 프로틴 15팩', hasVariant: variants };
  const stock = Object.fromEntries(variants.map((v, i) => [i, { option_value: v.name, is_selling: 'T', is_display: 'T', use_soldout: soldout, stock_price: extra, origin_option_added_price: extra }]));
  const escaped = JSON.stringify(JSON.stringify(stock)).slice(1, -1);
  return `<meta property="product:productId" content="1927"><meta property="product:sale_price:amount" content="${price}"><meta property="product:sale_price:currency" content="KRW"><script type="application/ld+json">${JSON.stringify(group)}</script><span id="span_product_price_sale">${displayed}원</span><a benefit="DP"></a><table><tr rel="배송비"><td>조건부 무료</td></tr></table><script>var option_stock_data = '${escaped}';var product_sale_price = ${price};</script>`;
};
const cafe = readShoppingOffer(cafeHtml(), cafeUrl, { product: '닭가슴살 프로틴 흑임자', price: 24000 }, now);
assert.equal(cafe.ok, true);
assert.equal(cafe.shippingCost, null, 'conditional free shipping must never be treated as zero');
assert.ok(cafe.conditions.includes('표시 가격에 배송비는 포함되지 않았습니다.'));
for (const opts of [{ displayed: 25000 }, { extra: 1000 }, { soldout: 'T' }]) assert.equal(readShoppingOffer(cafeHtml(opts), cafeUrl, {}, now).ok, false);

// Exercise discovery -> merchant verification -> editorial score -> copy,
// without any history baseline or browser publication.
const feed = `<article class="card"><h2 class="title">물티슈 70매 10팩</h2><span data-card-price>12,960원</span><a class="buy" href="${url}"></a><a class="origin" href="https://community.example/deal"></a></article>`;
const state = { published: [], priceHistory: {} };
const fetcher = async target => ({ url: target, text: target.includes('dilluk') ? feed : target === url ? html() : '<body></body>' });
// collectShopping uses the actual clock for the final fresh price check.
const future = structuredClone(data); future.pmo.couponUseStr = '2099/09/28 (월) 23시';
const liveFetcher = async target => target === url ? { url: target, text: html(future) } : fetcher(target);
const items = await collectShopping(state, liveFetcher);
assert.equal(items.length, 1);
const item = items[0];
item.editorialPlan = planItem(item, config);
assert.equal(item.editorialPlan.status, 'eligible');
const copy = selectCommunityCopy(item);
assert.equal(copy.copyRejected, false);
assert.ok(copy.postTitle.includes('쿠폰가'));
assert.equal(item.imageUsageApproved, true);
assert.equal(item.imageRequired, true);
assert.equal(item.copyContext.referencePrice, 14400);
assert.equal(item.copyContext.saving, 1440);
assert.ok(copy.postBody.includes('14,400원 → 쿠폰 적용가 12,960원'));
assert.ok(copy.postBody.includes('1,440원 할인 (10%)'));
assert.ok(!/최저가|내려왔|0원 차이|기준가/.test(copy.postBody));
assert.ok(copy.copyContext.requiredConditions.every(x => copy.postBody.includes(x)));
assert.equal((await recheckItem(copy, [], async () => ({ url, text: html(future) }))).ok, true);
const changed = structuredClone(future); changed.prd.dlvRfnArea.dlvInfoGrp.addDlvcInfo = '제주 7,000원';
assert.equal((await recheckItem(copy, [], async () => ({ url, text: html(changed) }))).ok, false);
assert.equal(selectCommunityCopy(item, [{ title: copy.postTitle, bodyText: copy.postBody, copyMeta: copy.copyMeta }]).copyRejected, true);
assert.equal(chooseItem([item], [], Array.from({ length: config.merchantDailyMax }, () => ({ sellerKey: item.sellerKey })), config), null);
assert.equal(chooseItem([item], [], Array.from({ length: config.merchantDailyMax }, () => ({ sellerKey: 'another-seller' })), config), item);
console.log('family shopping: real-price/coupon/shipping/expiry/identity checks and cold-start pipeline passed');

const elevenUrl = 'https://www.11st.co.kr/products/123';
const elevenHtml = ({ price=9900, optionCount=0, stock=5, member=false, download=0, free='Y', minQty='', end='20990928235959' }={}) => {
  const p = {prdNo:123,prdNm:'알로에 수분크림 1000ml 2개',selStatCd:'103',selPrc:11000,finalDscPrc:9900,isUniverseExclusive:member,isShockingDeal:true,dealEndTime:end,sellerId:'fixture'};
  const coupon = {prdNo:123,selPrc:11000,downloadCupnCnt:download,dscCupnCalcAmt:0,dupCupnCalcAmt:0,addPrc:0,unipassDscYn:'N',moDirectDiscountAmt:1100,soDirectDiscountAmt:0};
  const product = {'@type':'Product',productID:123,offers:{availability:'https://schema.org/InStock',priceCurrency:'KRW',price:9900,priceSpecification:{price:11000}}};
  return `<script>var productPrdInfo = ${JSON.stringify(p)};\nvar productCouponDownInfo = ${JSON.stringify(coupon)};
var productOptInfo = {
 optCnt: ${optionCount},
 isNotOptPrd: true,
 totStockQty: ${stock},
 buyUnitQty: "1",
};
var productOrdInfo = {
 ordObjLimit: "N",
 selMinLimitQty: "${minQty}",
 selLimitQty: "0",
 dlvCstFreeYn: "${free}",
};</script><script type="application/ld+json">${JSON.stringify(product)}</script><dl id="finalDscPrcArea"><dd class="price"><span class="value">${price}</span></dd></dl><dt>무료배송<button aria-controls="arDialogDelivery"></button></dt>`;
};
assert.equal(readShoppingOffer(elevenHtml(),elevenUrl,{},now).ok,true);
assert.equal(readShoppingOffer(elevenHtml(),elevenUrl,{},now).saving,1100);
assert.equal(readShoppingOffer(elevenHtml().replace('"priceSpecification":{"price":11000}', '"priceSpecification":{"price":12000}'),elevenUrl,{},now).ok,false);
assert.equal(readShoppingOffer(elevenHtml({minQty:'1'}),elevenUrl,{},now).ok,true);
for(const bad of [{price:8900},{optionCount:1},{stock:0},{member:true},{download:1},{free:'N'},{minQty:'2'},{end:'20200928235959'}]) assert.equal(readShoppingOffer(elevenHtml(bad),elevenUrl,{},now).ok,false);
assert.equal(readShoppingOffer(elevenHtml(),elevenUrl.replace('123','999'),{},now).ok,false);
for(const title of ['아이보리 침대프레임','고양이 밥 사료','영유아 학습프로그램']) assert.equal(familyCategory(title),null);
assert.equal(shoppingUrl('https://www.11st.co.kr/products/pa/123?trTypeCd=45'),elevenUrl);
console.log('11st checks: public immediate price, stock, single configuration, eligibility, expiry and shipping');

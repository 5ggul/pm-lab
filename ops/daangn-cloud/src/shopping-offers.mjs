import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const amount = s => Number(String(s ?? '').replace(/[^\d.]/g, ''));
const money = n => n.toLocaleString('ko-KR') + '원';
export const productName = s => clean(s).replace(/^(?:\[[^\]]*\]\s*)+/, '').replace(/\[(?:GS단독|TV상품|단독특가)\]\s*/g, '').trim();
export function familyCategory(title) {
  const t = productName(title);
  if (/(침대|매트리스|소파|책상|의자|컴퓨터|장식장|신발장|건강식품|단백질보충제|강아지|고양이|사료|펫푸드|학습프로그램|정기구독)/.test(t)) return null;
  if (/(남성|남자|맨즈|옴므|골프|낚시|주류|와인|위스키|담배|성인용|명품|게이밍|그래픽카드|메인보드|RTX|GTX|X3D|스팀|플레이스테이션|닌텐도|엑스박스|보험|대출|환급|건강기능|유산균|비타민|다이어트약)/i.test(t)) return null;
  if (/(기저귀|분유|이유식|유아|아기|베이비|출산|수유|젖병|키즈|어린이|아동|유모차|카시트)/.test(t)) return '육아·아동';
  if (/(물티슈|휴지|화장지|키친타월|세제|세정|섬유유연|치약|칫솔|가글|생리대|위생|지퍼백|건전지|종량제|롤백)/.test(t)) return '생필품';
  if (/(샴푸|트리트먼트|린스|클렌징|선크림|선스틱|토너|세럼|앰플|로션|크림|마스크팩|에센스|쿠션팩트|립스틱|바디워시|헤어|화장품)/.test(t)) return '뷰티·여성용품';
  if (/(냄비|프라이팬|후라이팬|텀블러|밀폐용기|수세미|행주|도마|식기|조리도구|그릇|접시|주방|침구|이불|베개|수건|타월|수납|청소기|에어프라이어|밥솥)/.test(t)) return '주방·살림';
  if (/(여성|여자|블라우스|원피스|스커트|브라|팬티|레깅스|가디건)/.test(t)) return '여성의류';
  if (/(양파|마늘|배추|토마토|브로콜리|버섯|잡곡|보리|서리태|병아리콩|계란|달걀|두부|고추장|된장|쌀|햇반|밥|라면|국수|막국수|김치|만두|반찬|장조림|갈비|고기|닭|치킨|돈까스|돈가스|소시지|너겟|참치|생선|고등어|삼치|쭈꾸미|오징어|새우|과일|사과|감귤|고구마|감자|채소|우유|두유|요거트|치즈|생수|삼다수|음료|사이다|펩시|커피|원두|차음료|티즐|과자|간식|초코|초콜릿|단백|카스테라|빵|케이크|케익|아이스크림|견과|식품|밀키트|국밥|삼계탕|육개장|설렁탕|미역국|곰탕|카레|짜장|식용유|참기름)/.test(t)) return '먹거리·장보기';
  return null;
}
export function shoppingUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.hash = '';
    if (/^(?:www\.|m\.)11st\.co\.kr$/.test(u.hostname) && /^\/products\/(?:pa\/)?\d+/.test(u.pathname)) return 'https://www.11st.co.kr/products/' + u.pathname.match(/\d+/)[0];
    if (/^(?:www\.|m\.)?gsshop\.com$/.test(u.hostname) && u.searchParams.has('prdid')) return 'https://www.gsshop.com/prd/prd.gs?prdid=' + u.searchParams.get('prdid');
    if (/^(?:m\.)?harimmall\.com$/.test(u.hostname)) u.hostname = 'harimmall.com';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|pWise|fbclid|gclid|lseq|gsid|media|cate_no|display_group)/i.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.href;
  } catch { return ''; }
}
function ldObjects($) {
  const out = [];
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (o['@type']) out.push(o);
    Object.values(o).forEach(walk);
  };
  $('script[type="application/ld+json"]').each((_, e) => { try { walk(JSON.parse($(e).text())); } catch {} });
  return out;
}
function identityMatches(expected, actual) {
  if (!expected) return true;
  const tokens = productName(expected).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(x => x.length > 1);
  const compact = actual.replace(/\s+/g, '').toLowerCase();
  return tokens.length >= 2 && tokens.filter(t => compact.includes(t.toLowerCase())).length / tokens.length >= 0.65;
}
const fail = reason => ({ ok: false, reason });
function gsOffer($, html, url, now) {
  let j;
  try { j = JSON.parse(html.match(/var renderJson\s*=\s*(\{[^\n]+\});/)?.[1]); } catch {
    const body = $('body').clone(); body.find('script,style').remove();
    return { ...fail('gs_product_data_missing'), pageTitle: clean($('title').text()).slice(0,120), pageText: clean(body.text()).slice(0,240), initializer: html.length < 1500 ? $('script').map((_, e) => $(e).text()).get().join('\n').replace(/[a-f0-9]{24,}/gi, '[anonymous-id]').slice(0,1200) : '', bytes: html.length };
  }
  const p = j.prd, b = j.pmo, v = b?.prc;
  const id = new URL(url).searchParams.get('prdid');
  if (!p || String(p.prdCd) !== id || !v) return fail('product_id_mismatch');
  if (p.tempoutYn !== 'N' || p.prdSaleSt !== 'Y' || p.salePsblGbn?.ordButtn !== 'Y') return fail('sold_out');
  const hasOptions = p.attrTypCnt !== 0 || p.attrTypGrgCnt !== 0;
  let options = [];
  if (hasOptions) {
    // GS's main-option UI uses pmo.prc.minPrc for every stock-listed main SKU.
    // Additional configurations and multidimensional combinations remain blocked.
    if (p.prdAttrTypCd !== 'S' || p.attrTypCnt !== 1 || p.attrTypGrgCnt !== 1 || p.addCmposPrdExistFlg !== 'N' || !Array.isArray(p.attrTypList) || p.attrTypList.length > 8) return fail('options_require_review');
    const available = p.attrTypList.filter(x => x.stockFlg === 'N');
    if (!available.length || available.some(x => !String(x.attrPrdCd).startsWith(id) || !clean(x.attrTypVal))) return fail('option_stock_missing');
    options = available.map(x => clean(x.attrTypVal));
  }
  if (/첫.?구매|신규|첫.?주문|VIP|임직원|정기배송/i.test(p.exposPrdNm) || b.isVipCouponlimitMsg || v.vipDcFlg) return fail('restricted_benefit');
  if (/임박|유통기한|소비기한|리퍼|중고|파손/.test(p.exposPrdNm)) return fail('special_product_condition_requires_review');
  const coupon = b.cpnFlg === 'Y';
  const price = coupon ? b.cpnApplyPrc : v.salePrc;
  if (!(price > 0) || (v.flgdPrc != null && price !== v.flgdPrc) || price !== b.gsPrc || amount($('.price-definition-ins strong').first().text()) !== price) return fail('display_price_mismatch');
  if (hasOptions && v.minPrc !== price) return fail('option_price_ambiguous');
  const conditions = [];
  if (options.length) conditions.push(`옵션: ${options.join(' / ')} 중 선택.`);
  let expiresAt = null;
  if (coupon) {
    if (String(b.cpnTypCd) !== '1' || b.dbcpnNo || !(v.cpnDcAmt > 0) || v.salePrc - v.cpnDcAmt !== price || v.totDcAmt !== v.cpnDcAmt) return fail('coupon_terms_ambiguous');
    if (!/^\d+(?:\.\d+)?%$/.test(b.cpnLabel || '') || Number(b.cpnLabel.slice(0, -1)) !== b.cpnRtAmt || /신규|첫.?구매|VIP|임직원/i.test(b.cpnPriceLabel || '')) return fail('coupon_terms_ambiguous');
    const end = b.couponUseStr?.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{1,2})시/);
    if (!end) return fail('coupon_expiry_missing');
    expiresAt = `${end[1]}-${end[2]}-${end[3]}T${end[4].padStart(2, '0')}:00:00+09:00`;
    if (Date.parse(expiresAt) <= now.getTime()) return fail('coupon_expired');
    conditions.push(`GS샵 상품쿠폰 ${b.cpnLabel} 적용가 ${money(price)}`, `쿠폰 기한 ${Number(end[2])}/${Number(end[3])} ${Number(end[4])}시`);
  }
  const shipping = p.dlvRfnArea?.dlvInfoGrp;
  if (!shipping || shipping.dlvTxt !== '무료배송' || p.freeDlvFlg !== 'Y') return fail('shipping_unconfirmed');
  if (clean(shipping.addDlvcInfo)) conditions.push(`추가 배송비: ${clean(shipping.addDlvcInfo)}.`);
  const title = productName(p.exposPrdNm);
  const sale = Number(v.salePrc);
  const seller = p.prdDtlArea?.supCd;
  return { ok: true, product: title, price, referencePrice:coupon ? sale : undefined, referenceLabel:'판매처 쿠폰 적용 전 가격', saving:coupon ? sale-price : undefined, shipping: '무료배송', shippingCost: 0, conditions, expiresAt,
    coupon, benefitSaving: coupon ? v.cpnDcAmt : 0, benefitPercent: coupon ? Math.round(v.cpnDcAmt / sale * 100) : 0,
    merchant: 'GS샵', sellerKey: seller ? 'gsshop:' + seller : 'gsshop', productIdentity: 'gs:' + id,
    imageUrl: $('meta[property="og:image"]').attr('content'), method: 'gs_product_coupon', offerId: id };
}
function cafe24Offer($, html, url, objects, now) {
  const groups = objects.filter(x => x['@type'] === 'ProductGroup');
  if (groups.length !== 1 || !String(groups[0].productGroupID).startsWith('cafe24_')) return fail('cafe24_group_missing');
  const g = groups[0], variants = g.hasVariant;
  const pid = $('meta[property="product:productId"]').attr('content');
  const requested = new URL(url).searchParams.get('product_no');
  if (!pid || (requested && requested !== pid) || !g.productGroupID.endsWith('_' + pid)) return fail('product_id_mismatch');
  if (!Array.isArray(variants) || !variants.length || variants.length > 8) return fail('options_require_review');
  let stock;
  try { stock = Object.values(JSON.parse(JSON.parse('"' + html.match(/var option_stock_data\s*=\s*'([^']*)'/)[1] + '"'))); } catch { return fail('option_stock_missing'); }
  if (stock.length !== variants.length || stock.some(x => x.is_selling !== 'T' || x.is_display !== 'T' || x.use_soldout !== 'F' || Number(x.stock_price) !== 0 || Number(x.origin_option_added_price) !== 0)) return fail('options_price_or_stock_ambiguous');
  if (variants.some(x => x.offers?.availability !== 'https://schema.org/InStock') || new Set(variants.map(x => x.offers.price)).size !== 1) return fail('options_price_or_stock_ambiguous');
  const price = amount($('meta[property="product:sale_price:amount"]').attr('content'));
  const displayed = amount($('#span_product_price_sale').text());
  const scriptPrice = Number(html.match(/var product_sale_price\s*=\s*(\d+)/)?.[1]);
  if (!(price > 0) || price !== displayed || price !== scriptPrice || $('meta[property="product:sale_price:currency"]').attr('content') !== 'KRW') return fail('display_price_mismatch');
  if (!$('[benefit="DP"]').length || /첫.?구매|신규|회원전용|정기배송/.test(g.name)) return fail('restricted_benefit');
  const expiry = variants[0].offers.priceValidUntil;
  const expiresAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(expiry || '') ? expiry.replace(' ', 'T') + ':00+09:00' : null;
  if (expiresAt && Date.parse(expiresAt) <= now.getTime()) return fail('offer_expired');
  const shippingText = clean($('tr[rel="배송비"] td').text()).replace(/배송비 할인/g, '').trim();
  let shippingCost = null, shipping;
  if (shippingText === '무료') { shippingCost = 0; shipping = '무료배송'; }
  else if (shippingText === '조건부 무료') shipping = '배송비 조건부 무료 — 무료배송 기준은 주문서에서 확인';
  else return fail('shipping_unconfirmed');
  const options = stock.map(x => clean(x.option_value));
  const conditions = [`옵션: ${options.join(' / ')} 중 선택.`, '판매처 기간할인 적용 상품가입니다.'];
  if (shippingCost === null) conditions.push('표시 가격에 배송비는 포함되지 않았습니다.');
  if (/산간벽지나 도서지방은 별도의 추가금액/.test($('body').text())) conditions.push('도서·산간 배송비 별도.');
  return { ok: true, product: productName(g.name), price, shipping, shippingCost, conditions, expiresAt, coupon: false,
    benefitSaving: 0, benefitPercent: 0, merchant: variants[0].brand?.name || new URL(url).hostname,
    sellerKey: new URL(url).hostname.replace(/^m\./, ''), productIdentity: g.productGroupID, imageUrl: variants[0].image?.[0],
    method: 'cafe24_period_sale', offerId: pid, options };
}
function elevenOffer($, html, url, now, trackingOnly = false) {
  const data = name => { try { return JSON.parse(html.match(new RegExp('var ' + name + '\\s*=\\s*(\\{[^\\n]+\\});'))?.[1]); } catch { return null; } };
  const block = name => html.match(new RegExp('var ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\};'))?.[1] || '';
  const scalar = (text, key) => text.match(new RegExp('(?:^|\\n)\\s*' + key + ':\\s*("[^"\\n]*"|true|false|[0-9]+)\\s*[,\\n]'))?.[1];
  const p = data('productPrdInfo'), c = data('productCouponDownInfo');
  const id = new URL(url).pathname.match(/^\/products\/(\d+)$/)?.[1];
  if (!p || !c || String(p.prdNo) !== id || String(c.prdNo) !== id) return fail('eleven_product_data_missing');
  const schema = ldObjects($).find(x => x['@type'] === 'Product' && String(x.productID) === id);
  const opt = block('productOptInfo'), ord = block('productOrdInfo');
  if (!schema || !/\/InStock$/.test(schema.offers?.availability || '') || p.selStatCd !== '103') return fail('sold_out');
  if (scalar(opt, 'optCnt') !== '0' || scalar(opt, 'isNotOptPrd') !== 'true' || !(Number(scalar(opt, 'totStockQty')) > 0) || scalar(opt, 'buyUnitQty') !== '"1"') return fail('options_require_review');
  const limitRaw = scalar(ord, 'selLimitQty');
  const limit = /^"\d+"$/.test(limitRaw || '') ? Number(JSON.parse(limitRaw)) : limitRaw === '""' ? 0 : NaN;
  if (p.isUniverseExclusive || p.isDirectPurchaseType || p.isRental || p.isRsvSel || p.hasMembershipPrice || p.hasMemberPrice || scalar(ord, 'ordObjLimit') !== '"N"' || !['""','"0"','"1"'].includes(scalar(ord, 'selMinLimitQty')) || !Number.isFinite(limit) || limit < 0) return fail('restricted_benefit');
  if (/임박|유통기한|소비기한|리퍼|중고|첫.?구매|신규회원|회원전용/.test(p.prdNm)) return fail('special_product_condition_requires_review');
  // Only automatic public discounts, never a downloaded/member/card coupon price.
  if (c.downloadCupnCnt !== 0 || c.dscCupnCalcAmt !== 0 || c.dupCupnCalcAmt !== 0 || c.addPrc !== 0 || c.unipassDscYn !== 'N') return fail('coupon_terms_ambiguous');
  const price = p.finalDscPrc;
  if (!(price > 0) || schema.offers.priceCurrency !== 'KRW' || schema.offers.price !== price || amount($('#finalDscPrcArea dd.price .value').text()) !== price || c.selPrc !== p.selPrc || p.selPrc - c.moDirectDiscountAmt - c.soDirectDiscountAmt !== price) return fail('display_price_mismatch');
  if (!trackingOnly && (!(p.selPrc > price) || schema.offers.priceSpecification?.price !== p.selPrc)) return fail('comparison_price_unconfirmed');
  if (!p.sellerId || (!trackingOnly && (!p.isShockingDeal || !p.dealEndTime))) return fail('no_verified_shopping_benefit');
  const rawEnd = p.dealEndTime;
  const end = /^\d{14}$/.test(rawEnd) ? Date.parse(rawEnd.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6+09:00')) : Date.parse(rawEnd + ' GMT+0900');
  if ((!trackingOnly || p.isShockingDeal) && (!Number.isFinite(end) || end <= now.getTime())) return fail('offer_expired');
  if (scalar(ord, 'dlvCstFreeYn') !== '"Y"' || !/무료배송/.test($('[aria-controls="arDialogDelivery"]').parent().text())) return fail('shipping_unconfirmed');
  const conditions = [c.moDirectDiscountAmt + c.soDirectDiscountAmt > 0 ? '즉시할인가 · 카드할인·적립금 제외' : '상품가 · 카드할인·적립금 제외'];
  if (limit > 0) conditions.push(`구매 한도 ${limit}개`);
  const activeEnd = Number.isFinite(end) && end > now.getTime();
  const parts = activeEnd && Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hourCycle:'h23' }).formatToParts(new Date(end)).map(x=>[x.type,x.value]));
  if (activeEnd) conditions.push(`행사 종료 ${Number(parts.month)}/${Number(parts.day)} ${parts.hour}:${parts.minute}`);
  return { ok:true, product:productName(p.prdNm), price, referencePrice:p.selPrc, referenceLabel:'판매처 할인 전 표시가', saving:p.selPrc-price, shipping:'기본배송 무료 (제주·도서산간 조건 별도)', shippingCost:null, baseShippingCost:0, conditions, expiresAt:activeEnd ? new Date(end).toISOString() : null, coupon:false, benefitSaving:0, benefitPercent:Math.floor((c.moDirectDiscountAmt+c.soDirectDiscountAmt)/p.selPrc*100), merchant:'11번가', sellerKey:'11st:'+p.sellerId, productIdentity:'11st:'+id, imageUrl:schema.image, method:'eleven_public_immediate_discount', offerId:id, options:[] };
}
export function verifiedGtin(value) {
  const s = String(value || '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) || /^0+$/.test(s)) return '';
  const digits = [...s].map(Number), check = digits.pop();
  const total = digits.reverse().reduce((sum, x, i) => sum + x * (i % 2 ? 1 : 3), 0);
  return (10 - total % 10) % 10 === check ? s.padStart(14, '0') : '';
}
export function readShoppingOffer(html, url, expected = {}, now = new Date(), { trackingOnly = false } = {}) {
  const $ = cheerio.load(html), host = new URL(url).hostname;
  let offer;
  if (/^(?:www\.|m\.)?gsshop\.com$/.test(host)) offer = gsOffer($, html, url, now);
  else if (host === 'harimmall.com' || host === 'm.harimmall.com') offer = cafe24Offer($, html, url, ldObjects($), now);
  else if (host === 'www.11st.co.kr') offer = elevenOffer($, html, url, now, trackingOnly);
  else return fail('merchant_adapter_unavailable');
  if (!offer.ok) return offer;
  if (!identityMatches(expected.product, offer.product + ' ' + (offer.options || []).join(' '))) return fail('product_identity_mismatch');
  if (expected.price !== undefined && offer.price !== expected.price) return fail('merchant_price_mismatch');
  const category = familyCategory(offer.product);
  if (!category) return fail('outside_family_shopping');
  offer.category = category;
  const schema = ldObjects($).find(x => x['@type'] === 'Product' && offer.offerId && String(x.productID) === String(offer.offerId));
  offer.comparisonIdentity = schema ? verifiedGtin(schema.gtin14 || schema.gtin13 || schema.gtin12 || schema.gtin8 || schema.gtin) : '';
  // Changes to any purchase condition invalidate the pre-publication check.
  offer.fingerprint = createHash('sha256').update(JSON.stringify([offer.productIdentity,offer.product,offer.options,offer.sellerKey,offer.price,offer.referencePrice,offer.saving,offer.imageUrl,offer.shipping,offer.conditions,offer.expiresAt,offer.baseShippingCost,offer.comparisonIdentity])).digest('hex');
  return offer;
}

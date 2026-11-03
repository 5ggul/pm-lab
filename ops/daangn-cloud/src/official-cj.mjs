import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { familyCategory, productName } from './shopping-offers.mjs';

export const CJ_MARKET_HOME = 'https://www.cjthemarket.com/the/pc/main';
export const CJ_MARKET_METHOD = 'official_cj_product_detail_v1';

const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const excluded = /골라담기|옵션\s*선택|랜덤|사은품|증정|첫.?구매\s*전용|첫.?구매\s*특가상품|신규회원\s*전용|회원전용|정기배송|유통기한\s*임박|소비기한\s*임박|리퍼|중고|파손|예약판매|시식권/i;

function nuxtRecords(html) {
  const $ = cheerio.load(String(html || ''));
  let records;
  try {
    records = JSON.parse($('#__NUXT_DATA__').first().text());
  } catch { return { $, records: [], data: [] }; }
  if (!Array.isArray(records) || records.length < 10) return { $, records: [], data: [] };
  const decode = ref => {
    const value = records[ref];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return Object.fromEntries(Object.entries(value).map(([key, index]) =>
      [key, typeof index === 'number' && index >= 0 && index < records.length ? records[index] : null]));
  };
  const data = [];
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        !Number.isInteger(record.base) || !Number.isInteger(record.priceInfo) ||
        !Number.isInteger(record.deliveryInfo) || !Number.isInteger(record.stockInfo)) continue;
    const base = decode(record.base), price = decode(record.priceInfo);
    const delivery = decode(record.deliveryInfo), stock = decode(record.stockInfo);
    const timeSale = decode(record.timeSale);
    if (base && price && delivery && stock && timeSale) data.push({ base, price, delivery, stock, timeSale });
  }
  return { $, records, data };
}

function offerFromRecord({ base, price, delivery, stock, timeSale }) {
  const id = String(base.prdCd || '');
  const title = productName(base.prdNm);
  const category = familyCategory(title);
  if (!/^\d{7,12}$/.test(id) || !title || title.length > 85 ||
      !category || excluded.test(base.prdNm) ||
      base.prdTyCd !== '01' || base.prdStatCd !== 'P' ||
      base.isSoldOutStatus !== false ||
      (base.stockYn !== undefined && base.stockYn !== 'Y') ||
      base.reservationSaleUseYn !== 'N' || base.slpkPrdYn !== 'N' ||
      base.nplusnYn !== false || base.minBuyQty !== 1 ||
      !Number.isInteger(base.onceMaxBuyQty) || base.onceMaxBuyQty < 1 ||
      delivery.freeShip !== true || delivery.orginFreeShip !== true ||
      delivery.thirdPartyShip !== false || delivery.storeShip !== false ||
      timeSale.flagYn !== 'N') return null;

  const stockAmount = Number(stock.amount);
  const referencePrice = price.origin, salePrice = price.discount;
  const percent = (referencePrice - salePrice) / referencePrice * 100;
  if (!Number.isSafeInteger(stockAmount) || stockAmount <= 0 ||
      !Number.isSafeInteger(referencePrice) || !Number.isSafeInteger(salePrice) ||
      salePrice < 100 || referencePrice <= salePrice ||
      percent < 10 || percent > 85 ||
      !Number.isInteger(price.percent) || Math.abs(price.percent - Math.round(percent)) > 1 ||
      price.primeDiscount !== 0 || price.staffDiscountPrice !== 0) return null;

  const max = base.onceMaxBuyQty;
  const conditions = [
    'CJ더마켓 공식몰에 표시된 일반 할인 판매가입니다.',
    '첫구매 전용가·회원 쿠폰·CJ ONE 적립 혜택은 차감하지 않았습니다.'
  ];
  if (Number.isInteger(max) && max >= 1 && max <= 30) conditions.push('1회 구매 한도 ' + max + '개');
  const productUrl = 'https://www.cjthemarket.com/the/product/product-main?prdCd=' + id;
  const shipping = '판매처 표시 무료배송(배송지별 추가비는 주문서 확인)';
  const fingerprint = createHash('sha256').update(JSON.stringify([
    id, clean(base.prdNm), salePrice, referencePrice, shipping, conditions
  ])).digest('hex');
  return {
    ok: true, url: productUrl, offerId: id, product: title,
    rawProduct: clean(base.prdNm), category, price: salePrice, referencePrice,
    referenceLabel: '판매처 할인 전 표시가',
    saving: referencePrice - salePrice, shipping, shippingCost: null, baseShippingCost: null,
    conditions, expiresAt: null, coupon: false,
    benefitSaving: referencePrice - salePrice, benefitPercent: Math.floor(percent),
    merchant: 'CJ더마켓', sellerKey: 'cjthemarket:direct',
    productIdentity: 'cj:' + id, comparisonIdentity: '',
    imageUrl: '', options: [], method: CJ_MARKET_METHOD,
    fingerprint
  };
}

export function parseCjOfficialListings(html) {
  const { data } = nuxtRecords(html);
  const offers = new Map();
  for (const record of data) {
    const offer = offerFromRecord(record);
    if (offer && !offers.has(offer.offerId)) offers.set(offer.offerId, offer);
  }
  return [...offers.values()];
}

export function readCjOfficialDetail(html, url) {
  let canonical;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.cjthemarket.com' ||
        parsed.pathname !== '/the/product/product-main' ||
        [...parsed.searchParams.keys()].some(key => key !== 'prdCd')) return null;
    const id = parsed.searchParams.get('prdCd');
    if (!/^\d{7,12}$/.test(id || '')) return null;
    canonical = 'https://www.cjthemarket.com/the/product/product-main?prdCd=' + id;
  } catch { return null; }

  const { $, data } = nuxtRecords(html);
  const matching = data.filter(record => String(record.base.prdCd) === new URL(canonical).searchParams.get('prdCd'));
  if (matching.length !== 1) return null;
  const offer = offerFromRecord(matching[0]);
  if (!offer || offer.url !== canonical) return null;
  const pageTitle = clean($('title').first().text());
  if (!pageTitle.includes(offer.rawProduct)) return null;
  const body = $('body').clone();
  body.find('script,style,noscript').remove();
  const visible = clean(body.text());
  const anchor = visible.indexOf(offer.rawProduct);
  if (anchor < 0) return null;
  const offerArea = visible.slice(anchor, anchor + 320);
  const won = amount => Number(amount).toLocaleString('ko-KR') + '원';
  if (!offerArea.includes(won(offer.price)) ||
      !offerArea.includes(won(offer.referencePrice)) ||
      !visible.slice(anchor, anchor + 750).includes('무료배송')) return null;
  return offer;
}

export function verifyCjOfficialDetail(item, html, url) {
  if (item?.verification?.method !== CJ_MARKET_METHOD ||
      item.originUrl !== CJ_MARKET_HOME ||
      item.verification?.evidenceUrl !== item.buyUrl ||
      url !== item.buyUrl) return { ok: false, reason: 'cj_evidence_source_invalid' };
  const fresh = readCjOfficialDetail(html, url);
  return {
    ok: Boolean(fresh && fresh.fingerprint === item.verification.fingerprint &&
      fresh.price === item.copyContext?.price),
    reason: fresh ? 'cj_price_or_conditions_changed' : 'cj_detail_missing_or_unverified'
  };
}

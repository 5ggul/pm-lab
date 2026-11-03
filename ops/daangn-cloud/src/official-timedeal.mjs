import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { familyCategory, productName } from './shopping-offers.mjs';

// This is an official merchant listing, not a third-party deal aggregator.
// The listing itself is the evidence: no guessed discount, shipping or expiry.
export const ELEVEN_TIMEDEAL_URL = 'https://m.11st.co.kr/display-view/deal/timeDeal';
export const ELEVEN_TIMEDEAL_METHOD = 'official_eleven_timedeal_listing_v1';

const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const amount = value => /^\d[\d,]*원$/.test(clean(value))
  ? Number(clean(value).slice(0, -1).replaceAll(',', '')) : null;
const ambiguous = /골라담기|택\s*1|옵션|선택|모음전|모음|랜덤|사은품|증정|첫.?구매|신규회원|회원전용|정기배송|유통기한|소비기한|임박|리퍼|중고|파손|예약판매|특정카드|최대\s*\d+%|외\s*$/i;

function endLabel(end) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(end).map(part => [part.type, part.value]));
  return '할인 기한: ' + Number(parts.month) + '/' + Number(parts.day) + ' ' + parts.hour + ':' + parts.minute;
}

function readCard($, element, now) {
  const card = $(element);
  let href;
  try { href = new URL(card.attr('href')); } catch { return null; }
  if (href.hostname !== 'm.11st.co.kr' ||
      href.pathname !== '/MW/Product/productBasicInfo.tmall') return null;
  const id = href.searchParams.get('prdNo');
  if (!/^\d{5,12}$/.test(id || '')) return null;

  let logged;
  try { logged = JSON.parse(card.attr('data-log-body')); } catch { return null; }
  if (String(logged.product_no) !== id || logged.deal_status !== 'on_sale') return null;
  if (clean(card.find('.c-card-badge__status--active').first().text()) !== '판매중' ||
      clean(card.find('.c-card__special').first().text()) !== '타임딜가') return null;

  const rawTitle = clean(card.find('.c-card__name').first().text());
  const title = productName(rawTitle);
  const imageAlt = clean(card.find('img[alt]').first().attr('alt'));
  const category = familyCategory(title);
  if (!category || !title || title.length > 85 || ambiguous.test(rawTitle) ||
      (imageAlt && imageAlt !== rawTitle)) return null;

  const priceBlock = card.find('.c-card__price').first();
  if (priceBlock.length !== 1 || priceBlock.find('strong').length !== 1 ||
      priceBlock.find('del').length !== 1) return null;
  const price = amount(clean(priceBlock.find('strong').text()) + '원');
  const referencePrice = amount(priceBlock.find('del').text());
  // Reject "from" prices and other option-dependent displays.
  const display = priceBlock.clone();
  display.find('del').remove();
  if (/~|부터|최저|쿠폰/.test(clean(display.text()))) return null;
  if (!Number.isSafeInteger(price) || !Number.isSafeInteger(referencePrice) ||
      price < 100 || referencePrice <= price || (referencePrice - price) / referencePrice < 0.10 ||
      Number(logged.product_price) !== referencePrice ||
      Number(logged.last_discount_price) !== price) return null;

  const shipping = card.find('.c-card__benefit .benefit').map((_, node) => clean($(node).text())).get();
  if (!shipping.includes('무료배송')) return null;
  const stock = clean(card.find('.c-card__qty').first().text()).match(/^([\d,]+)개 남음$/);
  if (!stock || Number(stock[1].replaceAll(',', '')) <= 0) return null;
  const expiry = card.find('.c-card-badge__time[data-enddt]').first().attr('data-enddt');
  if (!/^\d{13}$/.test(expiry || '')) return null;
  const expiresAt = new Date(Number(expiry));
  if (!Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= +now + 20 * 60e3 ||
      expiresAt.getTime() > +now + 48 * 36e5) return null;

  const productUrl = 'https://www.11st.co.kr/products/' + id;
  const conditions = [
    '11번가 쇼킹 타임딜 목록에 표시된 상품가입니다.',
    '11pay 적립 혜택은 표시 상품가에서 차감하지 않았습니다.',
    endLabel(expiresAt)
  ];
  const fingerprint = createHash('sha256').update(JSON.stringify([
    id, title, price, referencePrice, '무료배송', conditions, expiresAt.toISOString()
  ])).digest('hex');

  return {
    ok: true, url: productUrl, offerId: id, product: title, category, price,
    referencePrice, referenceLabel: '판매처 타임딜 목록의 비교 표시가',
    saving: referencePrice - price,
    shipping: '판매처 타임딜 목록에 무료배송으로 표시됨 (지역별 추가비는 주문서 확인)',
    shippingCost: null, baseShippingCost: null,
    conditions, expiresAt: expiresAt.toISOString(), coupon: false,
    benefitSaving: referencePrice - price,
    benefitPercent: Math.floor((referencePrice - price) / referencePrice * 100),
    merchant: '11번가', sellerKey: '11st:timedeal',
    productIdentity: '11st:' + id, comparisonIdentity: '',
    imageUrl: '', options: [], method: ELEVEN_TIMEDEAL_METHOD,
    fingerprint
  };
}

export function parseOfficialTimeDeals(html, now = new Date()) {
  const $ = cheerio.load(String(html || ''));
  const offers = new Map();
  $('a.c-card.c-card__deal').each((_, element) => {
    const offer = readCard($, element, now);
    if (offer && !offers.has(offer.offerId)) offers.set(offer.offerId, offer);
  });
  return [...offers.values()];
}

export function verifyOfficialTimeDeal(item, html, now = new Date()) {
  if (item?.verification?.method !== ELEVEN_TIMEDEAL_METHOD ||
      item.originUrl !== ELEVEN_TIMEDEAL_URL ||
      item.verification?.evidenceUrl !== ELEVEN_TIMEDEAL_URL) {
    return { ok: false, reason: 'timedeal_evidence_source_invalid' };
  }
  const match = parseOfficialTimeDeals(html, now).find(offer =>
    offer.url === item.buyUrl &&
    offer.fingerprint === item.verification.fingerprint &&
    offer.price === item.copyContext?.price
  );
  return { ok: Boolean(match), reason: match ? undefined : 'timedeal_terms_or_stock_changed' };
}

import { createHash } from 'node:crypto';
import { verifiedDealQuantity } from './deal-price-facts.mjs';

const DAY = 864e5;
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const money = x => x.toLocaleString('ko-KR') + '원';
const day = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
const dayAgo = (now, n) => day(new Date(+now - n * DAY));
export const TRACKED_CATEGORIES = ['생필품', '육아·아동'];
const supported = url => { try { return ['www.11st.co.kr', 'www.gsshop.com', 'harimmall.com'].includes(new URL(url).hostname); } catch { return false; } };

export function deliveryQuote(offer) {
  const cost = Number.isFinite(offer.baseShippingCost) ? offer.baseShippingCost : offer.shippingCost;
  if (!Number.isFinite(cost) || cost < 0 || !Number.isSafeInteger(offer.price + cost)) return null;
  return { total: offer.price + cost, cost, scope: '기본배송 지역 (제주·도서산간 제외)' };
}

export function observePrice(history, offer, sourceUrl, now = new Date()) {
  if (!offer.ok || !TRACKED_CATEGORIES.includes(offer.category) || !supported(sourceUrl) ||
      !offer.productIdentity || !offer.sellerKey || !Number.isSafeInteger(offer.price) || offer.price <= 0 || offer.options?.length) return null;
  const quantity = verifiedDealQuantity({ product: offer.product });
  const delivery = deliveryQuote(offer);
  const basis = delivery ? '배송 포함 · 기본배송 지역' : '상품가 · 배송비 별도';
  const key = hash([sourceUrl, offer.productIdentity, offer.sellerKey, offer.product.normalize('NFKC'),
    quantity && [quantity.count, quantity.unit], offer.coupon ? 'public-product-coupon' : 'public-immediate', delivery?.scope || 'unknown-delivery']);
  const store = history.trackedOffersV1 ||= {};
  const entry = store[key] ||= { version: 1, key, sourceUrl, product: offer.product, category: offer.category, basis, days: [] };
  const price = delivery?.total ?? offer.price;
  const date = day(now), at = now.toISOString();
  entry.days = entry.days.filter(x => x.day >= dayAgo(now, 35) && x.day <= date);
  let current = entry.days.find(x => x.day === date);
  if (!current) { current = { day: date, firstAt: at, lastAt: at, min: price, max: price, last: price, count: 0 }; entry.days.push(current); }
  if (current.lastAt !== at || current.count === 0) {
    current.min = Math.min(current.min, price); current.max = Math.max(current.max, price);
    current.last = price; current.lastAt = at; current.count++;
  }
  entry.lastAt = at;
  // Bound history growth; legacy observations are never treated as verified data.
  for (const [id, old] of Object.entries(store)) if (Date.parse(old.lastAt) < +now - 35 * DAY) delete store[id];
  const ordered = Object.values(store).sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  for (const old of ordered.slice(400)) delete store[old.key];
  return { key, basis, price, date, observedAt: at, days: structuredClone(entry.days), sourceUrl };
}

export function trackingCopy(snapshot) {
  if (!snapshot?.key || !Array.isArray(snapshot.days)) return null;
  const { date, price, basis } = snapshot;
  const today = new Date(date + 'T12:00:00+09:00');
  const prior = snapshot.days.filter(x => x.day < date);
  const window = n => prior.filter(x => x.day >= dayAgo(today, n));
  const seven = window(7), thirty = window(30);
  const enough7 = new Set(seven.map(x => x.day)).size === 7;
  const enough30 = new Set(thirty.map(x => x.day)).size === 30;
  const prices = seven.map(x => x.last).sort((a, b) => a - b);
  const median7 = enough7 ? prices[3] : null;
  const min30 = enough30 ? Math.min(...thirty.map(x => x.min)) : null;
  const previousWeek = prior.find(x => x.day === dayAgo(today, 7));
  const weekDrop = previousWeek ? previousWeek.last - price : null;
  const observedDays = new Set(snapshot.days.map(x => x.day)).size;
  let line, hook = '';
  if (enough30 && price <= min30) {
    hook = '최근 30일 관측 최저가';
    line = `가격 판단: 최근 30일 관측 최저가 · ${basis}`;
  } else if (enough7) {
    const difference = median7 - price;
    line = `7일 관측가 중앙값 ${money(median7)} · 현재 ${money(price)} (${difference > 0 ? money(difference) + ' 낮음' : difference < 0 ? money(-difference) + ' 높음' : '동일'}) · ${basis}`;
    if (weekDrop > 0) hook = `일주일 전 관측가보다 ${money(weekDrop)}↓`;
  } else line = `가격 기록 ${observedDays}일 · 구매 판단 보류`;
  return { line, hook, observedDays, median7, min30, weekDrop, price, enough7, enough30, basis };
}

export function trackingWatchlist(history, published, now = new Date()) {
  const urls = [
    ...Object.values(history.trackedOffersV1 || {}).filter(x => TRACKED_CATEGORIES.includes(x.category)).map(x => x.sourceUrl),
    ...published.filter(x => TRACKED_CATEGORIES.includes(x.topic) && x.status === 'published').map(x => x.sourceUrl)
  ].filter(supported);
  const unique = [...new Set(urls)].slice(-240);
  const offset = unique.length ? Math.floor(+now / 36e5) * 12 % unique.length : 0;
  return [...unique.slice(offset), ...unique.slice(0, offset)].slice(0, 12).map(url => ({ url, direct: true, trackingOnly: true, origin: url }));
}

export function trackingReport(history) {
  const entries = Object.values(history.trackedOffersV1 || {});
  const summaries = entries.map(x => trackingCopy({ ...x, date: day(new Date(x.lastAt)), price: x.days.find(d => d.day === day(new Date(x.lastAt)))?.last }));
  return { products: entries.length, dailyObservations: entries.reduce((n, x) => n + x.days.length, 0),
    sevenDayProducts: summaries.filter(x => x?.enough7).length, thirtyDayProducts: summaries.filter(x => x?.enough30).length };
}

// Re-alert only a documented, material drop after seven days. Never use the
// old title/body to guess a prior price or clear an uncertain submission.
export function preparePriceUpdates(items, published, ledger, now = new Date()) {
  return items.map(item => {
    const snapshot = item.copyContext?.tracking;
    if (!snapshot || snapshot.price !== (item.copyContext.delivery?.total ?? item.copyContext.price)) return item;
    const priceRecord = { key: snapshot.key, price: snapshot.price, observedAt: snapshot.observedAt, basis: snapshot.basis };
    const prior = published.filter(p => p.status === 'published' && p.sourceUrl === item.sourceUrl);
    const same = prior.filter(p => p.priceRecord?.key === snapshot.key);
    const last = prior.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
    const unknown = Object.values(ledger).some(e => e.sourceUrl === item.sourceUrl && ['publishing', 'publish_unknown'].includes(e.status));
    const minimum = same.length ? Math.min(...same.map(p => p.priceRecord.price)) : null;
    const saving = minimum - snapshot.price;
    const eligible = !unknown && last && same.length && +now - Date.parse(last.publishedAt) >= 7 * DAY &&
      trackingCopy(snapshot)?.enough7 && saving >= 500 && saving / minimum >= 0.05;
    if (!eligible) return { ...item, priceRecord };
    const update = { previousPrice: minimum, saving, line: `이전 게시가 ${money(minimum)} → ${money(snapshot.price)} · ${money(saving)} 하락 · ${snapshot.basis}`, hook: `지난 게시가보다 ${money(saving)}↓` };
    return { ...item, priceRecord, priceUpdate: true, contentVersion: 'price-' + hash([snapshot.key, snapshot.price]).slice(0, 20), copyContext: { ...item.copyContext, priceUpdate: update } };
  });
}

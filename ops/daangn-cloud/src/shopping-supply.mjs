import * as cheerio from 'cheerio';
import { familyCategory, productName, shoppingUrl, readShoppingOffer } from './shopping-offers.mjs';

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const DILLUK = 'https://dilluk.app';
const FEEDS = ['', '/c/30343', '/c/22343', '/c/50997', '/c/29967', '/c/50995'];
const ELEVEN_DEALS = 'https://deal.11st.co.kr/browsing/DealAction.tmall?method=getShockingDealMain';
function candidates(html, base) {
  const $ = cheerio.load(html);
  return $('.card').map((_, e) => {
    const card = $(e), raw = card.find('a.buy').attr('href');
    const title = clean(card.find('.title').text());
    const priceText = clean(card.find('[data-card-price]').text());
    if (!raw || !title || !/^\d[\d,]*원$/.test(priceText) || !familyCategory(title)) return null;
    return { url: shoppingUrl(new URL(raw, base).href), product: productName(title), price: Number(priceText.replace(/\D/g, '')), origin: card.find('a.origin').attr('href'), direct: false };
  }).get().filter(x => x?.url);
}
function gsCandidates(html, base, promotion = false) {
  const $ = cheerio.load(html), out = [];
  $('a[href*="/prd/prd.gs"]').each((_, e) => {
    const raw = $(e).attr('href');
    const url = shoppingUrl(new URL(raw, base).href);
    if (url && new URL(url).hostname === 'www.gsshop.com') out.push({ url, direct: true, promotion, origin: base });
  });
  return out;
}
function elevenCandidates(html, base) {
  const $ = cheerio.load(html), out = [];
  $('a[href*="www.11st.co.kr/products/"]').each((_, e) => {
    const title = clean($(e).find('.name').text());
    if (familyCategory(title)) out.push({ url: shoppingUrl($(e).attr('href')), category:familyCategory(title), direct:true, promotion:true, origin:base });
  });
  try {
    const data = JSON.parse(html.match(/templateData\s*=\s*(\{[^\n]+\});/)?.[1]);
    for (const p of data.dealBest?.items || []) {
      if (p.isDealPrd === 'Y' && familyCategory(p.prdNm) && /^https:\/\/www\.11st\.co\.kr\/products\/\d+/.test(p.url1 || '')) out.push({ url:shoppingUrl(p.url1), category:familyCategory(p.prdNm), direct:true, promotion:true, origin:base });
    }
  } catch { /* Some official pages use rendered product anchors instead. */ }
  return out;
}
function itemFromOffer(offer, candidate, now) {
  const url = shoppingUrl(candidate.url);
  const observedAt = now.toISOString();
  const facts = [
    { key: 'current_price', value: offer.price, sourceUrl: url, verified: true, observedAt },
    { key: 'shipping', value: offer.shipping, sourceUrl: url, verified: true, observedAt },
    ...offer.conditions.map((value, i) => ({ key: 'condition_' + i, value, sourceUrl: url, verified: true, observedAt }))
  ];
  return {
    id: 'hot:' + url, sourceUrl: url, buyUrl: url, originUrl: candidate.origin || url,
    type: 'hotdeal', board: '🎁 핫딜 정보', title: offer.product, price: offer.price,
    shipping: offer.shipping, imageUrl: offer.imageUrl, expiresAt: offer.expiresAt,
    trustScore: 96, sellerKey: offer.sellerKey, category: offer.category,
    verification: { status: 'verified', observedAt, method: 'shopping_offer_v1', adapter: offer.method, fingerprint: offer.fingerprint },
    copyContext: {
      kind: 'hotdeal', intent: offer.coupon ? 'SHOPPING_COUPON' : 'CURRENT_OFFER', currentOffer: true,
      product: offer.product, price: offer.price, shipping: offer.shipping, merchant: offer.merchant,
      buyUrl: url, category: offer.category, sellerKey: offer.sellerKey,
      coupon: offer.coupon, benefitPercent: offer.benefitPercent, benefitSaving: offer.benefitSaving,
      conditions: offer.conditions, requiredConditions: offer.conditions, claims: facts,
      deliveredPrice: offer.shippingCost === null ? null : offer.price + offer.shippingCost,
      readerNeed: `${offer.category} 구매 비용과 적용 조건`, editorialAngle: '실제 판매처의 상품가·쿠폰·구성·배송 조건',
      shareRecipient: '같은 생활용품과 장보기 상품을 사는 사람', returnReason: '장보기·육아·생활용품 할인 소식',
      seriesId: 'family-shopping', priceLabel: offer.coupon ? '쿠폰 적용가' : '상품가'
    }
  };
}
export async function collectShopping(state, fetcher, now = new Date()) {
  const started = Date.now();
  const diagnostic = { discovered: 0, checked: 0, verified: 0, skipped: {}, examples: [] };
  const reject = (reason, candidate, details = {}) => {
    diagnostic.skipped[reason] = (diagnostic.skipped[reason] || 0) + 1;
    if (diagnostic.examples.length < 16 && candidate) diagnostic.examples.push({ url: candidate.url, title: candidate.product || '', reason, ...details });
  };
  const discovered = [];
  const feeds = [...FEEDS.map(x => DILLUK + x), 'https://www.gsshop.com/index.gs', ELEVEN_DEALS];
  let gsHome, elevenHome;
  for (let i = 0; i < feeds.length; i += 3) {
    const batch = await Promise.allSettled(feeds.slice(i, i + 3).map(url => fetcher(url, 10000, 1)));
    batch.forEach((r, k) => {
      const url = feeds[i + k];
      if (r.status !== 'fulfilled') return reject('feed_unavailable');
      if (url.includes('gsshop.com')) { gsHome = r.value; discovered.push(...gsCandidates(r.value.text, url)); }
      else if (url === ELEVEN_DEALS) {
        elevenHome = r.value;
        discovered.push(...elevenCandidates(r.value.text, url));
      } else discovered.push(...candidates(r.value.text, url));
    });
  }
  if (elevenHome) {
    const $ = cheerio.load(elevenHome.text);
    const links = $('a[href]').toArray().filter(e => ['생활주방','출산/유아','뷰티','식품','여성의류'].includes(clean($(e).text()))).map(e => $(e).attr('href')).filter(u => /^https:\/\/deal\.11st\.co\.kr\//.test(u));
    const pages = await Promise.allSettled([...new Set(links)].map(u => fetcher(u, 10000, 1)));
    for (const page of pages) {
      if (page.status === 'fulfilled') discovered.push(...elevenCandidates(page.value.text, page.value.url));
      else reject('eleven_category_feed_unavailable');
    }
  }
  // Category links come from the merchant's own current navigation, not guessed endpoints.
  if (gsHome) {
    const nav = cheerio.load(gsHome.text);
    const bargainLink = nav('a[href]').toArray().find(e => clean(nav(e).text()) === '특가');
    if (bargainLink) {
      try {
        const bargain = await fetcher(new URL(nav(bargainLink).attr('href'), gsHome.url).href, 10000, 1);
        discovered.push(...gsCandidates(bargain.text, bargain.url, true));
        const $b = cheerio.load(bargain.text), groups = [], categoryCounts = {};
        $b('a[href*="/deal/deal.gs"]').each((_, e) => {
          const category = familyCategory(clean($b(e).text()));
          if (!category || (categoryCounts[category] || 0) >= 2) return;
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
          groups.push(new URL($b(e).attr('href'), bargain.url).href);
        });
        const groupResults = await Promise.allSettled(groups.slice(0, 8).map(url => fetcher(url, 10000, 1)));
        groupResults.forEach(r => {
          if (r.status !== 'fulfilled') return reject('promotion_feed_unavailable');
          try {
            const j = JSON.parse(r.value.text.match(/var renderJson\s*=\s*(\{[^\n]+\});/)?.[1]);
            const products = j.dealDtl?.dealDtlSumryImgList || [];
            for (const { prdInfo: p } of products.slice(0, 12)) {
              if (!p?.prdCd || !familyCategory(p.exposPrdNm)) continue;
              discovered.push({ url: `https://www.gsshop.com/prd/prd.gs?prdid=${p.prdCd}`, direct: true, promotion: true, origin: r.value.url, product: productName(p.exposPrdNm) });
            }
          } catch { reject('promotion_data_missing'); }
        });
      } catch { reject('promotion_feed_unavailable'); }
    }
    const $ = cheerio.load(gsHome.text), links = [];
    $('a[href*="/shop/sect/sectL.gs"]').each((_, e) => {
      if (/^(물티슈|기저귀\/수유\/이유|세탁세제|주방용품|스킨케어|기초화장품|과자\/간식|쌀\/잡곡|김치\/반찬)$/.test(clean($(e).text()))) links.push(new URL($(e).attr('href'), gsHome.url).href);
    });
    const unique = [...new Set(links)];
    const offset = unique.length ? now.getUTCHours() % unique.length : 0;
    const selected = [...unique.slice(offset), ...unique.slice(0, offset)].slice(0, 3);
    for (const url of selected) {
      try { const p = await fetcher(url, 10000, 1); discovered.push(...gsCandidates(p.text, p.url)); } catch { reject('category_feed_unavailable'); }
    }
  }
  const prior = (state.shoppingSources || []).filter(x => now - new Date(x.seenAt) < 3 * 864e5);
  const unique = new Map(prior.map(x => [x.url, x]));
  // Preserve an independent deal listing's price when both discovery routes find a product.
  for (const candidate of discovered.sort((a, b) => Number(b.direct) - Number(a.direct))) {
    unique.set(candidate.url, { ...candidate, seenAt: now.toISOString() });
  }
  const kstDay = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(d));
  for (const candidate of unique.values()) if (candidate.promotion && kstDay(candidate.seenAt) !== kstDay(now)) candidate.promotion = false;
  state.shoppingSources = [...unique.values()].slice(-300);
  diagnostic.discovered = unique.size;
  const used = new Set((state.published || []).map(x => shoppingUrl(x.sourceUrl)).filter(Boolean));
  const supported = [...unique.values()].filter(x => !used.has(x.url) && /^(www\.gsshop\.com|harimmall\.com|www\.11st\.co\.kr)$/.test(new URL(x.url).hostname));
  // Fresh deal listings first, then rotating official coupon candidates.
  const fromDeals = supported.filter(x => !x.direct);
  const groups = new Map();
  for (const p of supported.filter(x => x.direct && x.promotion)) {
    const key = p.category || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const promotions = [];
  for (let i = 0; [...groups.values()].some(v => v[i]); i++) for (const group of groups.values()) if (group[i]) promotions.push(group[i]);
  const official = supported.filter(x => x.direct && !x.promotion);
  const offset = official.length ? (now.getUTCHours() * 11) % official.length : 0;
  const pending = [...fromDeals, ...promotions, ...official.slice(offset), ...official.slice(0, offset)].slice(0, 240);
  const out = [];
  for (let i = 0; i < pending.length; i += 3) {
    if (out.length >= 48 || Date.now() - started > 180000) break;
    const batch = await Promise.allSettled(pending.slice(i, i + 3).map(async candidate => {
      const page = await fetcher(candidate.url, 8000, 1);
      const offer = readShoppingOffer(page.text, page.url, candidate.direct ? { product: candidate.product } : candidate, new Date());
      return { offer, candidate: { ...candidate, url: page.url } };
    }));
    batch.forEach((r, k) => {
      diagnostic.checked++;
      if (r.status !== 'fulfilled') return reject('merchant_unavailable', pending[i + k]);
      const { offer, candidate } = r.value;
      if (!offer.ok) return reject(offer.reason, candidate, offer.reason === 'gs_product_data_missing' ? { pageTitle: offer.pageTitle, pageText: offer.pageText, initializer: offer.initializer, bytes: offer.bytes } : {});
      // Direct catalog discovery alone does not make a normal-price product a hot deal.
      if (candidate.direct && !candidate.promotion && (!offer.coupon || offer.benefitPercent < 10)) return reject('no_verified_shopping_benefit', candidate);
      out.push(itemFromOffer(offer, candidate, new Date()));
    });
  }
  diagnostic.verified = out.length;
  state.shoppingDiagnostics = diagnostic;
  return out;
}

import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 DealOpsCloud/2.0 (+https://github.com/5ggul/pm-lab)';
const HOTDEAL_SOURCE = 'https://dilluk.app/';
const POLICY_LIST = 'https://www.korea.kr/news/policyNewsList.do?smenu=EDS01';
const FESTIVAL_BASE = 'https://app.visitkorea.or.kr';
const MIN_DISCOUNT = 10;

export const kstDate = (d = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);

export const normalizeTitle = (s = '') => String(s)
  .normalize('NFKC')
  .replace(/[｜|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const decode = (s = '') => String(s)
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const strip = (s = '') => decode(String(s)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

const num = (s) => Number(String(s ?? '').replace(/[^0-9]/g, ''));
const money = (n) => Number(n).toLocaleString('ko-KR') + '원';
const canonical = (u = '') => {
  try {
    const x = new URL(u);
    const keepKeys = [...x.searchParams.keys()].filter(k => !/^(utm_|fbclid$|gclid$)/i.test(k)).sort();
    const kept = new URLSearchParams();
    for (const key of keepKeys) {
      const value = x.searchParams.get(key);
      if (value) kept.set(key, value);
    }
    const q = kept.toString();
    return x.origin + x.pathname + (q ? '?' + q : '');
  } catch {
    return String(u).replace(/[#].*$/, '');
  }
};
const absolute = (u, base) => {
  try { return new URL(decode(u), base).href; } catch { return ''; }
};

export async function fetchText(url, timeout = 18000, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, {
        redirect: 'follow',
        signal: c.signal,
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/json,*/*' }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { url: r.url, text: await r.text(), headers: r.headers };
    } catch (e) {
      lastError = e;
      if (attempt >= attempts) break;
      await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastError || new Error('fetch failed');
}

function shortProductTitle(s = '') {
  return normalizeTitle(s)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^(롯데온|쿠팡|네이버|지마켓|옥션|오늘의집|CJ더마켓)\s*[:\]-]?\s*/i, '')
    .replace(/\s*\([^)]*원[^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countInfo(title = '') {
  const matches = [...title.matchAll(/(?:총\s*)?(\d{1,4})\s*(개|팩|캔|병|포|매|입|롤|봉|통|박스|세트|각)/g)];
  if (!matches.length) return null;

  const explicitTotal = matches.filter(m => m[0].includes('총'));
  if (explicitTotal.length === 1) {
    return { count: Number(explicitTotal[0][1]), unit: explicitTotal[0][2] };
  }

  // 서로 다른 수량 단위나 여러 옵션 수량이 한 제목에 함께 있으면
  // 어느 구성의 가격인지 확정할 수 없으므로 단가를 만들지 않는다.
  const unique = [...new Set(matches.map(m => `${m[1]}:${m[2]}`))];
  const units = new Set(matches.map(m => m[2]));
  if (unique.length !== 1 || units.size !== 1) return null;

  return { count: Number(matches[0][1]), unit: matches[0][2] };
}

function titlePriceInfo(title = '') {
  const values = [...title.matchAll(/(\d[\d,]{2,})\s*원/g)]
    .map(m => Number(m[1].replace(/,/g, '')))
    .filter(Number.isFinite);
  return [...new Set(values)];
}

function jsonLdProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(decode(m[1]).trim());
      const walk = (v) => {
        if (!v) return;
        if (Array.isArray(v)) return v.forEach(walk);
        if (typeof v === 'object') {
          if (String(v['@type'] || '').toLowerCase() === 'product') out.push(v);
          Object.values(v).forEach(walk);
        }
      };
      walk(j);
    } catch {}
  }
  return out;
}

function merchantFacts(html) {
  const prices = [];
  for (const p of jsonLdProducts(html)) {
    const offers = Array.isArray(p.offers) ? p.offers : [p.offers].filter(Boolean);
    for (const o of offers) {
      const currency = String(o?.priceCurrency || '').toUpperCase();
      if (currency && currency !== 'KRW') continue;
      const n = num(o?.price);
      if (n) prices.push(n);
    }
  }
  for (const re of [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/ig
  ]) {
    for (const m of html.matchAll(re)) {
      const n = num(m[1]);
      if (n) prices.push(n);
    }
  }
  const $ = cheerio.load(html);
  const imageUrl =
    $('meta[property="og:image:secure_url"]').attr('content') ||
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') || '';
  return { prices: [...new Set(prices)], imageUrl };
}

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export async function collectHotdeals(state) {
  const home = await fetchText(HOTDEAL_SOURCE);
  const cards = [...home.text.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map(m => m[0]);
  const attr = (h, n) => decode((h.match(new RegExp(n + '="([^"]*)"', 'i')) || [])[1] || '');
  const textOf = (h, re) => strip((h.match(re) || [])[1] || '');
  const raw = cards.map(c => ({
    source: attr(c, 'data-source'),
    mall: attr(c, 'data-mall'),
    title: textOf(c, /<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i),
    priceText: textOf(c, /<span[^>]*data-card-price[^>]*>([\s\S]*?)<\/span>/i),
    shipping: textOf(c, /<span[^>]*class="ship"[^>]*>([\s\S]*?)<\/span>/i),
    originUrl: absolute((c.match(/<a[^>]*class="origin[^"]*"[^>]*href="([^"]+)"/i) || [])[1] || '', HOTDEAL_SOURCE),
    buyUrl: absolute((c.match(/<a[^>]*class="buy[^"]*"[^>]*href="([^"]+)"/i) || [])[1] || '', HOTDEAL_SOURCE)
  })).filter(x => x.title && x.buyUrl && x.originUrl && num(x.priceText) >= 100)
    .filter(x => !/[$€£]|\bUSD\b|\bUS\$/i.test(x.priceText + ' ' + x.title))
    .filter(x => {
      const titlePrices = titlePriceInfo(x.title);
      if (titlePrices.length > 1) return false;
      if (titlePrices.length === 1) {
        const cardPrice = num(x.priceText);
        const diff = Math.abs(titlePrices[0] - cardPrice) / Math.max(titlePrices[0], cardPrice);
        if (diff > 0.05) return false;
      }
      return true;
    })
    .filter(x => !/(스팀|steam|게임|플레이스테이션|xbox|닌텐도|게이밍|그래픽카드|RTX\s*\d|GTX\s*\d|\bX3D\b|메인보드)/i.test(x.title + ' ' + x.mall));

  const out = [];
  const today = kstDate();
  for (const deal of raw.slice(0, 24)) {
    if (out.length >= 8) break;
    const price = num(deal.priceText);
    const key = canonical(deal.buyUrl);
    let pg;
    try { pg = await fetchText(deal.buyUrl, 16000); } catch { continue; }
    const mf = merchantFacts(pg.text);
    const merchantCheck = verifyMerchantPrice(pg.text, { product: shortProductTitle(deal.title), price });
    const merchant = mf.prices
      .filter(p => p > price * 1.02 && p < price * 4)
      .sort((a, b) => a - b);
    const prior = (state.priceHistory[key] || [])
      .filter(x => x.verified === true && x.date !== today && x.price > price * 1.02)
      .map(x => x.price);
    const historyBase = median(prior);
    let baselinePrice = historyBase || merchant[0] || 0;
    let baselineSource = historyBase ? (prior.length >= 3 ? '최근 관측가 중앙값' : '이전 관측가') : baselinePrice ? '상품 페이지 비교 후보(미검증)' : '';
    state.priceHistory[key] = [
      ...(state.priceHistory[key] || []),
      { date: today, price, title: deal.title, verified: merchantCheck.ok === true }
    ].filter((v, i, a) => a.findLastIndex(x => x.date === v.date && x.price === v.price) === i).slice(-30);
    if (!baselinePrice) continue;
    const saving = baselinePrice - price;
    const discountPct = saving / baselinePrice * 100;
    if (discountPct < MIN_DISCOUNT) continue;
    const imageUrl = absolute(mf.imageUrl, pg.url);
    if (!imageUrl) continue;
    const unitInfo = countInfo(deal.title);
    const category = /샴푸|세제|휴지|화장지|물티슈|각티슈|티슈|치약|면도|키친타월|생리대|세정제/.test(deal.title) ? '생활용품' :
      /햇반|라면|음료|캔|커피|삼치|쭈꾸미|식품|과일|고기|생선|우유|간식/.test(deal.title) ? '식품' : '일반';
    const item = {
      id: 'hot:' + key,
      type: 'hotdeal',
      board: '🎁 핫딜 정보',
      sourceUrl: key,
      originUrl: deal.originUrl,
      buyUrl: pg.url,
      title: deal.title,
      price,
      baselinePrice,
      baselineSource,
      saving,
      discountPct,
      unitInfo,
      category,
      shipping: deal.shipping || '',
      imageUrl,
      expiresAt: null,
      copyContext: {
        kind: 'hotdeal',
        intent: unitInfo?.count > 1 ? 'DEAL_UNIT' : 'DEAL_PRICE',
        product: shortProductTitle(deal.title),
        price,
        baselinePrice,
        baselineSource,
        saving,
        discountPct,
        unitInfo,
        unitPrice: unitInfo?.count > 1 ? Math.round(price / unitInfo.count) : 0,
        shipping: deal.shipping || '',
        category,
        merchant: deal.mall || deal.source || '',
        buyUrl: pg.url,
        claims: [
          { key: 'current_price', value: price, unit: 'KRW', source: 'deal_source', sourceUrl: deal.originUrl, confidence: 0.90 },
          { key: 'baseline_price', value: baselinePrice, unit: 'KRW', label: baselineSource, source: baselineSource, sourceUrl: pg.url, confidence: baselineSource === '최근 관측가 중앙값' ? 0.90 : 0.84 },
          { key: 'saving', value: saving, unit: 'KRW', source: 'derived', confidence: 0.99 },
          { key: 'discount_pct', value: discountPct, unit: '%', source: 'derived', confidence: 0.99 },
          ...(unitInfo?.count > 1 ? [{ key: 'unit_price', value: Math.round(price / unitInfo.count), unit: 'KRW', source: 'derived', confidence: 0.99 }] : []),
          ...(deal.shipping ? [{ key: 'shipping', value: deal.shipping, source: 'deal_source', confidence: 0.90 }] : [])
        ]
      }
    };
    const verification = verifyMerchantPrice(pg.text, item.copyContext);
    item.verification = { status: verification.ok ? 'verified' : 'review', reason: verification.reason, observedAt: new Date().toISOString(), method: 'merchant_product_offer' };
    item.copyContext.conditions = verification.conditions || [];
    item.copyContext.requiredConditions = verification.conditions || [];
    item.copyContext.claims = item.copyContext.claims.map(c => ({ ...c, sourceUrl: c.sourceUrl || pg.url, verified: verification.ok, observedAt: item.verification.observedAt }));
    if (verification.ok) {
      item.copyContext.deliveredPrice = price + verification.shippingCost;
      item.copyContext.shipping = verification.shippingCost === 0 ? '무료배송' : `배송비 ${verification.shippingCost.toLocaleString('ko-KR')}원`;
      item.shipping = item.copyContext.shipping;
      item.copyContext.productIdentity = verification.productIdentity;
      item.copyContext.productIdentityVerified = Boolean(verification.productIdentity);
      item.copyContext.quantityVerified = Boolean(unitInfo && verification.unitInfo?.count === unitInfo.count && verification.unitInfo?.unit === unitInfo.unit);
      item.copyContext.eligibilityKey = 'unconditional';
    }
    // A higher offer on the page is not evidence of a former price.
    if (!historyBase) item.verification = { ...item.verification, status: 'review', reason: 'baseline_not_verified_history' };
    out.push(item);
  }
  return out;
}

function meta(html, key) {
  const $ = cheerio.load(html);
  return decode($(`meta[property="${key}"]`).attr('content') ||
    $(`meta[name="${key}"]`).attr('content') || '');
}

function articleParagraphs(html) {
  const $ = cheerio.load(html);
  return $('.view_cont p').map((_, el) => strip($(el).html() || $(el).text()))
    .get()
    .filter(x => x.length >= 20 && !/^문의[:：]/.test(x));
}

function policyBoard(text) {
  if (/(환급|공제|장려금|청약|요금|통행료|주유소|충전|할인|지원금|보조금|유류세)/.test(text)) return '💰 꿀팁 공유';
  if (/(카드|금리|대출|예금|적금|금융)/.test(text)) return '💳 카드 혜택';
  return '📢 생활 이슈';
}

function policyStructuredFacts(title, facts) {
  // Exact source sentences for review; never infer a year, amount or deadline.
  return facts.filter(x => /\d/.test(x)).slice(0, 4);
}

export async function collectOfficial() {
  const list = await fetchText(POLICY_LIST);
  const links = [];
  for (const m of list.text.matchAll(/<a\b[^>]*href="([^"]*policyNewsView\.do\?newsId=[^"]+)"/gi)) {
    const u = absolute(m[1], POLICY_LIST);
    if (u && !links.includes(u)) links.push(u);
  }
  const include = /(청약|통행료|주유소|충전|요금|할인|쿠폰|환급|세금|공제|장려금|포인트|보험|금리|적금|예금|카드|대출|주거|교통비|전기|가스|통신|공과금|가격|생활비|무료|수수료|지원금|보조금|연말정산|소득공제|지원대상|지원제도)/i;
  const exclude = /(대통령|국회|정당|선거|정치|외교|북핵|유엔|정상회담|군사|전쟁|북한)/i;
  const out = [];
  for (const url of links.slice(0, 18)) {
    if (out.length >= 7) break;
    let pg;
    try { pg = await fetchText(url); } catch { continue; }
    const title = strip(meta(pg.text, 'og:title'));
    const desc = strip(meta(pg.text, 'og:description')).replace(/\s*-\s*정책브리핑[\s\S]*$/i, '').trim();
    if (!title || exclude.test(title + ' ' + desc) || !include.test(title + ' ' + desc)) continue;
    const paras = articleParagraphs(pg.text);
    const facts = paras.filter(x => /\d|%/.test(x)).slice(0, 4);
    if (facts.length < 2) continue;
    const board = policyBoard(title + ' ' + desc);
    const structuredFacts = policyStructuredFacts(title, facts);
    if (structuredFacts.length < 2) continue;
    const item = {
      id: 'official:' + pg.url,
      type: board === '💰 꿀팁 공유' ? 'tip' : board === '💳 카드 혜택' ? 'card' : 'life',
      board,
      sourceUrl: pg.url,
      imageUrl: '',
      expiresAt: null,
      copyContext: {
        kind: 'policy',
        intent: /(신청|마감|기한|까지)/.test(title + ' ' + structuredFacts.join(' ')) ? 'DEADLINE' : 'BENEFIT',
        sourceTitle: title,
        facts: structuredFacts,
        url: pg.url,
        board,
        claims: structuredFacts.map((value, index) => ({
          key: 'fact_' + (index + 1),
          value,
          source: 'official_policy',
          sourceUrl: pg.url,
          confidence: 0.98
        }))
      },
      trustScore: 98,
      verification: { status: 'review', reason: 'policy_requires_source_and_condition_review', observedAt: new Date().toISOString() }
    };
    out.push(item);
  }
  return out;
}

function formatDate(raw = '') {
  const s = String(raw).replace(/[^0-9]/g, '');
  if (s.length >= 8) return `${Number(s.slice(4, 6))}/${Number(s.slice(6, 8))}`;
  return raw;
}

function eventRegion(item, detailText) {
  const raw = item.addr1 || item.adres || item.address || item.sidoNm || item.rnAdres || '';
  if (raw) return String(raw).split(' ').slice(0, 2).join(' ');
  const m = detailText.match(/(?:주소|장소)\s*[:：]?\s*([^\n]{3,45})/);
  return m ? strip(m[1]).split(' ').slice(0, 2).join(' ') : '';
}

export async function collectEvents() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(now);
  const get = (type) => Number(parts.find(x => x.type === type)?.value || 0);
  const year = get('year'), month = get('month'), day = get('day');
  const url = `${FESTIVAL_BASE}/kfes/list/festivalCalendarList.do?year=${year}&month=${month}&day=${day}&page=0&offset=100`;
  let data;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!r.ok) return [];
    data = await r.json();
  } catch {
    return [];
  }
  const items = data?.dataList?.items || data?.items || [];
  const out = [];
  for (const item of items.slice(0, 30)) {
    if (out.length >= 6) break;
    const id = item.fstvlCntntsId || item.contentid || item.id;
    const name = strip(item.cntntsNm || item.title || item.fstvlNm || '');
    if (!id || !name) continue;
    const detailUrl = `${FESTIVAL_BASE}/kfes/detail/fstvlDetail.do?fstvlCntntsId=${encodeURIComponent(id)}&cntntsNm=${encodeURIComponent(name.replace(/\s+/g, ''))}`;
    let pg;
    try { pg = await fetchText(detailUrl); } catch { continue; }
    const detailText = strip(pg.text);
    const $detail = cheerio.load(pg.text);
    const priceField = strip(
      $detail('.info_ico.price').closest('li').find('.info_content').first().text()
    );
    // 행사 전체 가격 필드가 명확히 무료/할인일 때만 자동 게시한다.
    // "유료 / 무료(일부 체험)"처럼 일부만 무료인 행사는 전체 무료로 만들지 않는다.
    const exactFree = /^(?:무료|0원)$/.test(priceField.trim());
    const pctMatch = priceField.match(/(?:할인[^\d]{0,20}(\d{1,3})\s*%|(\d{1,3})\s*%[^\n]{0,20}할인)/i);
    let cost = '';
    if (exactFree) cost = '무료';
    else if (pctMatch) cost = `${pctMatch[1] || pctMatch[2]}% 할인`;
    if (!cost) continue;
    const region = eventRegion(item, detailText);
    const start = item.fstvlBgngDe || item.eventstartdate || item.startDate || '';
    const end = item.fstvlEndDe || item.eventenddate || item.endDate || '';
    let imageUrl = '';
    const rawImg = item.dispFstvlCntntsImgRout || item.firstimage || item.image || '';
    if (rawImg) {
      imageUrl = String(rawImg).startsWith('/data/kfes/contents/db/')
        ? String(rawImg).replace('/data/kfes/contents/db/', 'https://kfescdn.visitkorea.or.kr/kfes/upload/contents/db/300_')
        : absolute(rawImg, FESTIVAL_BASE);
    }
    const eventItem = {
      id: 'event:' + id,
      type: 'event',
      board: '💰 꿀팁 공유',
      sourceUrl: detailUrl,
      imageUrl,
      expiresAt: end || null,
      copyContext: {
        kind: 'event',
        intent: /무료|0원/.test(cost) ? 'FREE_EVENT' : 'LOCAL_EVENT',
        name,
        region,
        cost,
        start: formatDate(start),
        end: formatDate(end),
        url: detailUrl,
        claims: [
          { key: 'event_name', value: name, source: 'official_event', sourceUrl: detailUrl, confidence: 0.98 },
          ...(region ? [{ key: 'region', value: region, source: 'official_event', sourceUrl: detailUrl, confidence: 0.95 }] : []),
          { key: 'price', value: cost, source: 'official_event_price_field', sourceUrl: detailUrl, confidence: 0.98 },
          ...(start ? [{ key: 'start_date', value: formatDate(start), source: 'official_event', sourceUrl: detailUrl, confidence: 0.98 }] : []),
          ...(end ? [{ key: 'end_date', value: formatDate(end), source: 'official_event', sourceUrl: detailUrl, confidence: 0.98 }] : [])
        ]
      },
      trustScore: 98
    };
    eventItem.verification = { status: 'verified', observedAt: new Date().toISOString(), method: 'official_event_fields' };
    eventItem.copyContext.claims = eventItem.copyContext.claims.map(c => ({ ...c, verified: true, observedAt: eventItem.verification.observedAt }));
    eventItem.recheckEvidence = [name, priceField];
    out.push(eventItem);
  }
  return out;
}

export function canonicalSource(u) {
  return canonical(u);
}

// A deal aggregator price alone is not authoritative. Ambiguity goes to review.
export function verifyMerchantPrice(html, ctx) {
  const products = jsonLdProducts(html);
  if (products.length !== 1) return { ok: false, reason: 'ambiguous_product' };
  const product = products[0];
  const tokens = normalizeTitle(ctx.product).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(x => x.length > 1);
  const name = normalizeTitle(product.name || '');
  if (tokens.length < 2 || tokens.filter(x => name.includes(x)).length / tokens.length < 0.75) return { ok: false, reason: 'product_identity_unconfirmed' };
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers].filter(Boolean);
  if (offers.length !== 1) return { ok: false, reason: 'ambiguous_offer' };
  const offer = offers[0];
  if (String(offer.priceCurrency).toUpperCase() !== 'KRW' || Number(offer.price) !== Number(ctx.price)) return { ok: false, reason: 'merchant_price_mismatch' };
  if (!/InStock$/.test(offer.availability || '')) return { ok: false, reason: 'availability_unconfirmed' };
  if (/쿠폰|카드|멤버십|적립|첫.?구매|첫.?주문|앱전용/.test(ctx.product || '')) return { ok: false, reason: 'conditional_price_requires_review' };
  const details = Array.isArray(offer.shippingDetails) ? offer.shippingDetails : [offer.shippingDetails].filter(Boolean);
  if (details.length !== 1) return { ok: false, reason: 'shipping_unconfirmed' };
  const d = details[0], rate = d.shippingRate;
  if (!rate || rate.value == null || String(rate.currency).toUpperCase() !== 'KRW' || !Number.isFinite(Number(rate.value)) || Number(rate.value) < 0 || d.shippingConditions || rate.validForMemberTier || d.validForMemberTier) return { ok: false, reason: 'shipping_conditions_unconfirmed' };
  const productIdentity = product.gtin13 || product.gtin14 || product.gtin12 || product.gtin || '';
  return { ok: true, shippingCost: Number(rate.value), conditions: [], productIdentity, unitInfo: countInfo(name) };
}

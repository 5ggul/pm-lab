import { collectShopping } from './shopping-supply.mjs';
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
    const keepKeys = [...x.searchParams.keys()].filter(k => !/^(utm_|fbclid$|gclid$|pWise)/i.test(k)).sort();
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
  // Transport fallback for the public official source only. Never route around
  // HTTP denial/rate limits, and never send account credentials to the source.
  if (!/^HTTP /.test(lastError?.message || '') && new URL(url).hostname === 'www.korea.kr' && process.env.DAANGN_EDITOR_URL && process.env.DAANGN_EDITOR_TOKEN) {
    const response = await fetch(process.env.DAANGN_EDITOR_URL + '/source', {
      method: 'POST', headers: { authorization: `Bearer ${process.env.DAANGN_EDITOR_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url }), signal: AbortSignal.timeout(20000)
    });
    if (response.ok) { const page = await response.json(); if (page.url === url && typeof page.text === 'string') return page; }
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
  return collectShopping(state, fetchText);
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
  const started = Date.now();
  const list = await fetchText(POLICY_LIST, 12000, 1);
  const links = [];
  for (const m of list.text.matchAll(/<a\b[^>]*href="([^"]*policyNewsView\.do\?newsId=[^"]+)"/gi)) {
    const u = absolute(m[1], POLICY_LIST);
    if (u && !links.includes(u)) links.push(u);
  }
  const include = /(청약|통행료|주유소|충전|요금|할인|쿠폰|환급|세금|공제|장려금|포인트|보험|금리|적금|예금|카드|대출|주거|교통비|전기|가스|통신|공과금|가격|생활비|무료|수수료|지원금|보조금|연말정산|소득공제|지원대상|지원제도)/i;
  const exclude = /(대통령|국회|정당|선거|정치|외교|북핵|유엔|정상회담|군사|전쟁|북한)/i;
  const out = [];
  for (const url of links.slice(0, 18)) {
    if (out.length >= 7 || Date.now() - started > 60000) break;
    let pg;
    try { pg = await fetchText(url, 10000, 1); } catch { continue; }
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

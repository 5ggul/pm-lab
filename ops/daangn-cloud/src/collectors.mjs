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
    const keepKeys = ['prdCd', 'newsId', 'fstvlCntntsId', 'contentid', 'no'];
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

async function fetchText(url, timeout = 18000) {
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
  } finally {
    clearTimeout(t);
  }
}

function hashPick(arr, seed = '') {
  if (!arr.length) return '';
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
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
  const matches = [...title.matchAll(/(?:총\s*)?(\d{1,3})\s*(개|팩|캔|병|포|매|입|롤|봉|통|박스|세트)/g)];
  if (!matches.length) return null;
  const picked = matches.find(m => m[0].includes('총')) ||
    matches.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return { count: Number(picked[1]), unit: picked[2] };
}

function hotdealTitle(x) {
  const p = shortProductTitle(x.title);
  const pct = Math.round(x.discountPct);
  const opts = [
    `${money(x.baselinePrice)}짜리가 ${money(x.price)}, ${p}`,
    `${money(x.saving)} 차이 납니다, ${p} 지금 ${money(x.price)}`,
    `${pct}% 내려갔습니다, ${p} ${money(x.price)}`
  ];
  if (x.unitInfo?.count > 1) {
    opts.push(`${x.unitInfo.unit}당 약 ${money(Math.round(x.price / x.unitInfo.count))}, ${p} ${money(x.price)}`);
  }
  if (/식품|음료|세제|샴푸|휴지|물티슈|햇반|라면|커피|제로|캔|팩/.test(x.category + ' ' + p) && pct >= 25) {
    opts.push(`이 가격이면 쟁일 만합니다, ${p} ${money(x.price)}`);
  }
  return normalizeTitle(hashPick(opts, x.sourceUrl + kstDate()));
}

function hotdealBody(x) {
  const p = shortProductTitle(x.title);
  const pct = Math.round(x.discountPct * 10) / 10;
  const lines = [
    `${p}를 원래 사던 분이면 이번 가격 차이는 눈에 띕니다.`,
    '',
    `${x.baselineSource} ${money(x.baselinePrice)}에서 이번 딜은 ${money(x.price)}입니다. ${money(x.saving)} 차이, 약 ${pct}% 낮습니다.`
  ];
  if (x.unitInfo?.count > 1) {
    lines.push(`${x.unitInfo.count}${x.unitInfo.unit} 기준 ${x.unitInfo.unit}당 약 ${money(Math.round(x.price / x.unitInfo.count))}입니다.`);
  }
  if (x.shipping) lines.push(x.shipping + '입니다.');
  lines.push('', '가격만 보면',
    `- 비교가격 ${money(x.baselinePrice)}`,
    `- 이번 딜 ${money(x.price)}`,
    `- ${money(x.saving)} 차이, 약 ${pct}%`);
  if (x.unitInfo?.count > 1) {
    lines.push(`- ${x.unitInfo.unit}당 약 ${money(Math.round(x.price / x.unitInfo.count))}`);
  }
  if (x.shipping) lines.push('- ' + x.shipping);
  lines.push('', '상품 링크', x.buyUrl);
  return lines.join('\n');
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
  })).filter(x => x.title && x.buyUrl && x.originUrl && num(x.priceText) > 0)
    .filter(x => !/(스팀|steam|게임|플레이스테이션|xbox|닌텐도)/i.test(x.title + ' ' + x.mall));

  const out = [];
  const today = kstDate();
  for (const deal of raw.slice(0, 24)) {
    if (out.length >= 8) break;
    const price = num(deal.priceText);
    const key = canonical(deal.buyUrl);
    let pg;
    try { pg = await fetchText(deal.buyUrl, 16000); } catch { continue; }
    const mf = merchantFacts(pg.text);
    const merchant = mf.prices
      .filter(p => p > price * 1.02 && p < price * 4)
      .sort((a, b) => a - b);
    const prior = (state.priceHistory[key] || [])
      .filter(x => x.date !== today && x.price > price * 1.02)
      .map(x => x.price);
    const historyBase = median(prior);
    let baselinePrice = merchant[0] || 0;
    let baselineSource = baselinePrice ? '상품 페이지 표시가' : '';
    if (historyBase && (!baselinePrice || historyBase < baselinePrice)) {
      baselinePrice = historyBase;
      baselineSource = prior.length >= 3 ? '최근 관측가 중앙값' : '이전 관측가';
    }
    state.priceHistory[key] = [
      ...(state.priceHistory[key] || []),
      { date: today, price, title: deal.title }
    ].filter((v, i, a) => a.findIndex(x => x.date === v.date && x.price === v.price) === i).slice(-30);
    if (!baselinePrice) continue;
    const saving = baselinePrice - price;
    const discountPct = saving / baselinePrice * 100;
    if (discountPct < MIN_DISCOUNT) continue;
    const imageUrl = absolute(mf.imageUrl, pg.url);
    if (!imageUrl) continue;
    const unitInfo = countInfo(deal.title);
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
      category: /샴푸|세제|휴지|물티슈|치약|면도/.test(deal.title) ? '생활용품' :
        /햇반|라면|음료|캔|커피|삼치|쭈꾸미|식품/.test(deal.title) ? '식품' : '일반',
      shipping: deal.shipping || '',
      imageUrl,
      expiresAt: null
    };
    item.postTitle = hotdealTitle(item);
    item.postBody = hotdealBody(item);
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

function policyHookTitle(title, facts) {
  const t = normalizeTitle(title);
  if (/청약/.test(t)) return '청약통장 아직 예·부금이면 보세요, 전환기한 1년 연장';
  if (/충전.*50%|50%.*충전/.test(t)) return '전기차 충전비 반값, 추석 연휴 낮 11시~2시';
  if (/고속도로.*무료|주유소.*100원/.test(t)) return '추석 고속도로 무료, 주유소는 리터당 100원 내립니다';
  if (/19\.4%|청년미래적금/.test(t)) return '연 19.4% 청년미래적금, 10월 7일부터 다시 신청';
  if (/공적주택.*119만/.test(t)) return '2030년까지 공적주택 119만호, 달라지는 주거지원';
  const first = facts.find(x => /\d|%/.test(x)) || '';
  const numChunk = (first.match(/(?:\d[\d,.]*\s*(?:원|%|년|월|일|명|호|배|회))/) || [])[0];
  const hooks = [
    `이번에 챙길 생활혜택, ${t}`,
    `놓치기 아까운 정보, ${t}`,
    numChunk ? `${numChunk}가 핵심입니다, ${t}` : t
  ];
  return normalizeTitle(hashPick(hooks, t + kstDate()));
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
    const lead = facts[0];
    const bullets = facts.slice(1, 4);
    const board = policyBoard(title + ' ' + desc);
    const body = [
      lead, '',
      '핵심만 보면',
      ...bullets.map(x => '- ' + x),
      '',
      '공식 원문',
      pg.url
    ].join('\n');
    out.push({
      id: 'official:' + pg.url,
      type: board === '💰 꿀팁 공유' ? 'tip' : board === '💳 카드 혜택' ? 'card' : 'life',
      board,
      sourceUrl: pg.url,
      postTitle: policyHookTitle(title, facts),
      postBody: body,
      imageUrl: '',
      expiresAt: null
    });
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

function eventHookTitle(name, region, cost, endRaw) {
  const end = formatDate(endRaw);
  const free = /무료|0원/.test(cost);
  const hooks = free ? [
    `이번 주말 돈 안 쓰고 갈 곳, ${region ? region + ' ' : ''}${name} 무료`,
    `입장료 0원, ${region ? region + ' ' : ''}${name} ${end ? end + '까지' : ''}`,
    `아이랑 무료로 갈 곳, ${region ? region + ' ' : ''}${name}`
  ] : [
    `지금 할인 중인 나들이, ${region ? region + ' ' : ''}${name} ${cost}`,
    `이번 주말 싸게 갈 곳, ${region ? region + ' ' : ''}${name} ${cost}`
  ];
  return normalizeTitle(hashPick(hooks, name + kstDate()));
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
    const freeMatch = detailText.match(/(?:이용요금|입장료|가격|요금)[^\n]{0,80}(무료|0원)/i) ||
      (/무료입장|입장\s*무료|관람\s*무료/.test(detailText) ? ['','무료'] : null);
    const pctMatch = detailText.match(/(?:할인[^\d]{0,20}(\d{1,3})\s*%|(\d{1,3})\s*%[^\n]{0,20}할인)/i);
    let cost = '';
    if (freeMatch) cost = '무료';
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
    const dateText = [formatDate(start), formatDate(end)].filter(Boolean).join('~');
    const body = [
      `${region ? region + '에서 ' : ''}${name}이 열립니다. 비용은 ${cost}입니다.`,
      '',
      '가려면 이것만 보면 됩니다',
      dateText ? '- 기간 ' + dateText : '',
      region ? '- 지역 ' + region : '',
      '- 비용 ' + cost,
      '',
      '행사 자세히 보기',
      detailUrl
    ].filter(Boolean).join('\n');
    out.push({
      id: 'event:' + id,
      type: 'event',
      board: '📍 오늘어디가지',
      sourceUrl: detailUrl,
      postTitle: eventHookTitle(name, region, cost, end),
      postBody: body,
      imageUrl,
      expiresAt: end || null
    });
  }
  return out;
}

export function canonicalSource(u) {
  return canonical(u);
}

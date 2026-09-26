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

function dealUseLead(x, p) {
  if (x.category === '식품') {
    return [
      `${p} 자주 사시면 가격 한번 보세용.`,
      `${p} 쟁여두는 분들은 단가 체크해용.`,
      `간식이나 식재료로 자주 드시면 이번 가격 참고해용.`
    ];
  }
  if (x.category === '생활용품') {
    return [
      `${p} 필요했던 분들 가격 보세용.`,
      `${p} 자주 쓰시면 묶음 금액 체크해용.`,
      `생활용품은 쌓아두고 쓰니까 요런 딜 챙겨두세용.`
    ];
  }
  return [
    `${p} 찾던 분들 가격 체크해용.`,
    `${p} 살 예정이셨으면 지금 금액 참고해용.`,
    `${p} 필요했던 분들만 보세용.`
  ];
}

function hotdealCopyVariants(x) {
  const p = shortProductTitle(x.title);
  const pct = Math.round(x.discountPct * 10) / 10;
  const pctTitle = Math.round(x.discountPct);
  const unitPrice = x.unitInfo?.count > 1 ? Math.round(x.price / x.unitInfo.count) : 0;
  const unitLine = unitPrice
    ? `${x.unitInfo.count}${x.unitInfo.unit}이면 ${x.unitInfo.unit}당 약 ${money(unitPrice)} 나와용.`
    : '';
  const shipLine = x.shipping ? `${x.shipping}입니당.` : '';
  const leads = dealUseLead(x, p);

  const titles = [
    {
      id: 'hot-saving-first',
      text: `${p} ${money(x.price)}, 표시가보다 ${money(x.saving)} 내려왔어용`
    },
    {
      id: 'hot-discount-first',
      text: `${p} ${pctTitle}% 할인, 지금 ${money(x.price)}`
    },
    {
      id: 'hot-price-first',
      text: `${p} 지금 ${money(x.price)} 나와용`
    }
  ];

  if (unitPrice) {
    titles.push({
      id: 'hot-unit-first',
      text: `${p} ${x.unitInfo.count}${x.unitInfo.unit} ${money(x.price)}, ${x.unitInfo.unit}당 ${money(unitPrice)}`
    });
  }
  if (x.category === '식품' && pctTitle >= 25) {
    titles.push({
      id: 'hot-stockup',
      text: `${p} ${money(x.price)}, 쟁이실 분들 보세용`
    });
  }
  if (x.category === '생활용품' && pctTitle >= 20) {
    titles.push({
      id: 'hot-household',
      text: `${p} ${money(x.price)}, 생활용품 필요하면 체크해용`
    });
  }

  const bodies = [
    {
      id: 'hot-body-direct',
      text: [
        leads[0],
        '',
        `${x.baselineSource} ${money(x.baselinePrice)} → 지금 ${money(x.price)}`,
        `차이 ${money(x.saving)}, 약 ${pct}%`,
        unitLine,
        shipLine,
        '',
        `필요했던 분들만 참고해용.`,
        '',
        `상품 링크 ${x.buyUrl}`
      ].filter(Boolean).join('\n')
    },
    {
      id: 'hot-body-math',
      text: [
        leads[1],
        '',
        `지금 ${money(x.price)} 나와용.`,
        `${x.baselineSource}는 ${money(x.baselinePrice)}라 ${money(x.saving)} 차이납니당.`,
        unitLine,
        shipLine,
        '',
        `할인율은 약 ${pct}%`,
        `구매하실 분들은 옵션이랑 구성만 한번 확인해용.`,
        '',
        x.buyUrl
      ].filter(Boolean).join('\n')
    },
    {
      id: 'hot-body-checklist',
      text: [
        leads[2],
        '',
        `현재가 ${money(x.price)}`,
        `표시가 ${money(x.baselinePrice)}`,
        `차이 ${money(x.saving)} · 약 ${pct}%`,
        unitPrice ? `${x.unitInfo.unit}당 약 ${money(unitPrice)}` : '',
        x.shipping || '',
        '',
        `필요한 분들 참고해용.`,
        x.buyUrl
      ].filter(Boolean).join('\n')
    },
    {
      id: 'hot-body-savings',
      text: [
        `${p} 지금 ${money(x.price)} 떠있습니당.`,
        `${x.baselineSource} ${money(x.baselinePrice)}에서 ${money(x.saving)} 빠졌어용.`,
        unitLine,
        shipLine,
        '',
        `살 계획 있던 분들만 체크해용.`,
        '',
        `상품 페이지 ${x.buyUrl}`
      ].filter(Boolean).join('\n')
    }
  ];

  const variants = [];
  for (let i = 0; i < Math.max(titles.length, bodies.length); i++) {
    const title = titles[i % titles.length];
    const body = bodies[i % bodies.length];
    variants.push({
      titlePattern: title.id,
      bodyPattern: body.id,
      postTitle: normalizeTitle(title.text),
      postBody: body.text
    });
  }
  return variants;
}

function defaultCopyVariant(variants, seed) {
  return variants[Math.abs([...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0)) % variants.length];
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
    item.copyVariants = hotdealCopyVariants(item);
    const chosen = defaultCopyVariant(item.copyVariants, item.sourceUrl + today);
    item.postTitle = chosen.postTitle;
    item.postBody = chosen.postBody;
    item.titlePattern = chosen.titlePattern;
    item.bodyPattern = chosen.bodyPattern;
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

function policyHookTitleVariants(title, facts) {
  const t = normalizeTitle(title);
  if (/청약/.test(t)) return [
    { id: 'policy-deadline', text: '청약통장 아직 예·부금이면 보세요, 전환기한 1년 연장' },
    { id: 'policy-action', text: '옛 청약통장 그대로라면 체크, 전환기한 2027년 9월까지' }
  ];
  if (/충전.*50%|50%.*충전/.test(t)) return [
    { id: 'policy-discount', text: '전기차 충전비 반값, 추석 연휴 낮 시간대 적용' },
    { id: 'policy-saving', text: '추석에 전기차 충전한다면, 공공충전기 요금 50% 할인' }
  ];
  if (/고속도로.*무료|주유소.*100원/.test(t)) return [
    { id: 'policy-free', text: '추석 고속도로 무료, 주유소는 리터당 100원 내립니다' },
    { id: 'policy-travel-saving', text: '차로 고향 간다면 챙길 것, 고속도로 무료에 기름값 100원↓' }
  ];
  if (/19\.4%|청년미래적금/.test(t)) return [
    { id: 'policy-rate', text: '연 19.4% 청년미래적금, 10월 7일부터 다시 신청' },
    { id: 'policy-application', text: '청년미래적금 2차 신청, 10월 7~16일 놓치지 마세요' }
  ];
  if (/공적주택.*119만/.test(t)) return [
    { id: 'policy-housing', text: '2030년까지 공적주택 119만호, 달라지는 주거지원' },
    { id: 'policy-housing-number', text: '공적주택 119만호 공급 계획, 2030년까지 이렇게 갑니다' }
  ];
  const first = facts.find(x => /\d|%/.test(x)) || '';
  const numChunk = (first.match(/(?:\d[\d,.]*\s*(?:원|%|년|월|일|명|호|배|회))/) || [])[0];
  return [
    { id: 'policy-plain', text: t },
    { id: 'policy-number', text: numChunk ? `${numChunk}가 핵심, ${t}` : t },
    { id: 'policy-household', text: `생활비에 바로 연결되는 변화, ${t}` }
  ];
}

function policyStructuredFacts(title, facts) {
  const text = [title, ...facts].join(' ');
  const out = [];
  const push = (s) => {
    if (s && !out.includes(s)) out.push(s);
  };

  if (/고속도로|주유소/.test(text)) {
    if (/24일부터 27일까지|24~27|24일.*27일/.test(text)) push('9월 24~27일 고속도로 통행료 무료');
    if (/리터당\s*100원|100원\s*(?:내린|인하)/.test(text)) push('고속도로 주유소 유류 가격 L당 100원 인하');
    if (/KTX[^.]{0,60}10%|10%[^.]{0,60}KTX/i.test(text)) push('KTX 운임 평균 10% 인하');
    if (/역귀성[^.]{0,60}50%|50%[^.]{0,60}역귀성/.test(text)) push('역귀성 운임 최대 50% 할인');
  }
  if (/청약/.test(text)) {
    if (/2027/.test(text)) push('전환 신청 기한 2027년 9월 30일까지');
    if (/가입기간/.test(text) && /금리|인정/.test(text)) push('기존 가입기간도 전환 후 금리 산정에 반영');
  }
  if (/청년미래적금/.test(text)) {
    if (/10월\s*7/.test(text) && /16/.test(text)) push('2차 신청 10월 7~16일');
    if (/11월\s*16/.test(text)) push('계좌 개설 11월 16일부터');
    if (/19\.4%/.test(text)) push('안내 기준 연 최고 19.4% 수준');
  }
  if (/전기차|충전/.test(text)) {
    if (/50%/.test(text)) push('공공충전기 요금 50% 할인');
    const tm = text.match(/(?:오전|낮|오후)?\s*(\d{1,2})시[^\d]{0,15}(\d{1,2})시/);
    if (tm) push(`적용 시간 ${tm[1]}시~${tm[2]}시`);
  }
  if (/공적주택/.test(text) && /119만/.test(text)) {
    push('2030년까지 공적주택 총 119만호 공급');
    if (/24만/.test(text)) push('공공분양 24만호 공급 계획');
    if (/92만/.test(text)) {
      push(/77%/.test(text)
        ? '전체 물량의 77%인 92만호를 주거수요가 큰 지역에 공급'
        : '주거수요가 큰 지역에 92만호 공급 계획');
    }
    if (/13\.6%/.test(text)) push('119만호는 전체 주택 재고의 약 13.6% 규모');
  }

  // 숫자의 의미를 문장으로 재구성하지 못하면 자동 게시하지 않는다.
  return out.slice(0, 4);
}

function policyCopyVariants(title, facts, url, board) {
  const titles = policyHookTitleVariants(title, facts);
  const factLines = policyStructuredFacts(title, facts);
  if (factLines.length < 2) return [];

  const leads = board === '💰 꿀팁 공유'
    ? [
        '해당되는 분들 요건 챙겨용.',
        '날짜랑 금액만 간단히 적어둘게용.',
        '놓치면 아까운 내용만 적어둡니당.'
      ]
    : board === '💳 카드 혜택'
      ? [
          '신청하실 분들은 날짜 먼저 체크해용.',
          '금리랑 신청기간만 적어둘게용.',
          '조건 맞는 분들은 기간 놓치지 마세용.'
        ]
      : [
          '생활에 영향 있는 내용만 적어둘게용.',
          '바뀌는 내용만 짧게 정리해용.',
          '필요한 숫자만 챙겨갑니당.'
        ];

  const bodies = [
    {
      id: 'policy-body-short',
      text: [
        leads[0],
        '',
        ...factLines.map(x => `- ${x}`),
        '',
        `공식 안내 ${url}`
      ].join('\n')
    },
    {
      id: 'policy-body-action',
      text: [
        leads[1],
        '',
        ...factLines.map((x, i) => `${i + 1}. ${x}`),
        '',
        `해당되면 날짜만 꼭 챙겨용.`,
        `공식 안내 ${url}`
      ].join('\n')
    },
    {
      id: 'policy-body-household',
      text: [
        leads[2],
        '',
        factLines.join('\n'),
        '',
        `대상 맞는 분들만 참고해용.`,
        url
      ].join('\n')
    }
  ];

  const variants = [];
  for (let i = 0; i < Math.max(titles.length, bodies.length); i++) {
    const tt = titles[i % titles.length];
    const bb = bodies[i % bodies.length];
    variants.push({
      titlePattern: tt.id,
      bodyPattern: bb.id,
      postTitle: normalizeTitle(tt.text),
      postBody: bb.text
    });
  }
  return variants;
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
    const item = {
      id: 'official:' + pg.url,
      type: board === '💰 꿀팁 공유' ? 'tip' : board === '💳 카드 혜택' ? 'card' : 'life',
      board,
      sourceUrl: pg.url,
      imageUrl: '',
      expiresAt: null
    };
    item.copyVariants = policyCopyVariants(title, facts, pg.url, board);
    if (!item.copyVariants.length) continue;
    const chosen = defaultCopyVariant(item.copyVariants, item.sourceUrl + kstDate());
    item.postTitle = chosen.postTitle;
    item.postBody = chosen.postBody;
    item.titlePattern = chosen.titlePattern;
    item.bodyPattern = chosen.bodyPattern;
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

function eventCopyVariants(name, region, cost, startRaw, endRaw, detailUrl) {
  const start = formatDate(startRaw);
  const end = formatDate(endRaw);
  const free = /무료|0원/.test(cost);
  const place = region ? `${region} ` : '';
  const period = start && end ? `${start}~${end}` : (end ? `${end}까지` : '');

  const titles = free ? [
    { id: 'event-free-weekend', text: `${place}${name} 입장 무료입니당` },
    { id: 'event-free-family', text: `아이랑 갈 곳 찾으면 ${place}${name} 무료입니당` },
    { id: 'event-free-zero', text: `${place}${name} 0원, ${end ? `${end}까지` : '기간 체크해용'}` },
    { id: 'event-free-light', text: `${place}${name} 무료, 가까우면 다녀오세용` }
  ] : [
    { id: 'event-discount-now', text: `${place}${name} ${cost} 적용됩니당` },
    { id: 'event-discount-family', text: `아이랑 나들이, ${place}${name} ${cost}` },
    { id: 'event-discount-weekend', text: `${place}${name} ${cost}, 주말 일정 참고해용` }
  ];

  const bodies = [
    {
      id: 'event-body-weekend',
      text: [
        free
          ? `${name} 입장 무료입니당.`
          : `${name} 지금 ${cost} 적용됩니당.`,
        period ? `기간 ${period}` : '',
        region ? `지역 ${region}` : '',
        `비용 ${cost}`,
        '',
        free
          ? `가까우면 주말에 다녀오세용.`
          : `할인할 때 가실 분들 참고해용.`,
        '',
        `행사 안내 ${detailUrl}`
      ].filter(Boolean).join('\n')
    },
    {
      id: 'event-body-family',
      text: [
        `아이랑 갈 곳 찾는 분들 ${name} 체크해용.`,
        region ? `지역 ${region}` : '',
        period ? `기간 ${period}` : '',
        `비용 ${cost}`,
        '',
        free
          ? `입장료 없어서 가볍게 다녀오기 좋습니당.`
          : `할인 적용되는 기간에 맞춰 다녀오세용.`,
        '',
        detailUrl
      ].filter(Boolean).join('\n')
    },
    {
      id: 'event-body-zero',
      text: [
        free ? `여긴 입장료 무료입니당.` : `현재 ${cost} 적용됩니당.`,
        period ? `기간 ${period}` : '',
        region ? `장소 ${region}` : '',
        '',
        `가까운 분들은 일정 맞으면 다녀오세용.`,
        '',
        `공식 행사 페이지 ${detailUrl}`
      ].filter(Boolean).join('\n')
    }
  ];

  const variants = [];
  for (let i = 0; i < Math.max(titles.length, bodies.length); i++) {
    const tt = titles[i % titles.length];
    const bb = bodies[i % bodies.length];
    variants.push({
      titlePattern: tt.id,
      bodyPattern: bb.id,
      postTitle: normalizeTitle(tt.text),
      postBody: bb.text
    });
  }
  return variants;
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
    const eventItem = {
      id: 'event:' + id,
      type: 'event',
      board: '📍 오늘어디가지',
      sourceUrl: detailUrl,
      imageUrl,
      expiresAt: end || null
    };
    eventItem.copyVariants = eventCopyVariants(name, region, cost, start, end, detailUrl);
    const chosen = defaultCopyVariant(eventItem.copyVariants, eventItem.sourceUrl + kstDate());
    eventItem.postTitle = chosen.postTitle;
    eventItem.postBody = chosen.postBody;
    eventItem.titlePattern = chosen.titlePattern;
    eventItem.bodyPattern = chosen.bodyPattern;
    out.push(eventItem);
  }
  return out;
}

export function canonicalSource(u) {
  return canonical(u);
}

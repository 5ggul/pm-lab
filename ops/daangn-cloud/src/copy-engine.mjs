const BANNED_AI = /(핵심만 보면|기준으로 보면|결국|체감|판단하면|볼 만해요|볼 만|눈여겨|반갑죠|감 와요|더 감이 와요|요건 챙겨|필요한 숫자만|간단히 적어둘게|생활에 영향 있는 내용만|한 번 체크해보세요|꼼꼼히 확인하세요|좋은 선택이 될 수|합리적인 가격|경쟁력 있는 가격|추천드립니다|도움이 되실 것 같|참고하시면 좋을 것 같|확인됩니다|확인해주세요|쿠폰 적용 여부|가격 변동|덜 내는 셈|아끼는 셈)/;
const FAKE_EXPERIENCE = /(저도\s*(?:샀|구매|주문|써|먹어|다녀)|제가\s*(?:샀|구매|주문|써|먹어|다녀)|저희\s*애|우리\s*애|써봤|먹어봤|사용해봤|직접\s*써|직접\s*먹|다녀왔는데|원래\s*쓰던)/;
const CUTE = /(나와용|보세용|챙겨용|해용|됩니당|입니당|좋습니당|왔어용|내려왔어용|참고해용)/g;
const URL_RE = /https?:\/\/\S+/i;

const money = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const lineList = s => String(s || '').split(/\n+/).map(clean).filter(Boolean);
const hash = s => [...String(s || '')].reduce((h, ch) => ((h * 33) ^ ch.charCodeAt(0)) >>> 0, 2166136261);

function prefix(s = '', n = 20) {
  return clean(s)
    .toLowerCase()
    .replace(/\d[\d,.]*(?:원|%|개|팩|일|월|년)?/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, '')
    .slice(0, n);
}

export function sourceStore(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function cuteCount(text = '') {
  return (String(text).match(CUTE) || []).length;
}

function lineLengthPattern(lines) {
  return lines.map(x => x.length < 16 ? 'S' : x.length < 36 ? 'M' : 'L').join('');
}

function endingForms(lines) {
  return [...new Set(lines.map(x => {
    const s = x.replace(URL_RE, '').replace(/[.!?~ㅎㅋ\s]+$/g, '');
    return s.slice(-4);
  }).filter(Boolean))].slice(0, 5);
}

function linkPosition(lines) {
  const i = lines.findIndex(x => URL_RE.test(x));
  if (i < 0) return 'none';
  if (i === 0) return 'start';
  if (i === lines.length - 1) return 'end';
  return 'middle';
}

export function analyzeCopy(title, body, hints = {}) {
  const lines = lineList(body);
  const nonLink = lines.filter(x => !URL_RE.test(x));
  const opening = nonLink[0] || lines[0] || '';
  const closing = nonLink.at(-1) || '';
  const lengths = nonLink.map(x => x.length);
  const spread = lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : 0;
  const cute = cuteCount(title + '\n' + body);
  let aiToneScore = 0;

  if (BANNED_AI.test(title + '\n' + body)) aiToneScore += 40;
  if (FAKE_EXPERIENCE.test(title + '\n' + body)) aiToneScore += 60;
  if (cute > 2) aiToneScore += 20 + (cute - 2) * 5;
  if (/참고(?:해용|하세요|해요)?[.!]?$/.test(closing)) aiToneScore += 15;
  if (/분들/.test(opening)) aiToneScore += 8;
  if (/(보세용|해용|참고해용)[.!]?$/.test(closing)) aiToneScore += 10;
  if (/(기존가|현재가).{0,8}\n.{0,8}(지금|현재).{0,8}\n.{0,8}차이/s.test(body)) aiToneScore += 15;
  if (nonLink.length >= 4 && spread < 10) aiToneScore += 10;

  let humanRhythmScore = 0;
  if (nonLink.length >= 2 && nonLink.length <= 6) humanRhythmScore += 8;
  if (spread >= 12) humanRhythmScore += 8;
  if (cute <= 1) humanRhythmScore += 6;
  if (!/참고|체크해|보세용/.test(closing)) humanRhythmScore += 8;
  if (linkPosition(lines) !== 'end') humanRhythmScore += 3;

  return {
    titleStructure: hints.titleStructure || hints.titlePattern || '',
    bodyStructure: hints.bodyStructure || hints.bodyPattern || '',
    skeleton: hints.skeleton || '',
    openingPhrase: prefix(opening, 24),
    closingPhrase: prefix(closing, 24),
    sentenceCount: nonLink.length,
    sentenceLengthPattern: lineLengthPattern(nonLink),
    endingForms: endingForms(nonLink),
    linkPosition: linkPosition(lines),
    numberCount: (String(title + '\n' + body).match(/\d[\d,.]*/g) || []).length,
    cuteEndingCount: cute,
    aiToneScore,
    humanRhythmScore
  };
}

export function validateGeneratedCopy(title, body) {
  const meta = analyzeCopy(title, body);
  const reasons = [];
  if (!clean(title) || !clean(body)) reasons.push('empty');
  if (title.includes('｜')) reasons.push('banned_separator');
  if (BANNED_AI.test(title + '\n' + body)) reasons.push('banned_ai_phrase');
  if (FAKE_EXPERIENCE.test(title + '\n' + body)) reasons.push('fake_experience');
  if (meta.cuteEndingCount > 2) reasons.push('too_many_cute_endings');
  if (meta.aiToneScore >= 30) reasons.push('ai_tone_score');
  return { ok: reasons.length === 0, reasons, meta };
}

function hotdealCandidates(ctx) {
  const p = clean(ctx.product);
  const price = money(ctx.price);
  const base = money(ctx.baselinePrice);
  const saving = money(ctx.saving);
  const pct = Math.round(Number(ctx.discountPct || 0));
  const unit = ctx.unitInfo?.count > 1
    ? `${ctx.unitInfo.count}${ctx.unitInfo.unit}이면 ${ctx.unitInfo.unit}당 약 ${money(ctx.unitPrice)}`
    : '';
  const shipping = clean(ctx.shipping);
  const link = ctx.buyUrl;
  const use = ctx.category === '생활용품'
    ? '자주 쓰는 생활용품이면 묶음 수량도 같이 보세요.'
    : ctx.category === '식품'
      ? '쟁여두는 분들은 수량이랑 단가만 같이 보세요.'
      : '';

  const titles = [
    ['deal-price', `${p} ${price}`],
    ['deal-compare', `${p} ${base} → ${price}`],
    ['deal-saving', `${p} ${price}, ${saving} 내려왔네요`],
    ['deal-discount', `${p} ${pct}% 할인, ${price}`]
  ];
  if (unit) titles.push(['deal-unit', `${p} ${ctx.unitInfo.count}${ctx.unitInfo.unit} ${price}, ${ctx.unitInfo.unit}당 ${money(ctx.unitPrice)}`]);

  const blocks = {
    PRICE: `지금 ${price} 나와요.`,
    COMPARE: `기존가 ${base}에서 ${price}으로 내려왔네요.`,
    ARROW: `기존가 ${base} → 지금 ${price}`,
    SAVING: `차이는 ${saving}.`,
    UNIT: unit ? unit + ' 정도입니다.' : '',
    SHIPPING: shipping ? shipping.replace(/입니다\.?$/, '') + '.' : '',
    USE: use,
    LINK: link
  };
  const plans = [
    ['PRICE','SHIPPING','LINK'],
    ['COMPARE','UNIT','LINK'],
    ['ARROW','SHIPPING','LINK'],
    ['USE','PRICE','UNIT','LINK'],
    ['PRICE','LINK','SHIPPING'],
    ['COMPARE','SAVING','LINK'],
    ['PRICE','UNIT','SHIPPING','LINK']
  ];

  const out = [];
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i].filter(k => blocks[k]);
    const title = titles[i % titles.length];
    out.push({
      titlePattern: title[0],
      bodyPattern: 'blocks-' + plan.join('-').toLowerCase(),
      skeleton: plan.join('>'),
      postTitle: title[1],
      postBody: plan.map(k => blocks[k]).join('\n')
    });
  }
  return out;
}

function eventCandidates(ctx) {
  const name = clean(ctx.name);
  const region = clean(ctx.region);
  const area = (region.split(/\s+/).filter(Boolean).at(-1) || region).replace(/(시|군|구)$/, '');
  const cost = clean(ctx.cost);
  const period = ctx.start && ctx.end ? `${ctx.start}~${ctx.end}` : (ctx.end ? `${ctx.end}까지` : '');
  const free = /무료|0원/.test(cost);
  const priceWord = free ? '입장 무료' : cost;
  const titles = [
    ['event-name-price', `${name} ${priceWord}`],
    ['event-region', `${area ? area + ' ' : ''}${name}, ${priceWord}`],
    ['event-period', `${name} ${period ? period + ', ' : ''}${priceWord}`],
    ['event-family', `아이랑 갈 곳 찾으면 ${area ? area + ' ' : ''}${name}`]
  ];
  const blocks = {
    REGION: region ? `${region}에서 열립니다.` : '',
    PERIOD: period ? `기간은 ${period}.` : '',
    PRICE: free ? '입장료는 무료.' : `비용은 ${cost}.`,
    FAMILY: '아이랑 갈 곳 찾는 분들은 일정만 한번 보세요.',
    LIGHT: area ? `${area} 쪽이면 일정 한번 보세요.` : '',
    LINK: ctx.url
  };
  const plans = [
    ['PERIOD','PRICE','LINK'],
    ['LIGHT','PERIOD','PRICE','LINK'],
    ['PRICE','REGION','PERIOD','LINK'],
    ['FAMILY','PERIOD','PRICE','LINK'],
    ['PERIOD','LINK','PRICE']
  ];
  return plans.map((plan, i) => {
    const used = plan.filter(k => blocks[k]);
    const t = titles[i % titles.length];
    return {
      titlePattern: t[0],
      bodyPattern: 'blocks-' + used.join('-').toLowerCase(),
      skeleton: used.join('>'),
      postTitle: t[1],
      postBody: used.map(k => blocks[k]).join('\n')
    };
  });
}

function policyLead(title = '') {
  if (/전기차|충전/.test(title)) return '전기차 있으시면 적용 시간대만 봐두세요.';
  if (/청약/.test(title)) return '청약통장 그대로 두신 분들은 기한 확인하세요.';
  if (/고속도로|주유소/.test(title)) return '연휴에 차로 이동하시면 이건 알아두세요.';
  if (/적금|금리|대출|카드/.test(title)) return '신청 생각 있으면 날짜와 조건 먼저 보세요.';
  return '';
}

function policyCandidates(ctx, legacy = []) {
  const facts = (ctx.facts || []).map(clean).filter(Boolean).slice(0, 4);
  const link = ctx.url;
  const titles = legacy
    .filter(x => !/policy-(?:number|household)/.test(x.titlePattern || ''))
    .map(x => [x.titlePattern || 'policy-legacy', x.postTitle])
    .filter(x => x[1]);
  if (!titles.length) titles.push(['policy-source', clean(ctx.sourceTitle)]);
  const lead = policyLead(ctx.sourceTitle);
  const blocks = {
    LEAD: lead,
    F1: facts[0] || '',
    F2: facts[1] || '',
    F3: facts[2] || '',
    F4: facts[3] || '',
    LINK: `공식 안내 ${link}`
  };
  const plans = [
    ['F1','F2','LINK'],
    ['LEAD','F1','F2','LINK'],
    ['F1','F2','F3','LINK'],
    ['F1','LINK','F2'],
    ['LEAD','F1','F2','F3','LINK']
  ];
  return plans.map((plan, i) => {
    const used = plan.filter(k => blocks[k]);
    const t = titles[i % titles.length];
    return {
      titlePattern: t[0],
      bodyPattern: 'blocks-' + used.join('-').toLowerCase(),
      skeleton: used.join('>'),
      postTitle: t[1],
      postBody: used.map(k => blocks[k]).join('\n')
    };
  });
}

function fallbackCandidate(item) {
  const ctx = item.copyContext || {};
  if (ctx.kind === 'hotdeal') {
    return {
      titlePattern: 'safe-price',
      bodyPattern: 'safe-price-link',
      skeleton: 'PRICE>LINK',
      postTitle: `${ctx.product} ${money(ctx.price)}`,
      postBody: `지금 ${money(ctx.price)} 나와요.\n${ctx.buyUrl}`
    };
  }
  if (ctx.kind === 'event') {
    return {
      titlePattern: 'safe-event',
      bodyPattern: 'safe-event-link',
      skeleton: 'PERIOD>PRICE>LINK',
      postTitle: `${ctx.name} ${ctx.cost}`,
      postBody: [ctx.start && ctx.end ? `${ctx.start}~${ctx.end}` : '', `비용 ${ctx.cost}`, ctx.url].filter(Boolean).join('\n')
    };
  }
  if (ctx.kind === 'policy') {
    return {
      titlePattern: 'safe-policy',
      bodyPattern: 'safe-policy-facts',
      skeleton: 'F1>F2>LINK',
      postTitle: clean(ctx.sourceTitle),
      postBody: [...(ctx.facts || []).slice(0, 2), `공식 안내 ${ctx.url}`].filter(Boolean).join('\n')
    };
  }
  return {
    titlePattern: item.titlePattern || 'legacy',
    bodyPattern: item.bodyPattern || 'legacy',
    skeleton: item.bodyPattern || 'legacy',
    postTitle: item.postTitle,
    postBody: item.postBody
  };
}

function candidatesFor(item) {
  const ctx = item.copyContext || {};
  if (ctx.kind === 'hotdeal') return hotdealCandidates(ctx);
  if (ctx.kind === 'event') return eventCandidates(ctx);
  if (ctx.kind === 'policy') return policyCandidates(ctx, item.copyVariants || []);
  return [...(item.copyVariants || []), fallbackCandidate(item)];
}

function recentMeta(posts = []) {
  return posts.map(x => x.copyMeta || {
    titleStructure: x.titlePattern || '',
    bodyStructure: x.bodyPattern || '',
    skeleton: x.bodyPattern || '',
    openingPhrase: prefix(x.title || '', 24),
    closingPhrase: ''
  });
}

export function selectCommunityCopy(item, recentPosts = []) {
  const candidates = [...candidatesFor(item), fallbackCandidate(item)];
  const history = recentMeta(recentPosts);
  const scored = [];

  for (const candidate of candidates) {
    const qa = validateGeneratedCopy(candidate.postTitle, candidate.postBody);
    if (!qa.ok) continue;
    const meta = analyzeCopy(candidate.postTitle, candidate.postBody, {
      titlePattern: candidate.titlePattern,
      bodyPattern: candidate.bodyPattern,
      skeleton: candidate.skeleton
    });
    let penalty = 0;
    const last5 = history.slice(-5);
    const last10 = history.slice(-10);
    const last20 = history.slice(-20);
    const last30 = history.slice(-30);
    if (meta.titleStructure && last5.some(x => x.titleStructure === meta.titleStructure)) penalty += 28;
    if (meta.bodyStructure && last10.some(x => x.bodyStructure === meta.bodyStructure)) penalty += 35;
    if (meta.skeleton && last10.some(x => x.skeleton === meta.skeleton)) penalty += 55;
    if (meta.openingPhrase && last20.some(x => x.openingPhrase === meta.openingPhrase)) penalty += 90;
    if (meta.closingPhrase && last30.some(x => x.closingPhrase === meta.closingPhrase)) penalty += 45;

    const jitter = hash((item.sourceUrl || item.id || '') + candidate.bodyPattern) % 11;
    const rank = meta.aiToneScore + penalty - meta.humanRhythmScore + jitter;
    scored.push({ candidate, meta, rank });
  }

  const picked = scored.sort((a, b) => a.rank - b.rank)[0];
  const selected = picked || {
    candidate: fallbackCandidate(item),
    meta: analyzeCopy(item.postTitle, item.postBody, {
      titlePattern: item.titlePattern,
      bodyPattern: item.bodyPattern,
      skeleton: item.bodyPattern
    }),
    rank: 999
  };

  return {
    ...item,
    ...selected.candidate,
    copyMeta: selected.meta,
    aiToneScore: selected.meta.aiToneScore,
    humanRhythmScore: selected.meta.humanRhythmScore,
    sourceStore: sourceStore(item.buyUrl || item.sourceUrl || ''),
    copyRank: selected.rank
  };
}

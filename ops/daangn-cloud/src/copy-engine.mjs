import { assessCopyCandidate } from './quality-engine.mjs';
import { platformProfile } from './platform-profiles.mjs';

const money = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const hash = s => [...String(s || '')].reduce((h, ch) => ((h * 33) ^ ch.charCodeAt(0)) >>> 0, 2166136261);

function clip(s = '', max = 42) {
  const text = clean(s);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.62 ? cut.slice(0, at) : cut).trim();
}

function areaName(region = '') {
  return (clean(region).split(/\s+/).filter(Boolean).at(-1) || '').replace(/(시|군|구)$/, '');
}

function dedupeCandidates(list) {
  const seen = new Set();
  return list.filter(x => {
    const key = [x.postTitle, x.postBody].join('\n');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addLink(lines, url, mode, label) {
  const cleanLines = lines.filter(Boolean);
  if (!url) return cleanLines;
  if (mode === 'middle' && cleanLines.length >= 2) {
    return [cleanLines[0], url, ...cleanLines.slice(1)];
  }
  if (mode === 'labeled-end') return [...cleanLines, `${label || '링크'} ${url}`];
  return [...cleanLines, url];
}

function baselineText(ctx, variant = 0) {
  const base = money(ctx.baselinePrice);
  const current = money(ctx.price);
  const source = ctx.baselineSource || '';
  if (source === '최근 관측가 중앙값') {
    return [
      `최근 관측가 ${base} → 현재 ${current}`,
      `최근 관측했던 ${base}보다 지금은 ${current}입니다.`,
      `최근 관측 ${base}, 현재 ${current}.`
    ][variant % 3];
  }
  if (source === '이전 관측가') {
    return [
      `이전 관측가 ${base} → 현재 ${current}`,
      `앞서 본 가격은 ${base}, 지금은 ${current}입니다.`
    ][variant % 2];
  }
  return [
    `상품 페이지 기준가 ${base} → 현재 ${current}`,
    `상품 페이지 기준 ${base}에서 지금 ${current}.`,
    `기준가 ${base}, 현재 ${current}.`
  ][variant % 3];
}

function hotdealTitleStrategies(ctx) {
  const p = clip(ctx.product, 45);
  const price = money(ctx.price);
  const saving = money(ctx.saving);
  const pct = Math.round(Number(ctx.discountPct || 0));
  const unit = ctx.unitInfo?.count > 1 ? `${ctx.unitInfo.unit}당 ${money(ctx.unitPrice)}` : '';
  const list = [
    ['PRICE', `${p} ${price}`],
    ['PRICE_NOW', `${p} 지금 ${price}`],
    ['SAVING', `${p} ${price}, ${saving} 내려왔네요`],
    ['DISCOUNT', `${p} ${pct}% 할인, ${price}`],
    ['COMPARE', `${p} ${money(ctx.baselinePrice)} → ${price}`]
  ];
  if (unit) {
    list.push(['UNIT', `${p} ${price}, ${unit}`]);
    list.push(['UNIT_PRICE', `${unit}, ${p} ${price}`]);
  }
  if (/무료/.test(ctx.shipping || '')) list.push(['SHIP', `${p} ${price}, 무료배송`]);
  return list;
}

function hotdealBlockVariants(ctx) {
  const price = money(ctx.price);
  const saving = money(ctx.saving);
  const unit = ctx.unitInfo?.count > 1 ? money(ctx.unitPrice) : '';
  const countText = ctx.unitInfo?.count > 1 ? `${ctx.unitInfo.count}${ctx.unitInfo.unit}` : '';
  const shipping = clean(ctx.shipping || '');
  const category = ctx.category || '일반';

  return {
    PRICE: [
      `지금 ${price} 나와요.`,
      `현재 ${price}.`,
      `가격은 ${price}입니다.`,
      `${price}까지 내려왔네요.`,
      `지금 ${price} 나와용.`
    ],
    COMPARE: [
      baselineText(ctx, 0),
      baselineText(ctx, 1),
      baselineText(ctx, 2)
    ],
    SAVING: [
      `차이는 ${saving}.`,
      `${saving} 차이 납니다.`,
      `기준 가격과는 ${saving} 차이.`
    ],
    UNIT: unit ? [
      `${countText} 기준 ${ctx.unitInfo.unit}당 약 ${unit}.`,
      `${ctx.unitInfo.unit}당 계산하면 약 ${unit}입니다.`,
      `${countText} 묶음이라 ${ctx.unitInfo.unit}당 약 ${unit}.`
    ] : [],
    SHIPPING: shipping ? [
      shipping.endsWith('.') ? shipping : shipping + '.',
      /무료/.test(shipping) ? '배송비는 없습니다.' : `배송 ${shipping}.`
    ] : [],
    CONTEXT: category === '생활용품' ? [
      '자주 쓰는 생활용품이면 수량도 같이 보세요.',
      '쟁여두는 품목이면 단가까지 같이 보면 됩니다.'
    ] : category === '식품' ? [
      '쟁여두는 분들은 수량이랑 단가를 같이 보면 됩니다.',
      '먹는 양 정해져 있으면 묶음 수량부터 보세요.'
    ] : [
      '원래 보던 제품이면 가격만 비교해보세요.',
      '살 계획 있던 제품이면 현재 가격만 봐두면 됩니다.'
    ],
    CONDITION: Array.isArray(ctx.conditions) ? ctx.conditions.map(clean).filter(Boolean) : []
  };
}

function hotdealCandidates(ctx, platform) {
  const profile = platformProfile(platform);
  const titles = hotdealTitleStrategies(ctx);
  const b = hotdealBlockVariants(ctx);
  const plans = [
    ['PRICE_FIRST', ['PRICE','SHIPPING']],
    ['PRICE_FIRST', ['PRICE','UNIT','SHIPPING']],
    ['CHANGE_FIRST', ['COMPARE','SHIPPING']],
    ['CHANGE_FIRST', ['COMPARE','SAVING']],
    ['UNIT_FIRST', ['UNIT','PRICE','SHIPPING']],
    ['CONTEXT', ['CONTEXT','PRICE','SHIPPING']],
    ['CONTEXT', ['CONTEXT','COMPARE']],
    ['BARE', ['PRICE']],
    ['BARE', ['COMPARE']],
    ['CONDITION_FIRST', ['CONDITION','PRICE','SHIPPING']],
    ['CHANGE_FIRST', ['SAVING','PRICE','SHIPPING']],
    ['UNIT_FIRST', ['UNIT','COMPARE']],
    ['PRICE_FIRST', ['PRICE','SAVING']],
    ['CONTEXT', ['CONTEXT','UNIT','PRICE']]
  ];
  const candidates = [];
  const linkModes = profile.preferredLinkPositions;

  let serial = 0;
  for (const [styleMode, plan] of plans) {
    if (!profile.allowedStyleModes.includes(styleMode)) continue;
    for (let v = 0; v < 3; v += 1) {
      const rawLines = [];
      const skeleton = [];
      for (const key of plan) {
        const options = b[key] || [];
        if (!options.length) continue;
        rawLines.push(options[(v + serial) % options.length]);
        skeleton.push(key);
      }
      if (!rawLines.length) continue;
      const linkMode = linkModes[(serial + v) % linkModes.length];
      const bodyLines = addLink(rawLines, ctx.buyUrl, linkMode, '상품 링크');
      const title = titles[(serial + v) % titles.length];
      candidates.push({
        styleMode,
        titleStrategy: title[0],
        bodyStrategy: `${styleMode.toLowerCase()}-${v}`,
        skeleton: [...skeleton, 'LINK:' + linkMode].join('>'),
        postTitle: title[1],
        postBody: bodyLines.join('\n')
      });
      serial += 1;
    }
  }
  return dedupeCandidates(candidates);
}

function eventTitleStrategies(ctx) {
  const name = clip(ctx.name, 46);
  const area = areaName(ctx.region);
  const prefix = area && !name.includes(area) ? area + ' ' : '';
  const period = ctx.start && ctx.end ? `${ctx.start}~${ctx.end}` : (ctx.end || '');
  const free = /무료|0원/.test(ctx.cost || '');
  const price = free ? '입장 무료' : ctx.cost;
  return [
    ['NAME_PRICE', `${name}, ${price}`],
    ['AREA_PRICE', `${prefix}${name}, ${price}`],
    ['PERIOD_PRICE', `${name} ${period ? period + ', ' : ''}${price}`],
    ['AREA_NAME', `${prefix}${name} ${price}`],
    ['FAMILY', `아이랑 갈 곳 찾으면 ${prefix}${name}`]
  ];
}

function eventCandidates(ctx, platform) {
  const profile = platformProfile(platform);
  const titles = eventTitleStrategies(ctx);
  const area = areaName(ctx.region);
  const period = ctx.start && ctx.end ? `${ctx.start}~${ctx.end}` : (ctx.end ? `${ctx.end}까지` : '');
  const free = /무료|0원/.test(ctx.cost || '');
  const blocks = {
    PRICE: free ? ['입장료는 무료.', '입장 무료입니다.', '비용은 0원.'] : [`비용은 ${ctx.cost}.`, `현재 ${ctx.cost} 적용됩니다.`],
    PERIOD: period ? [`기간은 ${period}.`, `${period}까지 열립니다.`, `일정은 ${period}.`] : [],
    REGION: area ? [`${area}에서 열려요.`, `장소는 ${area} 쪽입니다.`] : [],
    LOCAL: area ? [`${area} 쪽이면 일정 한번 보세요.`, `${area} 근처에서 갈 곳 찾으면 날짜만 확인하세요.`] : [],
    FAMILY: ['아이랑 갈 곳 찾는 분이면 일정만 확인하세요.', '가족 나들이 찾는 분이면 날짜 한번 보세요.']
  };
  const plans = [
    ['LOCAL_FIRST', ['LOCAL','PERIOD','PRICE']],
    ['BARE', ['PERIOD','PRICE']],
    ['PRICE_FIRST', ['PRICE','PERIOD','REGION']],
    ['LOCAL_FIRST', ['REGION','PRICE','PERIOD']],
    ['CONTEXT', ['FAMILY','PERIOD','PRICE']],
    ['DEADLINE_FIRST', ['PERIOD','REGION','PRICE']],
    ['PRICE_FIRST', ['PRICE','REGION']],
    ['BARE', ['PRICE','PERIOD']]
  ];
  const out = [];
  let serial = 0;
  for (const [styleMode, plan] of plans) {
    if (!profile.allowedStyleModes.includes(styleMode)) continue;
    for (let v = 0; v < 3; v += 1) {
      const body = [];
      const skeleton = [];
      for (const key of plan) {
        const options = blocks[key] || [];
        if (!options.length) continue;
        body.push(options[(serial + v) % options.length]);
        skeleton.push(key);
      }
      const linkMode = profile.preferredLinkPositions[(serial + v) % profile.preferredLinkPositions.length];
      const t = titles[(serial + v) % titles.length];
      out.push({
        styleMode,
        titleStrategy: t[0],
        bodyStrategy: `${styleMode.toLowerCase()}-${v}`,
        skeleton: [...skeleton, 'LINK:' + linkMode].join('>'),
        postTitle: t[1],
        postBody: addLink(body, ctx.url, linkMode, '행사 안내').join('\n')
      });
      serial += 1;
    }
  }
  return dedupeCandidates(out);
}

function policyCompactTitles(ctx) {
  const title = clean(ctx.sourceTitle);
  const facts = (ctx.facts || []).map(clean).filter(Boolean);
  const out = [['SOURCE', title]];
  if (/전기차|충전/.test(title)) out.push(['EV', '전기차 공공충전 할인, 적용 시간 확인']);
  if (/청약/.test(title)) out.push(['HOUSING', '청약통장 전환기한, 날짜 확인']);
  if (/고속도로|주유소/.test(title)) out.push(['TRAVEL', '연휴 고속도로·주유비 혜택 확인']);
  if (/적금|금리|대출|카드/.test(title)) out.push(['FINANCE', title.replace(/\s*[-|｜].*$/, '')]);
  if (facts[0]) out.push(['FACT', clip(facts[0], 54)]);
  return out;
}

function policyContextLine(title = '') {
  if (/전기차|충전/.test(title)) return ['전기차 있으시면 적용 시간부터 보세요.', '충전하실 분은 시간대가 먼저입니다.'];
  if (/청약/.test(title)) return ['청약통장 그대로 두신 분은 기한부터 확인하세요.', '전환 대상이면 마감 날짜가 먼저입니다.'];
  if (/고속도로|주유소/.test(title)) return ['연휴에 차로 이동하면 적용 날짜부터 보세요.', '차로 움직일 분은 날짜만 먼저 확인하세요.'];
  if (/적금|금리|대출|카드/.test(title)) return ['신청 생각 있으면 기간과 조건부터 보세요.', '해당되면 신청 날짜가 먼저입니다.'];
  return ['해당되는 내용이면 날짜와 조건만 보면 됩니다.'];
}

function policyCandidates(ctx, platform) {
  const profile = platformProfile(platform);
  const titles = policyCompactTitles(ctx);
  const facts = (ctx.facts || []).map(clean).filter(Boolean).slice(0, 4);
  const blocks = {
    CONTEXT: policyContextLine(ctx.sourceTitle),
    F1: facts[0] ? [facts[0]] : [],
    F2: facts[1] ? [facts[1]] : [],
    F3: facts[2] ? [facts[2]] : [],
    F4: facts[3] ? [facts[3]] : []
  };
  const plans = [
    ['BARE', ['F1','F2']],
    ['CONTEXT', ['CONTEXT','F1','F2']],
    ['DEADLINE_FIRST', ['F1','F2','F3']],
    ['CHANGE_FIRST', ['F2','F1']],
    ['BARE', ['F1','F2','F3']],
    ['CONTEXT', ['CONTEXT','F1','F3']],
    ['REMINDER', ['CONTEXT','F2','F1']]
  ];
  const out = [];
  let serial = 0;
  for (const [styleMode, plan] of plans) {
    if (!profile.allowedStyleModes.includes(styleMode)) continue;
    for (let v = 0; v < 3; v += 1) {
      const body = [];
      const skeleton = [];
      for (const key of plan) {
        const options = blocks[key] || [];
        if (!options.length) continue;
        body.push(options[(serial + v) % options.length]);
        skeleton.push(key);
      }
      if (body.length < 2) continue;
      const linkMode = profile.preferredLinkPositions[(serial + v) % profile.preferredLinkPositions.length];
      const t = titles[(serial + v) % titles.length];
      out.push({
        styleMode,
        titleStrategy: t[0],
        bodyStrategy: `${styleMode.toLowerCase()}-${v}`,
        skeleton: [...skeleton, 'LINK:' + linkMode].join('>'),
        postTitle: t[1],
        postBody: addLink(body, ctx.url, linkMode, '공식 안내').join('\n')
      });
      serial += 1;
    }
  }
  return dedupeCandidates(out);
}

function renderCandidates(item, platform) {
  const ctx = item?.copyContext || {};
  if (ctx.kind === 'hotdeal') return hotdealCandidates(ctx, platform);
  if (ctx.kind === 'event') return eventCandidates(ctx, platform);
  if (ctx.kind === 'policy') return policyCandidates(ctx, platform);
  return [];
}

export function selectCommunityCopy(item, recentPosts = [], platform = 'daangn') {
  const candidates = renderCandidates(item, platform);
  const assessed = [];

  for (const candidate of candidates) {
    const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
    if (!qa.ok) continue;
    const jitter = hash((item.sourceUrl || item.id || '') + candidate.skeleton + candidate.titleStrategy) % 5;
    assessed.push({
      candidate,
      qa,
      rank: qa.scores.finalScore * 100 + qa.scores.noveltyScore - jitter
    });
  }

  assessed.sort((a, b) => b.rank - a.rank);
  const picked = assessed[0];

  if (!picked) {
    const reasonCounts = {};
    for (const candidate of candidates) {
      const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
      for (const reason of qa.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    return {
      ...item,
      copyRejected: true,
      copyRejectReasons: reasonCounts,
      renderCandidateCount: candidates.length,
      platform
    };
  }

  return {
    ...item,
    ...picked.candidate,
    copyRejected: false,
    copyMeta: picked.qa.meta,
    qualityScores: picked.qa.scores,
    renderCandidateCount: candidates.length,
    platform
  };
}

export function validateGeneratedCopy(item, title, body, recentPosts = [], platform = 'daangn') {
  const candidate = {
    styleMode: item?.copyMeta?.styleMode || '',
    titleStrategy: item?.copyMeta?.titleStrategy || '',
    bodyStrategy: item?.copyMeta?.bodyStrategy || '',
    skeleton: item?.copyMeta?.skeleton || '',
    postTitle: title,
    postBody: body
  };
  return assessCopyCandidate({ item, candidate, recentPosts, platform });
}

import {
  renderCommunityCandidates as renderV4Candidates,
  selectCommunityCopy as selectV4Copy,
  validateGeneratedCopy as validateV4Copy
} from './copy-engine-v4.mjs';
import { fitProductName, separateOfferTerms } from './title-tools.mjs';
import { publicDealBody } from './editorial-language.mjs';
import { assessCopyCandidate, buildCopyMeta } from './quality-engine.mjs';
import { platformProfile } from './platform-profiles.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { trackingCopy } from './price-tracking.mjs';
import {
  explorationBonusForCandidate,
  learningFactorForCandidate
} from './learning-engine.mjs';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const money = value => Number(value || 0).toLocaleString('ko-KR') + '원';
const hash = value => [...String(value || '')].reduce((h, ch) => ((h * 33) ^ ch.charCodeAt(0)) >>> 0, 2166136261);

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    const key = candidate.postTitle + '\n' + candidate.postBody;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function punctuate(value) {
  const text = clean(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : text + '.';
}

function joinFacts(values) {
  return values.map(clean).filter(Boolean).join(' ');
}

function bodyFromGroups(groups, blocks) {
  return groups
    .map(group => joinFacts(group.map(key => blocks[key]).filter(Boolean)))
    .filter(Boolean)
    .join('\n\n');
}

function section(label, values, { bullets = false } = {}) {
  const cleaned = values.map(clean).filter(Boolean);
  if (!cleaned.length) return '';
  if (bullets) return [label, ...cleaned.map(value => `- ${value}`)].filter(Boolean).join('\n');
  return [label, joinFacts(cleaned)].filter(Boolean).join('\n');
}

function compactSections(sections) {
  return sections.map(value => String(value || '').trim()).filter(Boolean).join('\n\n');
}

function recentPromptCount(recentPosts, profile) {
  return recentPosts.slice(-profile.recentCtaWindow).filter(post => {
    const meta = buildCopyMeta(post.title || post.postTitle || '', post.bodyText || post.postBody || '');
    return Math.max(post.copyMeta?.ctaCount || 0, meta.ctaCount) > 0;
  }).length;
}

function shoppingConversation(product = '') {
  if (/물티슈/.test(product)) return {
    hook: '물티슈 떨어져 가는 집',
    question: '물티슈는 몇 팩쯤 남았을 때 다시 주문하세요?'
  };
  if (/기저귀/.test(product)) return {
    hook: '기저귀 주문할 때라면',
    question: '기저귀는 한꺼번에 쟁이는 편인가요, 조금씩 주문하는 편인가요?'
  };
  if (/식기세척기.*세제|식세기.*세제/.test(product)) return {
    hook: '식세기 세제 떨어져 간다면',
    question: '식세기 세제는 한 번에 얼마나 주문하시나요?'
  };
  if (/세탁.*세제|세탁세제/.test(product)) return {
    hook: '세탁세제 살 때라면',
    question: '세탁세제는 보관할 자리 때문에 소량으로 사는 분도 계신가요?'
  };
  if (/화장지|휴지|키친타월/.test(product)) return {
    hook: '휴지류 채울 때라면',
    question: ''
  };
  if (/두유|생수|우유|라면|햇반/.test(product)) return {
    hook: '묶음으로 쟁여두는 품목이라면',
    question: ''
  };
  return { hook: '', question: '' };
}

function utilityConversation(ctx = {}) {
  const text = [ctx.category, ctx.sourceTitle, ctx.readerNeed].map(clean).join(' ');
  if (/도서관|도서/.test(text)) return '동네에서 자주 이용하는 도서관 서비스가 있나요?';
  if (/교통|고속도로|통행료|주차/.test(text)) return '비슷한 상황에서 가장 헷갈렸던 조건이 있었나요?';
  if (/환급|요금|통신|전기|가스|보험/.test(text)) return '신청이나 환급 과정에서 막혔던 단계가 있었나요?';
  if (/육아|아이|자녀|어르신|시니어/.test(text)) return '주변에 함께 알려주고 싶은 대상이 있나요?';
  if (/시장|상품권|소비|혜택/.test(text)) return '실제로 가장 자주 쓰는 사용처는 어디인가요?';
  if (/공공시설|서비스|지원/.test(text)) return '이런 생활정보는 보통 어디에서 확인하시나요?';
  return '';
}

function shoppingTitleCandidates(ctx, facts, platform) {
  const profile = platformProfile(platform);
  const price = money(ctx.price);
  const couponPrice = ctx.coupon ? '쿠폰가 ' + price : price;
  const conversation = shoppingConversation(ctx.product);
  const history = trackingCopy(ctx.tracking);
  const entries = [];

  const add = (styleMode, strategy, prefix, tail, separator = ' · ') => {
    const reserve = clean(prefix).length + clean(tail).length + (prefix ? separator.length : 0) + (tail ? separator.length : 0);
    const name = fitProductName(ctx.product, Math.max(8, profile.titleMax - reserve));
    if (!name) return;
    const title = [clean(prefix), name, clean(tail)].filter(Boolean).join(separator);
    if (title.length <= profile.titleMax && title.includes(price)) {
      entries.push({ styleMode, strategy, title });
    }
  };

  add('PRICE_FIRST', 'SHOPPING_PRICE', '', couponPrice);
  add('PRICE_FIRST', 'SHOPPING_PRICE_FRONT', couponPrice, '', ', ');
  if (facts.unitPriceText) add('UNIT_FIRST', 'SHOPPING_UNIT_PRICE', '', `${couponPrice} · ${facts.unitPriceText}`);
  if (facts.discountPctFloor > 0) add('CHANGE_FIRST', 'SHOPPING_DISCOUNT', `${facts.discountPctFloor}% 할인`, couponPrice);
  if (facts.hasComparison) add('CHANGE_FIRST', 'SHOPPING_SAVING', `${money(facts.saving)} 차이`, couponPrice);
  if (ctx.shipping && /무료/.test(ctx.shipping)) add('CONDITION_FIRST', 'SHOPPING_FREE_SHIPPING', '', `${couponPrice} · 무료배송`);
  if (ctx.priceUpdate?.hook) add('CHANGE_FIRST', 'SHOPPING_PRICE_DROP', ctx.priceUpdate.hook, couponPrice);
  if (history?.hook) add('CHANGE_FIRST', 'SHOPPING_PRICE_HISTORY', history.hook, couponPrice);
  if (conversation.hook && ['daangn', 'naver_cafe'].includes(platform)) {
    add('CONTEXT', 'SHOPPING_READER_PRICE', conversation.hook, couponPrice, ', ');
  }

  return entries;
}

function diverseShoppingCandidates(ctx, platform, recentPosts = []) {
  const facts = dealPriceFacts(ctx);
  const offerTerms = separateOfferTerms(ctx.product);
  const conditions = [...new Set([
    ...(ctx.requiredConditions || ctx.conditions || []),
    ...offerTerms.conditions
  ])].map(punctuate).filter(Boolean);
  const history = ctx.priceUpdate?.line || trackingCopy(ctx.tracking)?.line || '';
  const conversation = shoppingConversation(ctx.product);
  const profile = platformProfile(platform);
  const question = ['daangn', 'naver_cafe'].includes(platform) &&
    hash(ctx.product) % 7 === 0 &&
    recentPromptCount(recentPosts, profile) < profile.maxCtaPostsInWindow
    ? conversation.question
    : '';

  const blocks = {
    PRICE: [`${offerTerms.base}, ${facts.priceLine}`, facts.unitLine].filter(Boolean).join(' '),
    UNIT: facts.unitLine,
    COMPARE: facts.comparisonLine,
    DISCOUNT: facts.discountLine,
    SHIPPING: ctx.shipping ? `배송은 ${ctx.shipping}입니다.` : '',
    DELIVERY: facts.deliveryLine,
    TERMS: conditions.join(' '),
    HISTORY: history,
    FIT: facts.purchaseFit,
    QUESTION: question,
    LINK: ctx.buyUrl
  };

  const grouped = (groups, formatFamily = 'PARAGRAPH') => ({
    formatFamily,
    render: () => bodyFromGroups(groups, blocks)
  });
  const layouts = [
    { id: 'SHOPPING_PRICE_COMPARE_FIT', styleMode: 'PRICE_FIRST', ...grouped([['PRICE'], ['COMPARE', 'DISCOUNT', 'SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['FIT'], ['QUESTION'], ['LINK']], 'PARAGRAPH') },
    { id: 'SHOPPING_FIT_PRICE_COMPARE', styleMode: 'CONTEXT', ...grouped([['FIT'], ['PRICE'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['COMPARE', 'DISCOUNT'], ['HISTORY'], ['LINK']], 'CONTEXT') },
    { id: 'SHOPPING_COMPARE_PRICE_TERMS', styleMode: 'CHANGE_FIRST', ...grouped([['COMPARE', 'DISCOUNT'], ['PRICE'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['FIT'], ['LINK']], 'CHANGE') },
    { id: 'SHOPPING_TERMS_PRICE_COMPARE', styleMode: 'CONDITION_FIRST', ...grouped([['SHIPPING', 'DELIVERY', 'TERMS'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['FIT'], ['HISTORY'], ['LINK']], 'CONDITION') },
    { id: 'SHOPPING_UNIT_FIT_TOTAL', styleMode: 'UNIT_FIRST', ...grouped([['UNIT'], ['FIT'], ['PRICE', 'COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['LINK']], 'UNIT') },
    { id: 'SHOPPING_HISTORY_TOTAL_TERMS', styleMode: 'CHANGE_FIRST', ...grouped([['HISTORY'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['FIT'], ['LINK']], 'HISTORY') },
    { id: 'SHOPPING_DELIVERY_TOTAL_FIT', styleMode: 'CONDITION_FIRST', ...grouped([['DELIVERY', 'SHIPPING'], ['PRICE'], ['COMPARE', 'DISCOUNT', 'TERMS'], ['FIT'], ['HISTORY'], ['LINK']], 'CONDITION') },
    { id: 'SHOPPING_COMPACT_FACT_LINES', styleMode: 'BARE', ...grouped([['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['FIT'], ['HISTORY'], ['LINK']], 'SPLIT') },
    { id: 'SHOPPING_LINK_AFTER_TOTAL', styleMode: 'PRICE_FIRST', ...grouped([['PRICE'], ['LINK'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['FIT'], ['HISTORY']], 'SOURCE_MIDDLE') },
    { id: 'SHOPPING_FIT_LINK_FACTS', styleMode: 'CONTEXT', ...grouped([['FIT'], ['LINK'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY']], 'SOURCE_MIDDLE') },
    {
      id: 'SHOPPING_PRICE_CARD',
      styleMode: 'PRICE_FIRST',
      formatFamily: 'CARD',
      render: () => compactSections([
        section('가격', [blocks.PRICE]),
        section('비교 기준', [blocks.COMPARE, blocks.DISCOUNT]),
        section('배송·구매 조건', [blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS]),
        blocks.HISTORY,
        blocks.FIT,
        blocks.QUESTION,
        blocks.LINK
      ])
    },
    {
      id: 'SHOPPING_CHECKLIST',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'CHECKLIST',
      render: () => compactSections([
        section('구매 전 확인', [blocks.PRICE, blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS], { bullets: true }),
        section('비교 정보', [blocks.COMPARE, blocks.DISCOUNT]),
        blocks.HISTORY,
        blocks.FIT,
        blocks.QUESTION,
        blocks.LINK
      ])
    },
    {
      id: 'SHOPPING_QNA',
      styleMode: 'CONTEXT',
      formatFamily: 'QNA',
      render: () => compactSections([
        section('얼마인가요?', [blocks.PRICE]),
        section('배송과 조건은?', [blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS]),
        section('비교 기준은?', [blocks.COMPARE, blocks.DISCOUNT]),
        blocks.HISTORY,
        blocks.FIT,
        blocks.QUESTION,
        blocks.LINK
      ])
    },
    {
      id: 'SHOPPING_UNIT_CARD',
      styleMode: 'UNIT_FIRST',
      formatFamily: 'CARD',
      render: () => compactSections([
        section('단위 가격', [blocks.UNIT]),
        section('총액', [blocks.PRICE]),
        section('배송·조건', [blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS]),
        section('가격 비교', [blocks.COMPARE, blocks.DISCOUNT]),
        blocks.HISTORY,
        blocks.FIT,
        blocks.LINK
      ])
    },
    {
      id: 'SHOPPING_CONDITION_NOTE',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'NOTE',
      render: () => compactSections([
        section('먼저 볼 조건', [blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS], { bullets: true }),
        blocks.PRICE,
        joinFacts([blocks.COMPARE, blocks.DISCOUNT]),
        blocks.HISTORY,
        blocks.FIT,
        blocks.QUESTION,
        blocks.LINK
      ])
    },
    {
      id: 'SHOPPING_FACT_SHEET',
      styleMode: 'BARE',
      formatFamily: 'FACT_SHEET',
      render: () => compactSections([
        section('상품 정보', [blocks.PRICE, blocks.UNIT], { bullets: true }),
        section('가격 근거', [blocks.COMPARE, blocks.DISCOUNT], { bullets: true }),
        section('배송·제한', [blocks.SHIPPING, blocks.DELIVERY, blocks.TERMS], { bullets: true }),
        blocks.HISTORY,
        blocks.FIT,
        blocks.LINK
      ])
    }
  ];

  const titles = shoppingTitleCandidates(ctx, facts, platform);
  const candidates = [];
  for (const title of titles) {
    for (const layout of layouts) {
      if (!profile.allowedStyleModes.includes(layout.styleMode)) continue;
      const postBody = publicDealBody(layout.render());
      candidates.push({
        styleMode: layout.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: 'shopping-' + layout.id.toLowerCase(),
        skeleton: 'shopping:' + layout.id,
        layoutFamily: layout.id,
        formatFamily: layout.formatFamily,
        postTitle: title.title,
        postBody
      });
    }
  }
  return dedupeCandidates(candidates);
}

function utilityTitleCandidates(ctx, platform) {
  const max = platformProfile(platform).titleMax;
  const source = clean(ctx.sourceTitle).slice(0, max);
  const titles = [{ strategy: 'UTILITY_SOURCE', title: source }];
  const category = clean(ctx.category);
  if (category && !source.includes(category)) {
    const combined = `${category} · ${source}`;
    if (combined.length <= max) titles.push({ strategy: 'UTILITY_CATEGORY', title: combined });
  }
  const need = clean(ctx.readerNeed).replace(/[.?!]+$/g, '');
  if (need.length >= 8 && need.length <= max && need !== source) {
    titles.push({ strategy: 'UTILITY_READER_NEED', title: need });
  }
  const suffix = ctx.kind === 'service' ? ' 이용 조건' : ctx.kind === 'benefit' ? ' 대상·조건' : ' 적용 기준';
  if (source && source.length + suffix.length <= max) {
    titles.push({ strategy: 'UTILITY_CONDITION_PROMISE', title: source + suffix });
  }
  return dedupeCandidates(titles.map(entry => ({ postTitle: entry.title, postBody: '', ...entry })))
    .map(entry => ({ strategy: entry.strategy, title: entry.title }));
}

function diverseUtilityCandidates(ctx, platform, recentPosts = []) {
  const facts = [...(ctx.facts || [])].map(clean).filter(Boolean);
  const conditions = [...(ctx.requiredConditions || ctx.conditions || [])].map(clean).filter(Boolean);
  const links = [...new Set(ctx.sourceUrls || [ctx.url])].filter(Boolean);
  const titles = utilityTitleCandidates(ctx, platform);
  const profile = platformProfile(platform);
  const question = ['daangn', 'naver_cafe'].includes(platform) &&
    hash(ctx.sourceTitle || ctx.url) % 4 === 0 &&
    recentPromptCount(recentPosts, profile) < profile.maxCtaPostsInWindow
    ? utilityConversation(ctx)
    : '';
  const link = links[0] || '';
  const labeledLink = link ? `공식 안내 ${link}` : '';
  const f1 = facts.slice(0, 1);
  const f2 = facts.slice(1, 2);
  const fRest = facts.slice(2);
  const firstConditions = conditions.slice(0, 1);
  const restConditions = conditions.slice(1);

  const layouts = [
    {
      id: 'UTILITY_ANSWER_THEN_DETAILS',
      styleMode: 'BARE',
      formatFamily: 'ANSWER',
      render: () => compactSections([joinFacts(f1), joinFacts([...f2, ...fRest]), joinFacts(conditions), link])
    },
    {
      id: 'UTILITY_CONDITION_GATE',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'CONDITION',
      render: () => compactSections([section('해당 조건', conditions, { bullets: true }), section('내용', facts), labeledLink])
    },
    {
      id: 'UTILITY_INFO_CARD',
      styleMode: 'CONTEXT',
      formatFamily: 'CARD',
      render: () => compactSections([
        section('알아둘 내용', [...f1, ...f2]),
        section('대상·제한', conditions),
        section('추가 내용', fRest),
        labeledLink
      ])
    },
    {
      id: 'UTILITY_QNA',
      styleMode: 'CONTEXT',
      formatFamily: 'QNA',
      render: () => compactSections([
        section('무슨 내용인가요?', [...f1, ...f2]),
        section('누가 해당되나요?', conditions),
        section('더 알아둘 점은?', fRest),
        labeledLink
      ])
    },
    {
      id: 'UTILITY_CHECKLIST',
      styleMode: 'BARE',
      formatFamily: 'CHECKLIST',
      render: () => compactSections([
        section('한눈에 보기', facts, { bullets: true }),
        section('제외·제한', conditions),
        link
      ])
    },
    {
      id: 'UTILITY_EACH_FACT_LINE',
      styleMode: 'BARE',
      formatFamily: 'SPLIT',
      render: () => compactSections([...facts, joinFacts(conditions), link])
    },
    {
      id: 'UTILITY_SOURCE_MIDDLE',
      styleMode: 'BARE',
      formatFamily: 'SOURCE_MIDDLE',
      render: () => compactSections([joinFacts([...f1, ...f2]), labeledLink, joinFacts(fRest), joinFacts(conditions)])
    },
    {
      id: 'UTILITY_LIMIT_BETWEEN_FACTS',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'SANDWICH',
      render: () => compactSections([joinFacts(f1), joinFacts(conditions), joinFacts([...f2, ...fRest]), labeledLink])
    },
    {
      id: 'UTILITY_TWO_BLOCK',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'TWO_BLOCK',
      render: () => compactSections([section('내용 정리', facts), section('적용 조건', conditions), labeledLink])
    },
    {
      id: 'UTILITY_FACT_BULLETS',
      styleMode: 'BARE',
      formatFamily: 'BULLETS',
      render: () => compactSections([
        section('확인할 내용', facts, { bullets: true }),
        section('조건', conditions, { bullets: true }),
        link
      ])
    },
    {
      id: 'UTILITY_CONDITION_WRAP',
      styleMode: 'CONDITION_FIRST',
      formatFamily: 'WRAP',
      render: () => compactSections([joinFacts(firstConditions), joinFacts(facts), joinFacts(restConditions), labeledLink])
    },
    {
      id: 'UTILITY_SOURCE_FIRST',
      styleMode: 'BARE',
      formatFamily: 'SOURCE_FIRST',
      render: () => compactSections([labeledLink, joinFacts([...f1, ...f2]), joinFacts(fRest), joinFacts(conditions)])
    },
    {
      id: 'UTILITY_DISCUSSION',
      styleMode: 'CONTEXT',
      formatFamily: 'DISCUSSION',
      render: () => compactSections([joinFacts(facts), joinFacts(conditions), labeledLink, question])
    }
  ].filter(layout => layout.id !== 'UTILITY_DISCUSSION' || question);

  const candidates = [];
  for (const title of titles) {
    for (const layout of layouts) {
      if (!profile.allowedStyleModes.includes(layout.styleMode)) continue;
      const postBody = layout.render();
      candidates.push({
        styleMode: layout.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: 'utility-' + layout.id.toLowerCase(),
        skeleton: `${ctx.kind}:${layout.id}`,
        layoutFamily: layout.id,
        formatFamily: layout.formatFamily,
        postTitle: title.title,
        postBody
      });
    }
  }
  return dedupeCandidates(candidates);
}

function usesV5Renderer(item) {
  const kind = item?.copyContext?.kind;
  return (kind === 'hotdeal' && item?.copyContext?.currentOffer) ||
    ['benefit', 'service', 'researched', 'comparison', 'digest', 'question'].includes(kind);
}

export function renderCommunityCandidates(item, platform = 'daangn', recentPosts = []) {
  const ctx = item?.copyContext || {};
  if (ctx.kind === 'hotdeal' && ctx.currentOffer) {
    return diverseShoppingCandidates(ctx, platform, recentPosts);
  }
  if (['benefit', 'service', 'researched', 'comparison', 'digest', 'question'].includes(ctx.kind)) {
    return diverseUtilityCandidates(ctx, platform, recentPosts);
  }
  return renderV4Candidates(item, platform, recentPosts);
}

function recentStructure(recentPosts, limit = 12) {
  return recentPosts.slice(-limit).map(post => ({
    layoutFamily: post.copyMeta?.layoutFamily || post.layoutFamily || post.bodyStrategy || post.bodyPattern || '',
    formatFamily: post.copyMeta?.formatFamily || post.formatFamily || ''
  }));
}

function structurePenalty(candidate, recentPosts, kind) {
  const history = recentStructure(recentPosts, kind === 'hotdeal' ? 8 : 12);
  const last = history.at(-1) || {};
  const layoutUses = history.filter(value => value.layoutFamily === candidate.layoutFamily).length;
  const formatUses = history.filter(value => value.formatFamily && value.formatFamily === candidate.formatFamily).length;
  let penalty = layoutUses * 180 + formatUses * 35;
  if (last.layoutFamily && last.layoutFamily === candidate.layoutFamily) penalty += 900;
  if (last.formatFamily && last.formatFamily === candidate.formatFamily) penalty += 250;
  return penalty;
}

function selectFromCandidates(item, recentPosts, platform, learningWeights) {
  if (item.priceUpdate && item.copyContext?.priceUpdate) {
    recentPosts = recentPosts.filter(post => post.sourceUrl !== item.sourceUrl);
  }
  const candidates = renderCommunityCandidates(item, platform, recentPosts);
  const assessed = [];

  for (const candidate of candidates) {
    const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
    const growthFailures = growthCopyFailures(item, candidate);
    if (!qa.ok || growthFailures.length) continue;
    const jitter = hash((item.sourceUrl || item.id || '') + candidate.skeleton + candidate.titleStrategy) % 5;
    const learningFactor = learningFactorForCandidate(item, candidate, qa.meta, learningWeights);
    const explorationBonus = explorationBonusForCandidate(item, candidate, qa.meta, learningWeights);
    const structuralPenalty = structurePenalty(candidate, recentPosts, item?.copyContext?.kind);
    const baseRank = qa.scores.finalScore * 100 + qa.scores.noveltyScore - jitter - structuralPenalty;
    assessed.push({
      candidate,
      qa,
      learningFactor,
      explorationBonus,
      structuralPenalty,
      rank: baseRank * learningFactor + baseRank * explorationBonus
    });
  }

  const priority = candidate => {
    if (['SHOPPING_PRICE_DROP', 'SHOPPING_PRICE_HISTORY'].includes(candidate.titleStrategy)) return 3;
    if (candidate.formatFamily === 'DISCUSSION') return 2;
    if (candidate.styleMode === 'CONDITION_FIRST') return 1;
    return 0;
  };

  assessed.sort((a, b) =>
    b.rank - a.rank ||
    b.qa.scores.finalScore - a.qa.scores.finalScore ||
    priority(b.candidate) - priority(a.candidate)
  );
  const picked = assessed[0];

  if (!picked) {
    const reasonCounts = {};
    for (const candidate of candidates) {
      const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
      for (const reason of [...qa.reasons, ...growthCopyFailures(item, candidate)]) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
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
    copyMeta: {
      ...picked.qa.meta,
      layoutFamily: picked.candidate.layoutFamily || picked.candidate.bodyStrategy,
      formatFamily: picked.candidate.formatFamily || 'PARAGRAPH',
      structuralPenalty: picked.structuralPenalty
    },
    qualityScores: picked.qa.scores,
    learningMeta: {
      factor: Number(picked.learningFactor.toFixed(4)),
      explorationBonus: Number(picked.explorationBonus.toFixed(4))
    },
    renderCandidateCount: candidates.length,
    platform
  };
}

export function selectCommunityCopy(item, recentPosts = [], platform = 'daangn', learningWeights = {}) {
  if (!usesV5Renderer(item)) return selectV4Copy(item, recentPosts, platform, learningWeights);
  return selectFromCandidates(item, recentPosts, platform, learningWeights);
}

export function validateGeneratedCopy(item, title, body, recentPosts = [], platform = 'daangn') {
  return validateV4Copy(item, title, body, recentPosts, platform);
}

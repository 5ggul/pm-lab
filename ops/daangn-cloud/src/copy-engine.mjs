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
  const recentQuestions = recentPosts.slice(-profile.recentCtaWindow).filter(post => {
    const meta = buildCopyMeta(post.title || post.postTitle || '', post.bodyText || post.postBody || '');
    return Math.max(post.copyMeta?.ctaCount || 0, meta.ctaCount) > 0;
  }).length;
  const question = ['daangn', 'naver_cafe'].includes(platform) &&
    hash(ctx.product) % 7 === 0 &&
    recentQuestions < profile.maxCtaPostsInWindow
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

  const layouts = [
    {
      id: 'PRICE_COMPARE_FIT',
      styleMode: 'PRICE_FIRST',
      groups: [['PRICE'], ['COMPARE', 'DISCOUNT', 'SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['FIT'], ['QUESTION'], ['LINK']]
    },
    {
      id: 'FIT_PRICE_COMPARE',
      styleMode: 'CONTEXT',
      groups: [['FIT'], ['PRICE'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['COMPARE', 'DISCOUNT'], ['HISTORY'], ['LINK']]
    },
    {
      id: 'COMPARE_PRICE_TERMS',
      styleMode: 'CHANGE_FIRST',
      groups: [['COMPARE', 'DISCOUNT'], ['PRICE'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['FIT'], ['LINK']]
    },
    {
      id: 'TERMS_PRICE_COMPARE',
      styleMode: 'CONDITION_FIRST',
      groups: [['SHIPPING', 'DELIVERY', 'TERMS'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['FIT'], ['HISTORY'], ['LINK']]
    },
    {
      id: 'UNIT_FIT_TOTAL',
      styleMode: 'UNIT_FIRST',
      groups: [['UNIT'], ['FIT'], ['PRICE', 'COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY'], ['LINK']]
    },
    {
      id: 'HISTORY_TOTAL_TERMS',
      styleMode: 'CHANGE_FIRST',
      groups: [['HISTORY'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['FIT'], ['LINK']]
    },
    {
      id: 'DELIVERY_TOTAL_FIT',
      styleMode: 'CONDITION_FIRST',
      groups: [['DELIVERY', 'SHIPPING'], ['PRICE'], ['COMPARE', 'DISCOUNT', 'TERMS'], ['FIT'], ['HISTORY'], ['LINK']]
    },
    {
      id: 'COMPACT_FACT_LINES',
      styleMode: 'BARE',
      groups: [['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['FIT'], ['HISTORY'], ['LINK']]
    },
    {
      id: 'LINK_AFTER_TOTAL',
      styleMode: 'PRICE_FIRST',
      groups: [['PRICE'], ['LINK'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['FIT'], ['HISTORY']]
    },
    {
      id: 'FIT_LINK_FACTS',
      styleMode: 'CONTEXT',
      groups: [['FIT'], ['LINK'], ['PRICE'], ['COMPARE', 'DISCOUNT'], ['SHIPPING', 'DELIVERY', 'TERMS'], ['HISTORY']]
    }
  ];

  const titles = shoppingTitleCandidates(ctx, facts, platform);
  const candidates = [];
  for (const title of titles) {
    for (const layout of layouts) {
      if (!profile.allowedStyleModes.includes(layout.styleMode)) continue;
      const postBody = publicDealBody(bodyFromGroups(layout.groups, blocks));
      candidates.push({
        styleMode: layout.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: 'shopping-' + layout.id.toLowerCase(),
        skeleton: 'shopping:' + layout.id,
        layoutFamily: layout.id,
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
  return titles;
}

function diverseUtilityCandidates(ctx, platform) {
  const facts = [...(ctx.facts || [])].map(clean).filter(Boolean);
  const conditions = [...(ctx.requiredConditions || ctx.conditions || [])].map(clean).filter(Boolean);
  const links = [...new Set(ctx.sourceUrls || [ctx.url])].filter(Boolean);
  const titles = utilityTitleCandidates(ctx, platform);
  const blocks = {
    F1: facts[0],
    F2: facts[1],
    F3: facts[2],
    F4: facts[3],
    C1: conditions[0],
    C2: conditions[1],
    C3: conditions[2],
    LINK: links[0],
    LINK_LABEL: links[0] ? `공식 안내 ${links[0]}` : '',
    LINKS: links.join('\n')
  };
  const factKeys = ['F1', 'F2', 'F3', 'F4'].filter(key => blocks[key]);
  const conditionKeys = ['C1', 'C2', 'C3'].filter(key => blocks[key]);
  const layouts = [
    { id: 'FACTS_CONDITIONS', styleMode: 'BARE', groups: [factKeys, conditionKeys, ['LINK']] },
    { id: 'CONDITION_FACTS', styleMode: 'CONDITION_FIRST', groups: [conditionKeys, factKeys, ['LINK_LABEL']] },
    { id: 'FACT_PAIR_SPLIT', styleMode: 'BARE', groups: [factKeys.slice(0, 2), conditionKeys.slice(0, 1), factKeys.slice(2), conditionKeys.slice(1), ['LINK']] },
    { id: 'FACT_LINK_CONDITION', styleMode: 'BARE', groups: [factKeys.slice(0, 1), ['LINK_LABEL'], factKeys.slice(1), conditionKeys] },
    { id: 'CONDITION_WRAP', styleMode: 'CONDITION_FIRST', groups: [conditionKeys.slice(0, 1), factKeys, conditionKeys.slice(1), ['LINK']] },
    { id: 'SHORT_GUIDE', styleMode: 'CONTEXT', groups: [factKeys, conditionKeys, ['LINK_LABEL']] },
    { id: 'DETAIL_THEN_LIMIT', styleMode: 'DETAIL_THEN_CONDITION', groups: [factKeys.slice(0, 2), factKeys.slice(2), conditionKeys, ['LINK']] },
    { id: 'SOURCE_MIDDLE', styleMode: 'BARE', groups: [factKeys.slice(0, 2), ['LINK'], factKeys.slice(2), conditionKeys] },
    { id: 'LIMIT_BETWEEN_FACTS', styleMode: 'CONDITION_FIRST', groups: [factKeys.slice(0, 1), conditionKeys, factKeys.slice(1), ['LINK_LABEL']] },
    { id: 'EACH_FACT_LINE', styleMode: 'BARE', groups: [...factKeys.map(key => [key]), conditionKeys, ['LINK']] }
  ];

  const profile = platformProfile(platform);
  const candidates = [];
  for (const title of titles) {
    for (const layout of layouts) {
      if (!profile.allowedStyleModes.includes(layout.styleMode)) continue;
      const groups = layout.groups.filter(group => group.some(key => blocks[key]));
      const postBody = bodyFromGroups(groups, blocks);
      candidates.push({
        styleMode: layout.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: 'utility-' + layout.id.toLowerCase(),
        skeleton: `${ctx.kind}:${layout.id}`,
        layoutFamily: layout.id,
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
    ['service', 'researched', 'comparison', 'digest', 'question'].includes(kind);
}

export function renderCommunityCandidates(item, platform = 'daangn', recentPosts = []) {
  const ctx = item?.copyContext || {};
  if (ctx.kind === 'hotdeal' && ctx.currentOffer) {
    return diverseShoppingCandidates(ctx, platform, recentPosts);
  }
  if (['service', 'researched', 'comparison', 'digest', 'question'].includes(ctx.kind)) {
    return diverseUtilityCandidates(ctx, platform);
  }
  return renderV4Candidates(item, platform, recentPosts);
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
    const baseRank = qa.scores.finalScore * 100 + qa.scores.noveltyScore - jitter;
    assessed.push({
      candidate,
      qa,
      learningFactor,
      explorationBonus,
      rank: baseRank * learningFactor + baseRank * explorationBonus
    });
  }

  const priority = candidate => {
    if (['SHOPPING_PRICE_DROP', 'SHOPPING_PRICE_HISTORY'].includes(candidate.titleStrategy)) return 3;
    if (candidate.styleMode === 'CONDITION_FIRST') return 2;
    if (candidate.titleStrategy === 'SHOPPING_READER_PRICE') return 1;
    return 0;
  };

  assessed.sort((a, b) =>
    b.qa.scores.finalScore - a.qa.scores.finalScore ||
    priority(b.candidate) - priority(a.candidate) ||
    b.rank - a.rank
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
      layoutFamily: picked.candidate.layoutFamily || picked.candidate.bodyStrategy
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

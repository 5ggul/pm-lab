import {
  renderCommunityCandidates as renderV4Candidates,
  selectCommunityCopy as selectV4Copy,
  validateGeneratedCopy as validateV4Copy
} from './copy-engine-v4.mjs';
import { fitProductName, separateOfferTerms } from './title-tools.mjs';
import { publicDealBody } from './editorial-language.mjs';
import { assessCopyCandidate, buildCopyMeta, copyHistoryForItem } from './quality-engine.mjs';
import { platformProfile } from './platform-profiles.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { trackingCopy } from './price-tracking.mjs';
import { renderShoppingSurfaceCandidates, renderUtilitySurfaceCandidates } from './editorial-diversity.mjs';
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
  ])].map(clean).filter(Boolean);
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

  return renderShoppingSurfaceCandidates({
    ctx,
    facts,
    offerTerms,
    conditions,
    history,
    question,
    titles: shoppingTitleCandidates(ctx, facts, platform),
    allowedStyleModes: profile.allowedStyleModes,
    bodyPostprocess: publicDealBody
  });
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
  const profile = platformProfile(platform);
  return renderUtilitySurfaceCandidates({
    ctx,
    titles: utilityTitleCandidates(ctx, platform),
    allowedStyleModes: profile.allowedStyleModes
  });
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
  recentPosts = copyHistoryForItem(item, recentPosts);
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

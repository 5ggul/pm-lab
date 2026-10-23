import {
  renderCommunityCandidates as renderV5Candidates,
  selectCommunityCopy as selectV5Copy,
  validateGeneratedCopy as validateV5Copy
} from './copy-engine.mjs';
import { fitProductName, separateOfferTerms } from './title-tools.mjs';
import { publicDealBody } from './editorial-language.mjs';
import { assessCopyCandidate, buildCopyMeta } from './quality-engine.mjs';
import { platformProfile } from './platform-profiles.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { trackingCopy } from './price-tracking.mjs';
import {
  renderShoppingSurfaceCandidates,
  renderUtilitySurfaceCandidates
} from './editorial-diversity.mjs';
import {
  explorationBonusForCandidate,
  learningFactorForCandidate
} from './learning-engine.mjs';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const money = value => Number(value || 0).toLocaleString('ko-KR') + '원';
const hash = value => [...String(value || '')]
  .reduce((current, character) => ((current * 33) ^ character.charCodeAt(0)) >>> 0, 2166136261);

function shoppingConversation(product = '') {
  if (/물티슈/.test(product)) return {
    hook: '물티슈 채울 때',
    question: '물티슈는 몇 팩쯤 남았을 때 다시 주문하세요?'
  };
  if (/기저귀/.test(product)) return {
    hook: '기저귀 주문할 때',
    question: '기저귀는 한꺼번에 쟁이는 편인가요, 조금씩 주문하는 편인가요?'
  };
  if (/식기세척기.*세제|식세기.*세제/.test(product)) return {
    hook: '식세기 세제 채울 때',
    question: '식세기 세제는 한 번에 얼마나 주문하시나요?'
  };
  if (/세탁.*세제|세탁세제/.test(product)) return {
    hook: '세탁세제 살 때',
    question: '세탁세제는 보관할 자리 때문에 소량으로 사는 분도 계신가요?'
  };
  if (/화장지|휴지|키친타월/.test(product)) return { hook: '휴지류 채울 때', question: '' };
  if (/두유|생수|우유|라면|햇반/.test(product)) return { hook: '묶음으로 채울 때', question: '' };
  return { hook: '', question: '' };
}

function shoppingTitleCandidates(ctx, facts, platform) {
  const profile = platformProfile(platform);
  const price = money(ctx.price);
  const couponPrice = ctx.coupon ? `쿠폰가 ${price}` : price;
  const conversation = shoppingConversation(ctx.product);
  const history = trackingCopy(ctx.tracking);
  const entries = [];
  const seen = new Set();

  const add = (styleMode, strategy, prefix, tail, separator = ' · ') => {
    const fixed = [clean(prefix), clean(tail)].filter(Boolean);
    const reserve = fixed.reduce((sum, value) => sum + value.length, 0) +
      Math.max(0, fixed.length) * separator.length;
    const name = fitProductName(ctx.product, Math.max(8, profile.titleMax - reserve));
    if (!name) return;
    const title = [clean(prefix), name, clean(tail)].filter(Boolean).join(separator);
    const key = `${strategy}\n${title}`;
    if (title.length <= profile.titleMax && title.includes(price) && !seen.has(key)) {
      seen.add(key);
      entries.push({ styleMode, strategy, title });
    }
  };

  add('PRICE_FIRST', 'SHOPPING_PRICE', '', couponPrice);
  add('PRICE_FIRST', 'SHOPPING_PRICE_FRONT', couponPrice, '', ', ');
  if (facts.unitPriceText) {
    add('UNIT_FIRST', 'SHOPPING_UNIT_PRICE', '', `${couponPrice} · ${facts.unitPriceText}`);
    add('UNIT_FIRST', 'SHOPPING_UNIT_FRONT', facts.unitPriceText, couponPrice, ', ');
  }
  if (facts.discountPctFloor > 0) add('CHANGE_FIRST', 'SHOPPING_DISCOUNT', `${facts.discountPctFloor}% 할인`, couponPrice);
  if (facts.hasComparison) add('CHANGE_FIRST', 'SHOPPING_SAVING', `${money(facts.saving)} 차이`, couponPrice);
  if (ctx.shipping && /무료/.test(ctx.shipping)) add('CONDITION_FIRST', 'SHOPPING_FREE_SHIPPING', '무료배송', couponPrice, ', ');
  if (ctx.priceUpdate?.hook) add('CHANGE_FIRST', 'SHOPPING_PRICE_DROP', ctx.priceUpdate.hook, couponPrice);
  if (history?.hook) add('CHANGE_FIRST', 'SHOPPING_PRICE_HISTORY', history.hook, couponPrice);
  if (conversation.hook && ['daangn', 'naver_cafe'].includes(platform)) {
    add('CONTEXT', 'SHOPPING_READER_PRICE', conversation.hook, couponPrice, ', ');
  }
  return entries;
}

function utilityTitleCandidates(ctx, platform) {
  const max = platformProfile(platform).titleMax;
  const entries = [];
  const seen = new Set();
  const add = (strategy, raw) => {
    const title = clean(raw).replace(/[.?!]+$/g, '');
    if (title.length < 6 || title.length > max || seen.has(title)) return;
    seen.add(title);
    entries.push({ strategy, title });
  };

  add('UTILITY_SOURCE', ctx.sourceTitle);
  add('UTILITY_READER_NEED', ctx.readerNeed);
  add('UTILITY_ANGLE', ctx.editorialAngle);
  const category = clean(ctx.category);
  const source = clean(ctx.sourceTitle);
  if (category && source && !source.includes(category)) add('UTILITY_CATEGORY', `${category} · ${source}`);
  return entries;
}

function recentPromptCount(recentPosts, profile) {
  return recentPosts.slice(-profile.recentCtaWindow).filter(post => {
    const meta = post.copyMeta || buildCopyMeta(
      post.title || post.postTitle || '',
      post.bodyText || post.postBody || ''
    );
    return Number(meta.ctaCount || 0) > 0;
  }).length;
}

function renderV6Candidates(item, platform = 'daangn', recentPosts = []) {
  const ctx = item?.copyContext || {};
  const profile = platformProfile(platform);

  if (ctx.kind === 'hotdeal' && ctx.currentOffer) {
    const facts = dealPriceFacts(ctx);
    const offerTerms = separateOfferTerms(ctx.product);
    const conditions = [...new Set([
      ...(ctx.requiredConditions || ctx.conditions || []),
      ...offerTerms.conditions
    ])].filter(Boolean);
    const history = ctx.priceUpdate?.line || trackingCopy(ctx.tracking)?.line || '';
    const conversation = shoppingConversation(ctx.product);
    const question = ['daangn', 'naver_cafe'].includes(platform) &&
      hash(`${ctx.product}|${ctx.buyUrl}`) % 9 === 0 &&
      recentPromptCount(recentPosts, profile) < profile.maxCtaPostsInWindow
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

  if (['benefit', 'service', 'researched', 'comparison', 'digest', 'question'].includes(ctx.kind)) {
    return renderUtilitySurfaceCandidates({
      ctx,
      titles: utilityTitleCandidates(ctx, platform),
      allowedStyleModes: profile.allowedStyleModes
    });
  }

  return renderV5Candidates(item, platform, recentPosts);
}

function copySurface(post = {}) {
  const meta = post.copyMeta || {};
  return meta.surfaceFamily || meta.layoutFamily || meta.skeleton || meta.bodyStrategy || post.bodyStrategy || '';
}

function valueCount(values, value) {
  return value ? values.filter(entry => entry === value).length : 0;
}

function selectionPenalty(candidate, recentPosts) {
  const recent12 = recentPosts.slice(-12);
  const recent8 = recentPosts.slice(-8);
  const recent6 = recentPosts.slice(-6);
  const recent4 = recentPosts.slice(-4);
  const surfaces = recent12.map(copySurface).filter(Boolean);
  const leads = recent8.map(post => post.copyMeta?.leadFamily).filter(Boolean);
  const closings = recent8.map(post => post.copyMeta?.closingFamily).filter(Boolean);
  const titles = recent6.map(post => post.titleStrategy || post.copyMeta?.titleStrategy).filter(Boolean);
  const links = recent4.map(post => post.copyMeta?.linkPosition || post.copyMeta?.declaredLinkPosition).filter(Boolean);
  const styles = recent4.map(post => post.styleMode || post.copyMeta?.styleMode).filter(Boolean);

  let penalty = 0;
  penalty += valueCount(surfaces, candidate.surfaceFamily || candidate.skeleton) * 3200;
  penalty += valueCount(leads, candidate.leadFamily) * 700;
  penalty += valueCount(closings, candidate.closingFamily) * 550;
  penalty += valueCount(titles, candidate.titleStrategy) * 450;
  penalty += valueCount(links, candidate.declaredLinkPosition) * 220;
  penalty += valueCount(styles, candidate.styleMode) * 180;
  if (copySurface(recentPosts.at(-1)) === (candidate.surfaceFamily || candidate.skeleton)) penalty += 6000;
  if ((recentPosts.at(-1)?.copyMeta?.leadFamily || '') === candidate.leadFamily) penalty += 1400;
  return penalty;
}

function selectV6Copy(item, recentPosts = [], platform = 'daangn', learningWeights = {}) {
  const candidates = renderV6Candidates(item, platform, recentPosts);
  const assessed = [];

  for (const candidate of candidates) {
    const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
    const integrity = growthCopyFailures(item, candidate);
    if (!qa.ok || integrity.length) continue;

    const learningFactor = learningFactorForCandidate(item, candidate, qa.meta, learningWeights);
    const explorationBonus = explorationBonusForCandidate(item, candidate, qa.meta, learningWeights);
    const diversityPenalty = selectionPenalty(candidate, recentPosts);
    const baseRank = qa.scores.finalScore * 100 + qa.scores.noveltyScore * 22;
    assessed.push({
      candidate,
      qa,
      learningFactor,
      explorationBonus,
      diversityPenalty,
      rank: baseRank * learningFactor + baseRank * explorationBonus - diversityPenalty
    });
  }

  if (!assessed.length) {
    const reasons = {};
    for (const candidate of candidates) {
      const qa = assessCopyCandidate({ item, candidate, recentPosts, platform });
      for (const reason of [...qa.reasons, ...growthCopyFailures(item, candidate)]) {
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
    return {
      ...item,
      copyRejected: true,
      copyRejectReasons: reasons,
      renderCandidateCount: candidates.length,
      platform
    };
  }

  const recentSurfaces = new Set(recentPosts.slice(-12).map(copySurface).filter(Boolean));
  const fresh = assessed.filter(entry => !recentSurfaces.has(entry.candidate.surfaceFamily || entry.candidate.skeleton));
  const pool = fresh.length ? fresh : assessed;
  pool.sort((a, b) => b.rank - a.rank || b.qa.scores.finalScore - a.qa.scores.finalScore);
  const picked = pool[0];

  return {
    ...item,
    ...picked.candidate,
    copyRejected: false,
    copyMeta: {
      ...picked.qa.meta,
      layoutFamily: picked.candidate.layoutFamily || picked.candidate.bodyStrategy,
      surfaceFamily: picked.candidate.surfaceFamily || picked.candidate.skeleton,
      leadFamily: picked.candidate.leadFamily || null,
      closingFamily: picked.candidate.closingFamily || null,
      paragraphPattern: picked.candidate.paragraphPattern || null,
      declaredLinkPosition: picked.candidate.declaredLinkPosition || null
    },
    qualityScores: picked.qa.scores,
    learningMeta: {
      factor: Number(picked.learningFactor.toFixed(4)),
      explorationBonus: Number(picked.explorationBonus.toFixed(4)),
      diversityPenalty: picked.diversityPenalty
    },
    renderCandidateCount: candidates.length,
    platform
  };
}

function usesV6(item) {
  const kind = item?.copyContext?.kind;
  return (kind === 'hotdeal' && item?.copyContext?.currentOffer) ||
    ['benefit', 'service', 'researched', 'comparison', 'digest', 'question'].includes(kind);
}

export function renderCommunityCandidates(item, platform = 'daangn', recentPosts = []) {
  return usesV6(item)
    ? renderV6Candidates(item, platform, recentPosts)
    : renderV5Candidates(item, platform, recentPosts);
}

export function selectCommunityCopy(item, recentPosts = [], platform = 'daangn', learningWeights = {}) {
  return usesV6(item)
    ? selectV6Copy(item, recentPosts, platform, learningWeights)
    : selectV5Copy(item, recentPosts, platform, learningWeights);
}

export function validateGeneratedCopy(item, title, body, recentPosts = [], platform = 'daangn') {
  return validateV5Copy(item, title, body, recentPosts, platform);
}

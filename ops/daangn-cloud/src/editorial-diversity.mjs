const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const stableHash = value => [...String(value || '')].reduce((hash, character) => ((hash * 33) ^ character.charCodeAt(0)) >>> 0, 2166136261);
const money = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '원';
const percent = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%';

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function punctuate(value) {
  const text = clean(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : text + '.';
}

function choose(values, seed) {
  if (!values?.length) return '';
  return values[Math.abs(seed) % values.length];
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    const key = candidate.postTitle + '\n' + candidate.postBody;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupText(group, blocks) {
  return group.map(key => blocks[key]).map(clean).filter(Boolean).join(' ');
}

function bodyFromPlan(groups, blocks) {
  return groups.map(group => groupText(group, blocks)).filter(Boolean).join('\n\n');
}

function blockRole(key = '') {
  if (key.startsWith('LINK')) return 'source';
  if (/^F\d+$/.test(key)) return 'fact';
  if (/^C\d+$/.test(key)) return 'condition';
  return ({ PRODUCT_PRICE: 'price', COMPARE: 'comparison', TERMS: 'terms' })[key] || key.toLowerCase();
}

function actualSurfaceMetadata(prefix, groups) {
  const paragraphPattern = groups.map(group => group.join('+')).join('>');
  const informationGroups = groups.filter(group => group.some(key => !key.startsWith('LINK')));
  return {
    // Do not count a different plan name or utility kind as a new structure.
    // Optional missing fields can make two plans render the same paragraph order.
    surfaceFamily: `${prefix}:${paragraphPattern}`,
    leadFamily: blockRole(groups[0]?.[0]),
    paragraphPattern,
    closingFamily: blockRole(informationGroups.at(-1)?.filter(key => !key.startsWith('LINK')).at(-1)),
    declaredLinkPosition: groups[0]?.some(key => key.startsWith('LINK')) ? 'start'
      : groups.at(-1)?.some(key => key.startsWith('LINK'))
        ? (groups.at(-1).includes('LINK_LABEL') ? 'labeled-end' : 'end') : 'middle'
  };
}

function nonLinkParagraphEndings(body = '') {
  return String(body)
    .split(/\n+/)
    .map(clean)
    .filter(Boolean)
    .filter(line => !/^https?:\/\//i.test(line) && !/^\S*\s*https?:\/\//i.test(line))
    .map(line => line.replace(/[.!?~ㅎㅋ\s]+$/g, '').slice(-5))
    .filter(Boolean);
}

function hasAdjacentEndingRepeat(body = '') {
  const endings = nonLinkParagraphEndings(body);
  return endings.slice(1).some((ending, index) => ending === endings[index]);
}

/**
 * Every sentence in this registry is generated only from already verified
 * structured values. Renderers and validators use the same registry so wording
 * can vary without weakening amount, comparison, quantity or delivery checks.
 */
export function approvedDealClaimGroups(ctx = {}, facts = {}) {
  const priceLabel = clean(ctx.priceLabel) || (ctx.coupon ? '쿠폰 적용가' : '상품가');
  const priceText = Number.isFinite(facts.price) ? money(facts.price) : '';
  const groups = {
    price: unique([
      facts.priceLine,
      priceText && `현재 ${priceLabel}는 ${priceText}이에요.`,
      priceText && `판매 페이지에 표시된 ${priceLabel}는 ${priceText}입니다.`,
      priceText && `${priceText}이 현재 확인되는 ${priceLabel}입니다.`,
      priceText && `지금 적용되는 ${priceLabel}는 ${priceText}이에요.`,
      priceText && `${priceLabel} 기준 금액은 ${priceText}입니다.`
    ]),
    comparisonDiscount: [],
    unit: [],
    delivery: []
  };

  if (facts.hasComparison) {
    const reference = money(facts.referencePrice);
    const saving = money(facts.saving);
    const rate = percent(facts.discountPct);
    const label = clean(facts.referenceLabel);
    groups.comparisonDiscount = unique([
      [facts.comparisonLine, facts.discountLine].filter(Boolean).join(' '),
      `${label} ${reference}보다 ${saving} 낮고, 할인율은 약 ${rate}입니다.`,
      `${label} ${reference}에서 ${saving} 내려간 가격이며, 할인율은 약 ${rate}예요.`,
      `비교 기준인 ${label} ${reference} 대비 ${saving} 낮습니다. 할인율은 약 ${rate}입니다.`,
      `할인 폭은 ${saving}입니다. ${label} ${reference}과 비교한 할인율은 약 ${rate}예요.`,
      `${label} ${reference}과의 차이는 ${saving}이고, 계산한 할인율은 약 ${rate}입니다.`,
      `${saving} 낮은 금액입니다. 비교 기준은 ${label} ${reference}, 할인율은 약 ${rate}입니다.`
    ]);
  }

  if (facts.unitLine && facts.unitInfo?.count > 1 && facts.unitPriceText) {
    const count = `${facts.unitInfo.count}${facts.unitInfo.unit}`;
    const divisionParticle = ['세트', '박스', '롤', '포', '개', '매'].includes(facts.unitInfo.unit) ? '로' : '으로';
    groups.unit = unique([
      facts.unitLine,
      `상품가를 총 ${count}${divisionParticle} 나누면 ${facts.unitPriceText}이에요.`,
      `구성은 총 ${count}이며, 상품가 기준 단가는 ${facts.unitPriceText}입니다.`,
      `${count} 묶음이라 상품가 기준 ${facts.unitPriceText}입니다.`,
      `상품가를 수량으로 나눈 단가입니다. 총 ${count} 구성으로 ${facts.unitPriceText}이에요.`,
      `총수량은 ${count}, 상품가 기준으로는 ${facts.unitPriceText}입니다.`
    ]);
  }

  if (facts.deliveryLine && Number.isFinite(ctx.delivery?.total)) {
    const total = money(ctx.delivery.total);
    groups.delivery = unique([
      facts.deliveryLine,
      `기본배송 지역의 배송 포함 금액은 ${total}입니다.`,
      `기본배송 지역에서는 배송비를 포함해 ${total}이에요.`,
      `배송비까지 계산한 기본배송 지역 금액은 ${total}입니다.`,
      `기본배송 지역 결제 금액은 배송비까지 ${total}입니다.`,
      `배송 포함 기준으로 기본배송 지역에서는 ${total}이에요.`
    ]);
  }

  return groups;
}

export function bodyContainsApprovedDealClaim(body, variants = []) {
  const text = String(body || '');
  return variants.length === 0 || variants.some(variant => text.includes(variant));
}

function shippingVariants(shipping = '') {
  const value = clean(shipping);
  if (!value) return [];
  return unique([
    `배송은 ${value}입니다.`,
    `안내된 배송 조건은 ${value}입니다.`,
    `${value} 조건으로 배송됩니다.`,
    `배송 기준: ${punctuate(value)}`,
    `주문 전 확인할 배송 조건은 ${value}입니다.`
  ]);
}

const SHOPPING_PLANS = Object.freeze([
  { id: 'PRICE_COMPARE_END', styleMode: 'PRICE_FIRST', leadFamily: 'price', closingFamily: 'fit', groups: [['PRODUCT_PRICE', 'UNIT'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['HISTORY'], ['FIT'], ['QUESTION'], ['LINK']] },
  { id: 'COMPARE_PRICE_END', styleMode: 'CHANGE_FIRST', leadFamily: 'comparison', closingFamily: 'terms', groups: [['COMPARE'], ['PRICE', 'UNIT'], ['SHIPPING', 'DELIVERY'], ['FIT'], ['HISTORY'], ['TERMS'], ['LINK']] },
  { id: 'SHIPPING_PRICE_END', styleMode: 'CONDITION_FIRST', leadFamily: 'shipping', closingFamily: 'fit', groups: [['SHIPPING', 'DELIVERY'], ['PRODUCT_PRICE'], ['COMPARE', 'UNIT'], ['TERMS'], ['HISTORY'], ['FIT'], ['LINK']] },
  { id: 'UNIT_PRICE_END', styleMode: 'UNIT_FIRST', leadFamily: 'unit', closingFamily: 'terms', groups: [['UNIT'], ['PRODUCT_PRICE'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['FIT'], ['TERMS'], ['LINK']] },
  { id: 'FIT_PRICE_END', styleMode: 'CONTEXT', leadFamily: 'fit', closingFamily: 'terms', groups: [['FIT'], ['PRODUCT_PRICE', 'UNIT'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['HISTORY'], ['TERMS'], ['LINK']] },
  { id: 'TERMS_COMPARE_END', styleMode: 'CONDITION_FIRST', leadFamily: 'terms', closingFamily: 'fit', groups: [['TERMS'], ['COMPARE'], ['PRICE', 'UNIT'], ['SHIPPING', 'DELIVERY'], ['HISTORY'], ['FIT'], ['LINK']] },
  { id: 'PRICE_LINK_MIDDLE', styleMode: 'PRICE_FIRST', leadFamily: 'price', closingFamily: 'terms', groups: [['PRODUCT_PRICE', 'UNIT'], ['LINK_MIDDLE'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['FIT'], ['HISTORY'], ['TERMS']] },
  { id: 'COMPARE_LINK_MIDDLE', styleMode: 'CHANGE_FIRST', leadFamily: 'comparison', closingFamily: 'fit', groups: [['COMPARE'], ['LINK_MIDDLE'], ['PRICE', 'UNIT'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['HISTORY'], ['FIT']] },
  { id: 'SHIPPING_LINK_MIDDLE', styleMode: 'CONDITION_FIRST', leadFamily: 'shipping', closingFamily: 'history', groups: [['SHIPPING', 'DELIVERY'], ['PRODUCT_PRICE'], ['LINK_MIDDLE'], ['COMPARE', 'UNIT'], ['TERMS'], ['FIT'], ['HISTORY']] },
  { id: 'FIT_LINK_MIDDLE', styleMode: 'CONTEXT', leadFamily: 'fit', closingFamily: 'comparison', groups: [['FIT'], ['PRODUCT_PRICE'], ['LINK_MIDDLE'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['UNIT'], ['COMPARE']] },
  { id: 'PRICE_COMPARE_LABELED', styleMode: 'PRICE_FIRST', leadFamily: 'price', closingFamily: 'source', groups: [['PRODUCT_PRICE'], ['COMPARE', 'UNIT'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['HISTORY', 'FIT'], ['LINK_LABEL']] },
  { id: 'COMPARE_PRICE_LABELED', styleMode: 'CHANGE_FIRST', leadFamily: 'comparison', closingFamily: 'source', groups: [['COMPARE'], ['PRICE', 'UNIT'], ['SHIPPING', 'DELIVERY'], ['FIT'], ['HISTORY', 'TERMS'], ['LINK_LABEL']] },
  { id: 'COMPACT_PRICE', styleMode: 'BARE', leadFamily: 'price', closingFamily: 'source', groups: [['PRICE', 'COMPARE'], ['UNIT', 'SHIPPING', 'DELIVERY'], ['TERMS'], ['FIT', 'HISTORY'], ['LINK']] },
  { id: 'COMPACT_CONDITION', styleMode: 'CONDITION_FIRST', leadFamily: 'terms', closingFamily: 'source', groups: [['TERMS', 'SHIPPING'], ['PRICE', 'COMPARE'], ['UNIT', 'DELIVERY'], ['FIT', 'HISTORY'], ['LINK']] },
  { id: 'TWO_COLUMN_FACTS', styleMode: 'BARE', leadFamily: 'comparison', closingFamily: 'source', groups: [['COMPARE', 'UNIT'], ['PRODUCT_PRICE', 'DELIVERY'], ['SHIPPING', 'TERMS'], ['FIT', 'HISTORY'], ['LINK']] },
  { id: 'HISTORY_PRICE_END', styleMode: 'CHANGE_FIRST', leadFamily: 'history', closingFamily: 'terms', groups: [['HISTORY'], ['PRODUCT_PRICE', 'UNIT'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['FIT'], ['TERMS'], ['LINK']] },
  { id: 'DELIVERY_COMPARE_END', styleMode: 'CONDITION_FIRST', leadFamily: 'delivery', closingFamily: 'fit', groups: [['DELIVERY', 'SHIPPING'], ['COMPARE'], ['PRICE', 'UNIT'], ['TERMS'], ['HISTORY'], ['FIT'], ['LINK']] },
  { id: 'QUESTION_PRICE_END', styleMode: 'CONTEXT', leadFamily: 'question', closingFamily: 'source', groups: [['QUESTION'], ['PRODUCT_PRICE', 'UNIT'], ['COMPARE'], ['SHIPPING', 'DELIVERY'], ['TERMS'], ['FIT', 'HISTORY'], ['LINK']] }
]);

export function renderShoppingSurfaceCandidates({
  ctx,
  facts,
  offerTerms,
  conditions = [],
  history = '',
  question = '',
  titles = [],
  allowedStyleModes = [],
  bodyPostprocess = value => value
}) {
  const claims = approvedDealClaimGroups(ctx, facts);
  const seedBase = stableHash(`${ctx.product || ''}|${ctx.buyUrl || ctx.url || ''}|${ctx.price || ''}`);
  const termText = unique(conditions.map(punctuate)).join(' ');
  const shipping = shippingVariants(ctx.shipping);
  const candidates = [];

  for (let titleIndex = 0; titleIndex < titles.length; titleIndex += 1) {
    const title = titles[titleIndex];
    for (let planIndex = 0; planIndex < SHOPPING_PLANS.length; planIndex += 1) {
      const plan = SHOPPING_PLANS[planIndex];
      if (!allowedStyleModes.includes(plan.styleMode)) continue;
      if (plan.leadFamily === 'unit' && !claims.unit.length) continue;
      if (plan.leadFamily === 'history' && !history) continue;
      if (plan.leadFamily === 'question' && !question) continue;
      const seed = seedBase + titleIndex * 131 + planIndex * 977;
      let blocks;
      let groups;
      let postBody = '';
      // The production quality gate rejects adjacent paragraphs with the same
      // sentence ending. Rotate only approved factual variants until the frame
      // reads naturally; no amount or condition is changed in this process.
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const variantSeed = seed + attempt * 104729;
        const priceClaim = choose(claims.price, variantSeed);
        blocks = {
          PRODUCT_PRICE: [clean(offerTerms?.base), priceClaim].filter(Boolean).join(', '),
          PRICE: priceClaim,
          COMPARE: choose(claims.comparisonDiscount, variantSeed + 11),
          UNIT: choose(claims.unit, variantSeed + 23),
          SHIPPING: choose(shipping, variantSeed + 37),
          DELIVERY: choose(claims.delivery, variantSeed + 41),
          TERMS: termText,
          HISTORY: clean(history),
          FIT: clean(facts.purchaseFit),
          QUESTION: clean(question),
          LINK: clean(ctx.buyUrl || ctx.url),
          LINK_MIDDLE: clean(ctx.buyUrl || ctx.url) ? `판매페이지 ${clean(ctx.buyUrl || ctx.url)}` : '',
          LINK_LABEL: clean(ctx.buyUrl || ctx.url) ? `상품페이지 ${clean(ctx.buyUrl || ctx.url)}` : ''
        };
        groups = plan.groups.map(group => group.filter(key => blocks[key])).filter(group => group.length);
        // A factual price-history line must survive every layout, including a
        // unit-first or middle-link plan that has no dedicated HISTORY slot.
        if (blocks.HISTORY && !groups.some(group => group.includes('HISTORY'))) {
          const before = groups.findIndex(group => group.includes('TERMS'));
          groups.splice(before >= 0 ? before : groups.length, 0, ['HISTORY']);
        }
        postBody = bodyPostprocess(bodyFromPlan(groups, blocks));
        if (!hasAdjacentEndingRepeat(postBody)) break;
      }
      candidates.push({
        styleMode: plan.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: `shopping-v6-${plan.id.toLowerCase()}`,
        skeleton: `shopping:v6:${plan.id}`,
        layoutFamily: plan.id,
        ...actualSurfaceMetadata('shopping', groups),
        postTitle: title.title,
        postBody
      });
    }
  }
  return dedupeCandidates(candidates);
}

const UTILITY_PLANS = Object.freeze([
  { id: 'FACTS_CONDITIONS_END', styleMode: 'BARE', leadFamily: 'fact', closingFamily: 'source', groups: [['F1', 'F2'], ['F3', 'F4'], ['C1', 'C2', 'C3'], ['LINK']] },
  { id: 'CONDITIONS_FACTS_END', styleMode: 'CONDITION_FIRST', leadFamily: 'condition', closingFamily: 'source', groups: [['C1', 'C2'], ['F1', 'F2'], ['F3', 'F4', 'C3'], ['LINK_LABEL']] },
  { id: 'FACT_SPLIT_END', styleMode: 'BARE', leadFamily: 'fact', closingFamily: 'condition', groups: [['F1'], ['F2'], ['C1'], ['F3', 'F4'], ['C2', 'C3'], ['LINK']] },
  { id: 'SOURCE_FACTS_MIDDLE', styleMode: 'CONTEXT', leadFamily: 'source', closingFamily: 'condition', groups: [['LINK_LABEL'], ['F1', 'F2'], ['C1'], ['F3', 'F4'], ['C2', 'C3']] },
  { id: 'FACT_SOURCE_MIDDLE', styleMode: 'BARE', leadFamily: 'fact', closingFamily: 'condition', groups: [['F1'], ['LINK_LABEL'], ['F2', 'F3'], ['C1', 'C2'], ['F4', 'C3']] },
  { id: 'CONDITION_SOURCE_MIDDLE', styleMode: 'CONDITION_FIRST', leadFamily: 'condition', closingFamily: 'fact', groups: [['C1'], ['F1', 'F2'], ['LINK_MIDDLE'], ['C2', 'C3'], ['F3', 'F4']] },
  { id: 'EACH_FACT_END', styleMode: 'BARE', leadFamily: 'fact', closingFamily: 'source', groups: [['F1'], ['F2'], ['F3'], ['F4'], ['C1', 'C2', 'C3'], ['LINK']] },
  { id: 'LIMIT_BETWEEN_FACTS', styleMode: 'CONDITION_FIRST', leadFamily: 'fact', closingFamily: 'source', groups: [['F1'], ['C1', 'C2'], ['F2', 'F3'], ['C3', 'F4'], ['LINK_LABEL']] },
  { id: 'SOURCE_START_COMPACT', styleMode: 'CONTEXT', leadFamily: 'source', closingFamily: 'condition', groups: [['LINK_START'], ['F1', 'F2', 'F3'], ['F4', 'C1', 'C2', 'C3']] },
  { id: 'CONDITION_START_COMPACT', styleMode: 'CONDITION_FIRST', leadFamily: 'condition', closingFamily: 'source', groups: [['C1', 'C2', 'C3'], ['F1', 'F2', 'F3', 'F4'], ['LINK_LABEL']] },
  { id: 'FACT_CONDITION_ALTERNATE', styleMode: 'BARE', leadFamily: 'fact', closingFamily: 'source', groups: [['F1'], ['C1'], ['F2'], ['C2'], ['F3', 'F4', 'C3'], ['LINK']] },
  { id: 'DETAIL_THEN_SOURCE', styleMode: 'BARE', leadFamily: 'detail', closingFamily: 'source', groups: [['F1', 'F2', 'F3'], ['C1'], ['F4', 'C2', 'C3'], ['LINK_LABEL']] },
  { id: 'FACT_PAIR_SOURCE_LIMIT_DETAIL', styleMode: 'BARE', groups: [['F1', 'F2'], ['LINK'], ['C1', 'C2', 'C3'], ['F3', 'F4']] },
  { id: 'LIMIT_SOURCE_FACT_PAIRS', styleMode: 'CONDITION_FIRST', groups: [['C1', 'C2', 'C3'], ['LINK'], ['F1', 'F2'], ['F3', 'F4']] },
  { id: 'FACT_LIMIT_DETAIL_END', styleMode: 'BARE', groups: [['F1', 'C1'], ['F2', 'F3'], ['F4', 'C2', 'C3'], ['LINK']] },
  { id: 'FACT_PAIR_LIMIT_COMPACT', styleMode: 'BARE', groups: [['F1', 'F2', 'C1'], ['F3', 'F4', 'C2', 'C3'], ['LINK_LABEL']] },
  { id: 'FACT_PAIR_SOURCE_DETAIL_LIMIT', styleMode: 'BARE', groups: [['F1', 'F2'], ['LINK_LABEL'], ['F3', 'F4'], ['C1', 'C2', 'C3']] },
  { id: 'FACT_LIMIT_SOURCE_DETAIL', styleMode: 'CONDITION_FIRST', groups: [['F1', 'C1', 'C2'], ['LINK_LABEL'], ['F2', 'F3', 'F4', 'C3']] },
  { id: 'LIMIT_FACT_SOURCE_DETAIL', styleMode: 'CONDITION_FIRST', groups: [['C1', 'F1'], ['LINK'], ['F2', 'F3'], ['F4', 'C2', 'C3']] },
  { id: 'SOURCE_LIMIT_FACT_PAIRS', styleMode: 'CONTEXT', groups: [['LINK_LABEL'], ['C1'], ['F1', 'F2'], ['C2', 'C3'], ['F3', 'F4']] },
  { id: 'SOURCE_FACT_LIMIT_DETAIL', styleMode: 'CONTEXT', groups: [['LINK_LABEL'], ['F1', 'C1'], ['F2'], ['F3', 'F4', 'C2', 'C3']] },
  { id: 'LIMIT_EACH_FACT_END', styleMode: 'CONDITION_FIRST', groups: [['C1', 'C2', 'C3'], ['F1'], ['F2'], ['F3', 'F4'], ['LINK']] },
  { id: 'FACT_DETAIL_LIMIT_SOURCE', styleMode: 'BARE', groups: [['F1'], ['F2', 'C1'], ['LINK'], ['F3', 'F4', 'C2', 'C3']] },
  { id: 'EACH_FACT_SOURCE_LIMIT', styleMode: 'BARE', groups: [['F1'], ['F2'], ['F3', 'F4'], ['LINK'], ['C1', 'C2', 'C3']] }
]);

export function renderUtilitySurfaceCandidates({ ctx, titles = [], allowedStyleModes = [] }) {
  const facts = unique([...(ctx.facts || []), ...(ctx.requiredFacts || [])]);
  const conditions = unique([...(ctx.requiredConditions || []), ...(ctx.conditions || [])]);
  const links = unique([...(ctx.sourceUrls || []), ctx.url]);
  const sourceLinks = links.join(' ');
  const blocks = {
    F1: facts[0],
    F2: facts[1],
    F3: facts[2],
    // Keep every reviewed fact and condition. Extra details stay in the last
    // existing group rather than silently disappearing at a fixed field cap.
    F4: facts.slice(3).join(' '),
    C1: conditions[0],
    C2: conditions[1],
    C3: conditions.slice(2).join(' '),
    LINK: sourceLinks,
    LINK_START: sourceLinks ? `공식안내 ${sourceLinks}` : '',
    LINK_MIDDLE: sourceLinks ? `공식안내 ${sourceLinks}` : '',
    LINK_LABEL: sourceLinks ? `공식안내 ${sourceLinks}` : ''
  };
  const candidates = [];
  for (const title of titles) {
    for (const plan of UTILITY_PLANS) {
      if (!allowedStyleModes.includes(plan.styleMode)) continue;
      const groups = plan.groups.map(group => group.filter(key => blocks[key])).filter(group => group.length);
      const body = bodyFromPlan(groups, blocks);
      candidates.push({
        styleMode: plan.styleMode,
        titleStrategy: title.strategy,
        bodyStrategy: `utility-v6-${plan.id.toLowerCase()}`,
        skeleton: `${ctx.kind}:v6:${plan.id}`,
        layoutFamily: plan.id,
        ...actualSurfaceMetadata('utility', groups),
        postTitle: title.title,
        postBody: body
      });
    }
  }
  return dedupeCandidates(candidates);
}

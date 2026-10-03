const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const money = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '원';
const COUNT_UNITS = '세트|박스|묶음|팩|봉|병|캔|통|롤|포|개|장|매';
const unitTier = unit => /^(매|장)$/.test(unit) ? 0 : /^(박스|세트|묶음)$/.test(unit) ? 2 : /^(팩|봉)$/.test(unit) ? 1.5 : 1;
const validCount = count => Number.isSafeInteger(count) && count > 0 && count <= 100000;

// Quantity must identify one fixed configuration. Gifts, options and 1+1 are
// deliberately excluded: their listed count may already include the extra item.
export function verifiedDealQuantity(ctx = {}) {
  const structured = ctx.quantity;
  if (structured?.verified === true && validCount(structured.count) && new RegExp(`^(?:${COUNT_UNITS})$`).test(structured.unit)) {
    return { count: structured.count, unit: structured.unit, evidence: clean(structured.evidence || `${structured.count}${structured.unit}`), source: 'verified-quantity' };
  }
  const product = clean(ctx.product);
  if (!product || /&|및|증정|사은품|샘플|샤쉐|추가|포함|랜덤|선택|택\s*\d|혼합|각\s*\d|\d\s*[-~∼/]\s*\d/.test(product)) return null;
  if (product.includes('+')) {
    // Only a same-unit suffix can be summed: "밥 24개+24개". Any product
    // wording between components, gifts or an unlabeled "1+1" remains unknown.
    const sum = product.match(new RegExp(`(?<![\\d.])([1-9]\\d*\\s*(?:${COUNT_UNITS})(?:\\s*\\+\\s*[1-9]\\d*\\s*(?:${COUNT_UNITS}))+)$`));
    if (!sum || /[+/]/.test(product.slice(0, sum.index))) return null;
    const terms = [...sum[1].matchAll(new RegExp(`([1-9]\\d*)\\s*(${COUNT_UNITS})`, 'g'))];
    const unit = terms[0][2];
    if (terms.some(term => term[2] !== unit)) return null;
    const prefixQuantity = verifiedDealQuantity({ product: product.slice(0, sum.index) });
    if (prefixQuantity && unitTier(prefixQuantity.unit) >= unitTier(unit)) return null;
    const count = terms.reduce((total, term) => total + Number(term[1]), 0);
    return validCount(count) ? { count, unit, evidence: sum[1], source: 'product-title' } : null;
  }
  const matches = [...product.matchAll(new RegExp(`(?<![\\d.])([1-9]\\d*(?:,\\d{3})*)\\s*(${COUNT_UNITS.replace('|개|', '|개(?!월|년)|')})(?:입)?`, 'g'))]
    .map(match => ({ count: Number(match[1].replaceAll(',', '')), unit: match[2], start: match.index, end: match.index + match[0].length, evidence: match[0] }));
  if (!matches.length || matches.some(match => !validCount(match.count))) return null;
  const unconsumedMultiplier = (start, end) => [...product.matchAll(/[xX×*]\s*([1-9]\d*)/g)].some(match => {
    const numberStart = match.index + match[0].indexOf(match[1]);
    return !(match.index >= start && match.index < end) && !matches.some(token => token.start === numberStart);
  });

  // Explicit total wins only when it names a unique count; it avoids counting
  // both a total and its decomposition, e.g. "총 40팩 (20팩 x 2)".
  const totals = matches.filter(match => /총\s*$/.test(product.slice(0, match.start)));
  if (totals.length === 1) {
    const total = totals[0];
    if (/^\s*[xX×*]\s*\d/.test(product.slice(total.end))) return null;
    if (matches.some(match => match !== total && match.unit === total.unit)) {
      const rest = product.slice(0, total.start).replace(/총\s*$/, '') + product.slice(total.end);
      const breakdown = verifiedDealQuantity({ product: rest });
      if (!breakdown || breakdown.unit !== total.unit || breakdown.count !== total.count) return null;
    }
    return { count: total.count, unit: total.unit, evidence: total.evidence, source: 'product-title' };
  }
  if (totals.length > 1) return null;

  const primary = matches.find(match => unitTier(match.unit) > 0) || matches[0];
  let count = primary.count, end = primary.end, multiplied = false;
  const chain = new RegExp(`^\\s*[xX×*]\\s*([1-9]\\d*)\\s*(${COUNT_UNITS})?(?:입)?(?=$|[\\s()[\\]xX×*])`);
  while (true) {
    const next = product.slice(end).match(chain);
    if (!next) break;
    // A multiplier may be an outer package, never a different inner unit.
    if (next[2] && unitTier(next[2]) < unitTier(primary.unit)) return null;
    count *= Number(next[1]);
    if (!validCount(count)) return null;
    end += next[0].length;
    multiplied = true;
  }
  if (multiplied) {
    if (unconsumedMultiplier(primary.start, end) || matches.some(match => match.start >= end || (match.end <= primary.start && unitTier(match.unit) >= unitTier(primary.unit)))) return null;
    return { count, unit: primary.unit, evidence: product.slice(primary.start, end).trim(), source: 'product-title' };
  }
  // Without an explicit multiplication, select the outer pack count; do not
  // multiply "70매 20팩" into a claim that each pack costs the per-sheet price.
  for (let i = 1; i < matches.length; i += 1) {
    if (unitTier(matches[i].unit) <= unitTier(matches[i - 1].unit)) return null;
  }
  // An outer package with count 1 does not hide an explicit inner item count.
  // "5개입 1세트" is five items; "70매 20팩 1박스" is twenty packs.
  const retail = [...matches];
  while (retail.length > 1 && retail.at(-1).count === 1) retail.pop();
  const selected = retail.at(-1);
  // A bare multiplier not handled above means the expression was ambiguous.
  if (unconsumedMultiplier(-1, -1) || /^\s*[xX×*]\s*\d/.test(product.slice(selected.end))) return null;
  return { count: selected.count, unit: selected.unit, evidence: selected.evidence, source: 'product-title' };
}

export function dealPriceFacts(ctx = {}) {
  const price = Number(ctx.price), referencePrice = Number(ctx.referencePrice);
  const priceValid = Number.isSafeInteger(price) && price > 0;
  const referenceValid = priceValid && Number.isSafeInteger(referencePrice) && referencePrice > price && Boolean(clean(ctx.referenceLabel));
  const saving = referenceValid ? referencePrice - price : null;
  const consistent = ctx.saving == null || Number(ctx.saving) === saving;
  const hasComparison = referenceValid && consistent;
  // Never round a discount upward. Unit prices use a marked approximation
  // rounded upward to whole won so they never understate the calculated cost.
  const discountPct = hasComparison ? Math.floor(saving * 1000 / referencePrice) / 10 : null;
  const discountPctFloor = hasComparison ? Math.floor(saving * 100 / referencePrice) : null;
  const unitInfo = verifiedDealQuantity(ctx);
  const unitPrice = priceValid && unitInfo?.count > 1 ? price / unitInfo.count : null;
  const unitPriceRounded = unitPrice === null ? null : Math.ceil(unitPrice);
  const unitPriceApproximate = unitPrice !== null && !Number.isInteger(unitPrice);
  const unitPriceText = unitPrice === null ? '' : `${unitInfo.unit}당 ${unitPriceApproximate ? '약 ' : ''}${money(unitPriceRounded)}`;
  const priceLabel = clean(ctx.priceLabel) || (ctx.coupon ? '쿠폰 적용가' : '상품가');
  const priceLine = `${priceLabel}는 ${priceValid ? money(price) + '입니다.' : '확인이 필요합니다.'}`;
  const comparisonLine = hasComparison ? `${clean(ctx.referenceLabel)} ${money(referencePrice)}과 비교하면` : '';
  const discountLine = hasComparison ? `${money(saving)} 낮아졌고, 할인율은 약 ${discountPct}%예요.` : '';
  const unitLine = unitPriceText ? `총 ${unitInfo.count}${unitInfo.unit} 구성이고, 상품가 기준 ${unitPriceText}이에요.` : '';
  const deliveryLine = ctx.delivery ? `기본배송 지역에서는 배송비까지 ${money(ctx.delivery.total)}입니다.` : '';
  const purchaseFit = ctx.category === '먹거리·장보기' && unitInfo?.count > 1
    ? '다만 묶음으로 사는 만큼 소비기한 안에 다 먹을 수 있을지가 먼저겠죠.'
    : /밥솥|청소기|식기세척기/.test(ctx.product || '') ? '지금 쓰는 제품에 문제가 없다면 할인 때문에 서둘러 바꿀 필요는 없겠죠.'
    : unitInfo?.count > 1 ? /물티슈/.test(ctx.product || '')
      ? '집에 남은 물티슈가 얼마나 있는지, 보관할 자리는 있는지까지 생각하고 주문하는 편이 낫겠습니다.'
      : '묶음이라 집에 남은 양과 보관할 자리까지 생각하고 주문하는 편이 낫겠습니다.' : '';
  return { price: priceValid ? price : null, referencePrice: referenceValid ? referencePrice : null, referenceLabel: clean(ctx.referenceLabel), hasComparison, saving: hasComparison ? saving : null, discountPct, discountPctFloor, unitInfo, unitPrice, unitPriceRounded, unitPriceApproximate, unitPriceText, priceLine, comparisonLine, discountLine, unitLine, deliveryLine, purchaseFit };
}


/** Meaning-preserving title helpers. Never substring a finished headline. */
export const cleanTitleText = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
export function separateOfferTerms(value = '') {
  const original = cleanTitleText(value), conditions = [];
  let base = original.replace(/\([^()]*\)/g, block => {
    if (/증정|사은품|구매\s*시|구매시|GIFT/i.test(block)) { conditions.push(block.slice(1, -1).trim()); return ' '; }
    if (/최[.\s]*저[.\s]*가\s*행사|한정\s*특가|역대급/.test(block)) return ' ';
    return block;
  });
  const split = base.search(/\s*\+\s*\[GIFT\]|\s*\/\s*\d+\s*세트\s*구매\s*시/i);
  if (split >= 0) { conditions.push(base.slice(split).replace(/^[\s/+]+/, '').trim()); base = base.slice(0, split); }
  base = cleanTitleText(base).replace(/\b(\d+(?:\.\d+)?)\s*(kg|ml|g|L|l)\b/g, '$1$2').replace(/\s*[xX×*]\s*(?=\d)/g, '×').replace(/(\d)\s+(?=개|팩|병|캔|롤|통|봉|매|장|세트)/g, '$1');
  const ambiguous = /증정|사은품|GIFT|구매\s*시|최[.\s]*저[.\s]*가/.test(base);
  return { base, conditions: [...new Set(conditions)], ambiguous, original };
}
function sharedBundleName(base) {
  const parts = base.split(/\s*\+\s*/);
  if (parts.length < 2 || parts.length > 3) return null;
  const parsed = parts.map(part => part.match(/^(.*?)\s+(\d+(?:\.\d+)?(?:kg|g|ml|L|l))×?(\d+)(개|팩|병|캔|봉)$/));
  if (parsed.some(p => !p) || !parsed.every(p => p[2] === parsed[0][2] && p[4] === parsed[0][4])) return null;
  const names = parsed.map(p => p[1].split(' '));
  let prefixCount = 0, suffixCount = 0;
  while (names.every(n => n.length > prefixCount + 1 && n[prefixCount] === names[0][prefixCount])) prefixCount++;
  while (names.every(n => n.length - suffixCount > prefixCount + 1 && n.at(-1 - suffixCount) === names[0].at(-1 - suffixCount))) suffixCount++;
  if (!prefixCount || !suffixCount) return null;
  const prefix = names[0].slice(0, prefixCount).join(' '), suffix = names[0].slice(-suffixCount).join(' ');
  const options = parsed.map((p, i) => `${names[i].slice(prefixCount, -suffixCount).join(' ')}${p[3]}${p[4]}`);
  if (options.some(x => !x || x.length > 20)) return null;
  return `${prefix} ${suffix} ${parsed[0][2]} ${options.join('+')}`;
}
export function fitProductName(value, max) {
  const { base, ambiguous } = separateOfferTerms(value);
  if (!base || ambiguous || !Number.isInteger(max) || max < 4) return null;
  const shared = sharedBundleName(base);
  if (shared && shared.length <= max) return shared;
  return base.length <= max ? base : null;
}
export function composeDealTitle(ctx, { max = 50, prefix = '', hook = '', includeMerchant = false } = {}) {
  const p = Number(ctx.price);
  if (!Number.isSafeInteger(p) || p <= 0) return null;
  const amount = `${p.toLocaleString('ko-KR')}원`;
  const conditions = [ctx.coupon ? '쿠폰가' : '', ...(ctx.titleConditions || [])].filter(Boolean).map(cleanTitleText);
  const required = [...conditions, amount].join(' ');
  const merchant = includeMerchant && ctx.merchant ? `[${cleanTitleText(ctx.merchant)}] ` : '';
  const start = merchant + prefix, tail = required + (hook ? ' · ' + hook : '');
  const name = fitProductName(ctx.product, max - start.length - tail.length - 3);
  if (!name) return null;
  const title = `${start}${name} · ${tail}`;
  return title.length <= max && !titleTokenFailures(title, { price: p, max }).length ? title : null;
}
export function titleTokenFailures(value, { price, max = 50 } = {}) {
  const title = cleanTitleText(value), errors = [];
  if (!title) errors.push('TITLE_EMPTY');
  if (title.length > max) errors.push('TITLE_TOO_LONG');
  if (/(?:[·,]|\s)\s*\d[\d,]*(?:\.)?$/.test(title) || /[→·,]$/.test(title)) errors.push('TITLE_TOKEN_BROKEN');
  if (price != null && !title.includes(`${Number(price).toLocaleString('ko-KR')}원`)) errors.push('TITLE_PRICE_MISSING');
  return [...new Set(errors)];
}

// This cafe is for shopping deals. Words such as "discount" or "benefit"
// in a government article are not evidence of a shopping offer.
export function shoppingScope(item) {
  const c = item?.copyContext || {};
  if (c.kind === 'hotdeal') {
    return item.type === 'hotdeal' && Boolean(c.product && item.buyUrl) &&
      Number.isFinite(c.price) && c.price > 0;
  }
  if (c.kind === 'comparison') {
    return Array.isArray(item.componentItems) && item.componentItems.length >= 2 &&
      item.componentItems.every(x => x.copyContext?.kind === 'hotdeal' && shoppingScope(x));
  }
  // Coupon/card offers need a dedicated shopping-terms verifier before enabling.
  // Never substitute general services, insurance, policy articles or AI drafts.
  return false;
}

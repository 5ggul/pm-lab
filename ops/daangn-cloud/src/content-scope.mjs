// Shopping deals plus reviewed, source-verified household savings benefits.
// Generic articles and drafts remain outside the automatic publishing scope.
import { familyCategory } from './shopping-offers.mjs';
import { savingsBenefitScope } from './savings-benefits.mjs';
export function shoppingScope(item) {
  const c = item?.copyContext || {};
  if (c.kind === 'benefit') return savingsBenefitScope(item);
  if (c.kind === 'hotdeal') {
    return item.type === 'hotdeal' && Boolean(c.product && item.buyUrl && familyCategory(c.product)) &&
      Number.isFinite(c.price) && c.price > 0;
  }
  if (c.kind === 'comparison') {
    return Array.isArray(item.componentItems) && item.componentItems.length >= 2 &&
      item.componentItems.every(x => x.copyContext?.kind === 'hotdeal' && shoppingScope(x));
  }
  // General services, policy articles and AI drafts do not qualify as savings.
  return false;
}

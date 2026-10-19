// Verified household savings content only.
// This scope includes merchant-verified deals plus reviewed official services
// and separately reviewed official household briefs. Generic articles, tips
// without evidence, and unreviewed policy drafts remain blocked.
import { familyCategory } from './shopping-offers.mjs';
import { savingsBenefitScope } from './savings-benefits.mjs';

const isHttpUrl = value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
};

function verifiedClaims(context = {}, minimum = 2) {
  return Array.isArray(context.claims) && context.claims.length >= minimum &&
    context.claims.every(claim =>
      claim?.verified === true &&
      typeof claim.value === 'string' && claim.value.trim().length >= 8 &&
      isHttpUrl(claim.sourceUrl)
    );
}

function verifiedUtilityBase(item) {
  const c = item?.copyContext || {};
  return item?.type === 'tip' &&
    Number(item?.trustScore || 0) >= 95 &&
    item?.verification?.status === 'verified' &&
    isHttpUrl(item.sourceUrl) &&
    typeof c.sourceTitle === 'string' && c.sourceTitle.trim().length >= 5 &&
    typeof c.category === 'string' && c.category.trim().length >= 2 &&
    typeof c.readerNeed === 'string' && c.readerNeed.trim().length >= 5 &&
    typeof c.editorialAngle === 'string' && c.editorialAngle.trim().length >= 5 &&
    Array.isArray(c.facts) && c.facts.length >= 2 &&
    Array.isArray(c.requiredFacts) && c.requiredFacts.length >= 2 &&
    verifiedClaims(c, 2);
}

function reviewedServiceScope(item) {
  const c = item?.copyContext || {};
  return c.kind === 'service' &&
    verifiedUtilityBase(item) &&
    item.verification?.method === 'reviewed_facts_and_source_evidence' &&
    typeof item.sourceId === 'string' && item.sourceId.length >= 3 &&
    typeof item.contentVersion === 'string' && item.contentVersion.length >= 8;
}

function researchedBriefScope(item, now = new Date()) {
  const c = item?.copyContext || {};
  let host = '';
  try { host = new URL(item.sourceUrl).hostname; } catch {}
  const observed = Date.parse(item?.verification?.observedAt || '');
  const expires = Date.parse(item?.expiresAt || '');
  return c.kind === 'researched' &&
    verifiedUtilityBase(item) &&
    host === 'www.korea.kr' &&
    item.reviewRevision === 3 &&
    item.verification?.method === 'official_source_evidence_and_separate_ai_review' &&
    typeof item.sourceTextHash === 'string' && item.sourceTextHash.length === 64 &&
    Number.isFinite(observed) && observed <= now.getTime() + 60000 &&
    now.getTime() - observed <= 24 * 3600e3 &&
    Number.isFinite(expires) && expires > now.getTime();
}

function verifiedDigestScope(item, now = new Date()) {
  const c = item?.copyContext || {};
  return c.kind === 'digest' &&
    item?.type === 'tip' &&
    item?.verification?.status === 'verified' &&
    item?.verification?.method === 'verified_components' &&
    Array.isArray(item.componentItems) && item.componentItems.length >= 3 &&
    item.componentItems.every(component => {
      const kind = component?.copyContext?.kind;
      if (kind === 'benefit') return savingsBenefitScope(component, now);
      if (kind === 'service') return reviewedServiceScope(component);
      if (kind === 'researched') return researchedBriefScope(component, now);
      return false;
    }) &&
    verifiedClaims(c, 3);
}

export function shoppingScope(item, now = new Date()) {
  const c = item?.copyContext || {};
  if (c.kind === 'benefit') return savingsBenefitScope(item, now);
  if (c.kind === 'service') return reviewedServiceScope(item);
  if (c.kind === 'researched') return researchedBriefScope(item, now);
  if (c.kind === 'digest') return verifiedDigestScope(item, now);
  if (c.kind === 'hotdeal') {
    return item.type === 'hotdeal' && Boolean(c.product && item.buyUrl && familyCategory(c.product)) &&
      Number.isFinite(c.price) && c.price > 0;
  }
  if (c.kind === 'comparison') {
    return Array.isArray(item.componentItems) && item.componentItems.length >= 2 &&
      item.componentItems.every(x => x.copyContext?.kind === 'hotdeal' && shoppingScope(x, now));
  }
  return false;
}

export const communityContentScope = shoppingScope;

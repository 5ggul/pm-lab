import { fetchText, verifyMerchantPrice } from './collectors.mjs';
import { serviceFromSource, readableSource } from './editorial-sources.mjs';
import { parseArticle } from './research-supply.mjs';
import { createHash } from 'node:crypto';
import { readShoppingOffer } from './shopping-offers.mjs';
import { recheckSavingsBenefit } from './savings-benefits.mjs';
import { ELEVEN_TIMEDEAL_URL, ELEVEN_TIMEDEAL_METHOD, verifyOfficialTimeDeal } from './official-timedeal.mjs';
import { CJ_MARKET_METHOD, verifyCjOfficialDetail } from './official-cj.mjs';

export async function recheckItem(item, registry, fetcher = fetchText) {
  try {
    if (item.copyContext?.kind === 'benefit') return await recheckSavingsBenefit(item, fetcher);
    if (item.componentItems) {
      for (const component of item.componentItems) {
        const result = await recheckItem(component, registry, fetcher);
        if (!result.ok) return result;
      }
      return { ok: true };
    }
    if (item.copyContext?.kind === 'hotdeal' &&
        item.verification?.method === ELEVEN_TIMEDEAL_METHOD) {
      // Listing-based claims must be checked against the exact same official
      // source immediately before publishing. Never silently use a product
      // page, cached offer, redirect, or stale listing as a substitute.
      const page = await fetcher(ELEVEN_TIMEDEAL_URL, 25000, 1);
      if (page.url !== ELEVEN_TIMEDEAL_URL) {
        return { ok: false, reason: 'timedeal_evidence_redirected' };
      }
      return verifyOfficialTimeDeal(item, page.text, new Date());
    }
    if (item.copyContext?.kind === 'hotdeal' &&
        item.verification?.method === CJ_MARKET_METHOD) {
      const page = await fetcher(item.buyUrl, 20000, 1);
      return verifyCjOfficialDetail(item, page.text, page.url);
    }
    const page = await fetcher(item.buyUrl || item.sourceUrl, 12000, 1);
    const kind = item.copyContext.kind;
    if (kind === 'hotdeal' && item.verification?.method === 'shopping_offer_v1') {
      const fresh = readShoppingOffer(page.text, page.url || item.buyUrl, { product: item.copyContext.product, price: item.copyContext.price });
      return { ok: fresh.ok && fresh.fingerprint === item.verification.fingerprint, reason: fresh.ok ? 'shopping_conditions_changed' : fresh.reason };
    }
    if (kind === 'researched') {
      if (item.reviewRevision !== 3) return { ok: false, reason: 'review_revision_expired' };
      const article = parseArticle(page.url, page.text);
      const hash = article && createHash('sha256').update(article.text.replace(/\s+/g, ' ').trim()).digest('hex');
      return { ok: Boolean(article && hash === item.sourceTextHash), reason: 'article_changed_since_review' };
    }
    if (kind === 'service') {
      const entry = registry.find(x => x.id === item.sourceId);
      const fresh = entry && serviceFromSource(entry, page.text);
      return { ok: Boolean(fresh && fresh.contentVersion === item.contentVersion), reason: 'service_evidence_changed' };
    }
    if (kind === 'hotdeal') {
      const checked = verifyMerchantPrice(page.text, item.copyContext);
      if (checked.ok && item.copyContext.deliveredPrice !== item.copyContext.price + checked.shippingCost) return { ok: false, reason: 'shipping_changed' };
      return checked;
    }
    const text = readableSource(page.text);
    // Policy/member/event sources require their exact approved evidence again.
    const evidence = item.recheckEvidence || [];
    return { ok: evidence.length > 0 && evidence.every(x => text.includes(x)), reason: 'source_evidence_missing_or_changed' };
  } catch (error) { return { ok: false, reason: 'recheck_failed:' + String(error.message).slice(0, 100) }; }
}

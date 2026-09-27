import { fetchText, verifyMerchantPrice } from './collectors.mjs';
import { serviceFromSource, readableSource } from './editorial-sources.mjs';

export async function recheckItem(item, registry, fetcher = fetchText) {
  try {
    if (item.componentItems) {
      for (const component of item.componentItems) {
        const result = await recheckItem(component, registry, fetcher);
        if (!result.ok) return result;
      }
      return { ok: true };
    }
    const page = await fetcher(item.buyUrl || item.sourceUrl, 12000, 1);
    const kind = item.copyContext.kind;
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

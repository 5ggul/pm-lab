import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { fetchText } from './collectors.mjs';

const hash = s => createHash('sha256').update(s).digest('hex');
export function readableSource(html) {
  const $ = cheerio.load(html);
  $('script,style,nav,header,footer').remove();
  const alt = $('img[alt]').map((_, el) => $(el).attr('alt')).get().join(' ');
  return ($('body').text() + ' ' + alt).replace(/\s+/g, ' ').trim();
}
export function serviceFromSource(entry, html, now = new Date()) {
  const text = readableSource(html);
  const evidence = [...entry.facts.flatMap(f => f.evidence), ...(entry.conditionEvidence || [])];
  if (!evidence.every(e => text.includes(e))) return null;
  const facts = entry.facts.map(x => x.text);
  const conditions = entry.conditions || [];
  return {
    id: 'service:' + entry.id, contentVersion: hash(JSON.stringify([facts, conditions])).slice(0, 16),
    sourceUrl: entry.url, sourceId: entry.id, type: 'tip', board: '💰 꿀팁 공유', title: entry.title,
    trustScore: 98, expiresAt: null, imageUrl: '',
    verification: { status: 'verified', observedAt: now.toISOString(), method: 'reviewed_facts_and_source_evidence', sourceUrl: entry.url },
    copyContext: {
      kind: 'service', intent: 'PUBLIC_SERVICE', sourceTitle: entry.title, facts, requiredFacts: facts, conditions, requiredConditions: conditions,
      category: entry.category, readerNeed: entry.readerNeed, editorialAngle: entry.editorialAngle, shareRecipient: entry.shareRecipient,
      returnReason: entry.returnReason, seriesId: entry.seriesId, url: entry.url,
      claims: [...facts, ...conditions].map((value, i) => ({ key: 'fact_' + i, value, sourceUrl: entry.url, verified: true, confidence: 0.95, observedAt: now.toISOString() }))
    }
  };
}
export async function collectServices(registry, fetcher = fetchText) {
  const out = [];
  for (const entry of registry) {
    try {
      const page = await fetcher(entry.url, 12000, 1);
      if (new URL(page.url).hostname !== new URL(entry.url).hostname) continue;
      const item = serviceFromSource(entry, page.text);
      if (item) out.push(item);
    } catch (error) {
      console.log(JSON.stringify({ stage: 'service-source-unavailable', id: entry.id, reason: String(error.message).slice(0, 120) }));
    }
  }
  return out;
}

// Only compare offers with an explicitly verified product/variant identity,
// known delivered totals, and identical eligibility. Never match by title alone.
export function buildComparisons(items, now = new Date()) {
  const groups = new Map();
  for (const item of items) {
    const c = item.copyContext || {};
    if (item.verification?.status !== 'verified' || !c.productIdentityVerified || !c.productIdentity || !c.quantityVerified || !(c.unitInfo?.count > 0) || !Number.isFinite(c.deliveredPrice) || !c.eligibilityKey) continue;
    const key = [c.productIdentity, c.unitInfo.unit, c.eligibilityKey].join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const out = [];
  for (const [key, offers] of groups) {
    const unique = [...new Map(offers.map(x => [x.sourceUrl, x])).values()];
    if (unique.length < 2) continue;
    unique.sort((a, b) => a.copyContext.deliveredPrice / a.copyContext.unitInfo.count - b.copyContext.deliveredPrice / b.copyContext.unitInfo.count);
    const chosen = [unique[0], unique.at(-1)];
    const facts = chosen.map(x => {
      const c = x.copyContext;
      return `${c.merchant || new URL(x.sourceUrl).hostname} ${c.unitInfo.count}${c.unitInfo.unit}, 배송 포함 ${c.deliveredPrice.toLocaleString('ko-KR')}원 · ${c.unitInfo.unit}당 약 ${Math.round(c.deliveredPrice / c.unitInfo.count).toLocaleString('ko-KR')}원`;
    });
    const ctx = chosen[0].copyContext;
    const conditions = [...new Set(chosen.flatMap(x => x.copyContext.requiredConditions || x.copyContext.conditions || []))];
    const urls = chosen.map(x => x.sourceUrl);
    out.push({
      id: 'comparison:' + hash(key), sourceUrl: urls[0], sourceUrls: urls, type: 'tip', board: '💰 꿀팁 공유', trustScore: 98,
      contentVersion: hash(JSON.stringify(facts)).slice(0, 16), componentItems: chosen,
      verification: { status: 'verified', observedAt: now.toISOString(), method: 'verified_identical_product_arithmetic' },
      copyContext: { kind: 'comparison', intent: 'UNIT_COMPARISON', sourceTitle: `${ctx.product}, 배송비까지 넣고 단가 비교`,
        category: '생활비 비교', facts, requiredFacts: facts, conditions, requiredConditions: conditions, url: urls[0], sourceUrls: urls,
        readerNeed: '같은 제품의 배송 포함 단가 비교', editorialAngle: '동일 상품·옵션·자격 조건에서 수량별 단가 계산',
        shareRecipient: '같은 제품을 장보는 가족', returnReason: '생활비 비교 연재', seriesId: 'basket-comparison',
        claims: facts.map((value, i) => ({ key: 'comparison_' + i, value, verified: true, sourceUrl: urls[i], observedAt: now.toISOString() })) }
    });
  }
  return out;
}

export function buildDigest(items, day, now = new Date()) {
  const components = items.filter(x => x.editorialPlan?.status === 'eligible' && ['service', 'event'].includes(x.copyContext?.kind)).slice(0, 3);
  if (components.length < 3) return null;
  const facts = components.map(x => `${x.copyContext.name || x.copyContext.sourceTitle}: ${x.copyContext.facts?.[0] || [x.copyContext.region, x.copyContext.start + '~' + x.copyContext.end, x.copyContext.cost].join(' · ')}`);
  const conditions = [...new Set(components.flatMap(x => x.copyContext.requiredConditions || []))];
  return {
    id: 'digest:' + day, sourceUrl: components[0].sourceUrl, sourceUrls: components.map(x => x.sourceUrl), componentItems: components,
    type: 'tip', board: '💰 꿀팁 공유', trustScore: 98, expiresAt: day,
    verification: { status: 'verified', observedAt: now.toISOString(), method: 'verified_components' },
    copyContext: { kind: 'digest', intent: 'WEEKLY_SELECTION', sourceTitle: '생활에 쓸 만한 공공서비스와 나들이 정보 모음',
      facts, requiredFacts: facts, conditions, requiredConditions: conditions, sourceUrls: components.map(x => x.sourceUrl), url: components[0].sourceUrl,
      category: '생활정보 모음', readerNeed: '흩어진 생활정보를 대상과 조건에 맞게 선택', editorialAngle: '검증된 서로 다른 정보의 대상과 조건을 한 번에 비교',
      shareRecipient: '주말과 생활 일정을 함께 정하는 가족', returnReason: '생활정보 모음 연재', seriesId: 'weekly-selection',
      claims: facts.map((value, i) => ({ key: 'digest_' + i, value, sourceUrl: components[i].sourceUrl, verified: true, observedAt: now.toISOString() })) }
  };
}

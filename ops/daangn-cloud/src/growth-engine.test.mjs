import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { planItem, slotFor, slotDecision, chooseItem, contentKey, communitySnapshot, growthReport, growthCopyFailures, parseCommunityMembers } from './growth-engine.mjs';
import { serviceFromSource, buildComparisons, buildDigest } from './editorial-sources.mjs';
import { selectCommunityCopy, validateGeneratedCopy } from './copy-engine.mjs';
import { runReservedPublish, persistJournal } from './publish-journal.mjs';
import { verifyMerchantPrice, canonicalSource } from './collectors.mjs';
import { recheckItem } from './source-recheck.mjs';
import os from 'node:os';
import path from 'node:path';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const registry = JSON.parse(await fs.readFile(new URL('../source-registry.json', import.meta.url)));
const now = new Date('2026-09-26T03:00:00Z');
const sourceHtml = entry => `<html><body>${entry.facts.flatMap(f => f.evidence).join(' ')} ${entry.conditionEvidence.join(' ')}</body></html>`;
const service = serviceFromSource(registry[0], sourceHtml(registry[0]), now);
assert.equal(serviceFromSource(registry[0], '<body>오류</body>', now), null);
service.editorialPlan = planItem(service, config, now);
assert.equal(service.editorialPlan.status, 'eligible');
const draft = selectCommunityCopy(service);
assert.equal(draft.copyRejected, false);
assert.ok(registry[0].conditions.every(x => draft.postBody.includes(x)));
assert.equal(validateGeneratedCopy(draft, draft.postTitle, draft.postBody).ok, true);
assert.ok(growthCopyFailures(service, { postTitle: '[지역] 행사', postBody: '' }).includes('unresolved_placeholder'));
assert.equal(planItem({ ...service, verification: { status: 'review' } }, config, now).status, 'review');
assert.ok(planItem({ ...service, expiresAt: '20260925' }, config, now).reasons.includes('expired'));
assert.ok(planItem({ ...service, verification: { ...service.verification, observedAt: '2026-09-20T00:00:00Z' } }, config, now).reasons.includes('source_stale'));
const event = { ...service, expiresAt: '20260929', copyContext: { ...service.copyContext, kind: 'event', name: '체험 행사', region: '서울특별시 종로구', start: '9/26', end: '9/29', cost: '무료' } };
assert.ok(planItem(event, config, now).reasons.includes('region_not_configured'));
assert.ok(planItem(event, { ...config, primaryRegions: ['부산'] }, now).reasons.includes('region_mismatch'));
assert.ok(!planItem(event, { ...config, primaryRegions: ['서울특별시'] }, now).reasons.includes('region_mismatch'));

const slot = slotFor(now, config);
assert.equal(slot, '2026-09-26@12');
assert.equal(slotFor(new Date('2026-09-25T22:00:00Z'), config), null);
for (const status of ['no_candidate', 'quality_or_category_skip', 'daily_cap', 'published', 'publishing', 'publish_unknown']) assert.equal(slotDecision({ [slot]: { status } }, slot, config).run, false);
assert.equal(slotDecision({ [slot]: { status: 'technical_failure', attempts: 1 } }, slot, config).run, true);
assert.equal(slotDecision({ [slot]: { status: 'technical_failure', attempts: 2 } }, slot, config).run, false);
assert.equal(chooseItem([service], [{ topic: service.copyContext.category }], [], config), null);
assert.equal(chooseItem([service], [], [{ type: 'tip' }, { type: 'tip' }], config), null);

let calls = 0, writes = 0;
const journal = {};
const params = { item: draft, key: contentKey(service), slot, journal, persist: async () => { writes++; }, publish: async () => { calls++; return { status: 'published', postUrl: 'https://example.com/post' }; }, now: () => now };
await runReservedPublish(params);
assert.equal(calls, 1); assert.equal(writes, 2);
assert.equal(journal[slot].record.title, draft.postTitle, 'recoverable record is durable with the success result');
await runReservedPublish({ ...params, slot: '2026-09-26@15' });
assert.equal(calls, 1, 'later slot must not repeat a confirmed reservation');
const unknown = {};
const uncertain = await runReservedPublish({ ...params, journal: unknown, publish: async () => { throw new Error('lost response'); } });
assert.equal(uncertain.status, 'publish_unknown');
await runReservedPublish({ ...params, journal: unknown, slot: '2026-09-26@18' });
assert.equal(calls, 1);
await assert.rejects(() => runReservedPublish({ ...params, journal: {}, persist: async () => { throw new Error('remote persist failed'); } }));
assert.equal(calls, 1, 'never submit without durable reservation');
const safeFail = await runReservedPublish({ ...params, journal: {}, publish: async () => { const e = new Error('editor unavailable'); e.beforeSubmit = true; throw e; } });
assert.equal(safeFail.status, 'technical_failure');

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daangn-journal-test-'));
try {
  await assert.rejects(() => persistJournal(path.join(temp, 'ledger.json'), {}, { env: { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main' } }), /AUTH_MISSING/);
  let put = 0;
  await persistJournal(path.join(temp, 'ledger.json'), {}, { env: { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'fixture/test' }, fetcher: async (_, req) => {
    if (req.method === 'PUT') { put++; return { ok: true }; }
    return { ok: false, status: 404 };
  } });
  assert.equal(put, 1);
} finally { await fs.rm(temp, { recursive: true }); }

const makeHtml = offer => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: '테스트 세제 2개', offers: offer })}</script>`;
const offer = { priceCurrency: 'KRW', price: 10000, availability: 'https://schema.org/InStock', shippingDetails: { shippingRate: { value: 0, currency: 'KRW' } } };
assert.equal(verifyMerchantPrice(makeHtml(offer), { product: '테스트 세제 2개', price: 10000 }).ok, true);
for (const change of [{ price: 11000 }, { priceCurrency: 'USD' }, { availability: 'https://schema.org/OutOfStock' }, { shippingDetails: null }]) assert.equal(verifyMerchantPrice(makeHtml({ ...offer, ...change }), { product: '테스트 세제 2개', price: 10000 }).ok, false);
assert.notEqual(canonicalSource('https://shop.test/item?id=1&utm_source=x'), canonicalSource('https://shop.test/item?id=2&utm_source=x'));

const comparable = (id, total, count) => ({ ...service, sourceUrl: `https://shop.test/${id}`, copyContext: { ...service.copyContext, product: '같은 세제', productIdentity: 'GTIN-variant', productIdentityVerified: true, quantityVerified: true, unitInfo: { count, unit: '개' }, deliveredPrice: total, eligibilityKey: 'all', merchant: id } });
const comparisons = buildComparisons([comparable('a', 11000, 2), comparable('b', 12000, 2)], now);
assert.equal(comparisons.length, 1);
assert.ok(comparisons[0].copyContext.facts[0].includes('5,500원'));
assert.equal(buildComparisons([comparable('a', 11000, 2), { ...comparable('b', 12000, 2), copyContext: { ...comparable('b', 12000, 2).copyContext, productIdentity: 'other' } }], now).length, 0);
assert.equal(buildDigest([service], '2026-09-26', now), null);
assert.equal((await recheckItem(service, registry, async () => ({ text: '<body>변경됨</body>' }))).ok, false);
assert.equal(communitySnapshot({ members: null }, now).members, null);
assert.equal(parseCommunityMembers('멤버  3 · 게시글  22'), 3);
assert.equal(parseCommunityMembers('멤버 1,234 · 게시글 5,678'), 1234);
assert.equal(parseCommunityMembers('멤버 · 게시글 22'), null);
assert.equal(parseCommunityMembers('다른 페이지'), null);
assert.equal(communitySnapshot({ members: 0 }, now).members, 0);
assert.equal(growthReport([], [], [], now).memberNetChange, null);
assert.equal(growthReport([], [], [communitySnapshot({ members: 10 }, new Date(now - 864e5)), communitySnapshot({ members: 13 }, now)], now).memberNetChange, 3);

// Thirty preflight cases across source changes and text variants. Tests use
// synthetic evidence, never publish it or pass it to the production collectors.
for (let i = 0; i < 30; i++) {
  const e = structuredClone(registry[i % registry.length]);
  const item = serviceFromSource(e, sourceHtml(e), now);
  item.editorialPlan = planItem(item, config, now);
  const copy = selectCommunityCopy(item);
  assert.equal(copy.copyRejected, false, `preflight ${i}`);
  assert.ok(e.facts.every(f => copy.postBody.includes(f.text)));
  assert.ok(e.conditions.every(f => copy.postBody.includes(f)));
}
console.log('growth engine, source validation, missing metrics and durable publish tests passed');

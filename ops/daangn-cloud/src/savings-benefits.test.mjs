import assert from 'node:assert/strict';
import { collectSavingsBenefits, savingsBenefitScope, recheckSavingsBenefit, renderSavingsBenefitCandidates, extractSavingsEvidence } from './savings-benefits.mjs';

const now = new Date('2026-09-30T03:00:00Z');
const forged = { type: 'tip', sourceUrl: 'https://example.com/refund', trustScore: 100, verification: { status: 'verified', method: 'reviewed_savings_benefit_v1', observedAt: now.toISOString() }, copyContext: { kind: 'benefit', benefitId: 'telecom-unclaimed-refund', benefitLines: ['누구나 100만원 환급'] } };
assert.equal(savingsBenefitScope(forged, now), false, 'a verified flag does not make an arbitrary offer eligible');
assert.deepEqual(renderSavingsBenefitCandidates(forged.copyContext), [], 'unreviewed money claims never render');
let fetched = false;
assert.equal((await recheckSavingsBenefit(forged, async () => { fetched = true; }, now)).ok, false);
assert.equal(fetched, false, 'reject unregistered candidates before requesting arbitrary URLs');

const unavailable = await collectSavingsBenefits({}, async () => { throw Error('HTTP 503'); }, now);
assert.equal(unavailable.items.length, 0);
assert.equal(unavailable.diagnostics.checked, 4);
assert.equal(unavailable.diagnostics.verified, 0);

// A 200 status with navigation text, an access notice, or a new amount is not evidence.
const changed = await collectSavingsBenefits({}, async url => ({ url, text: '<html><div class="contWrapper">통신비 90% 할인 누구나 100만원</div></html>' }), now);
assert.equal(changed.items.length, 0);
assert.ok(Object.keys(changed.diagnostics.skipped).every(key => key.startsWith('benefit_terms_changed')));
const redirected = await collectSavingsBenefits({}, async () => ({ url: 'https://example.com/', text: '<h1>Redirect</h1>' }), now);
assert.equal(redirected.items.length, 0);
assert.equal(redirected.diagnostics.skipped.benefit_source_redirected, 4);

const expired = await collectSavingsBenefits({}, async () => { throw Error('must not fetch expired registry'); }, new Date('2027-01-01T00:00:00Z'));
assert.equal(expired.diagnostics.skipped.benefit_review_expired, 4);
const recent = await collectSavingsBenefits({ published: [{ sourceId: 'telecom-unclaimed-refund', publishedAt: now.toISOString() }] }, async () => { throw Error('not available'); }, now);
assert.equal(recent.diagnostics.skipped.benefit_recently_published, 1);

assert.equal(extractSavingsEvidence('contract', '<div class="contWrapper">안내 25%<script>90%</script></div><nav>100만원</nav>'), '안내 25%');
assert.equal(extractSavingsEvidence('senior', '<div>기초연금 수급자 최대 12,100원</div>'), '', 'numbers outside the target benefit block are insufficient');
assert.equal(extractSavingsEvidence('infant', '<nav>지원대상 지원사항 담당부서 30% 16,000원</nav>'), '', 'navigation keywords cannot count as source evidence');
console.log('savings benefits checks passed');

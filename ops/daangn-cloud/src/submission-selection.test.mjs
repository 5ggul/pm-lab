import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseItem, isCommercialContent, isUtilityContent, kstDay, portfolioHistory } from './growth-engine.mjs';
import { submissionHistory } from './publish-journal.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../growth-config.json', import.meta.url), 'utf8'));
const at = '2026-10-20T02:00:00Z';
function deal() {
  return {
    id: 'synthetic-new', type: 'hotdeal', sourceUrl: 'https://shop.example/new', buyUrl: 'https://shop.example/new', sellerKey: 'new-seller',
    qualityScores: { finalScore: 96 }, verification: { status: 'verified' }, editorialPlan: { status: 'eligible', bucket: 'deal', score: 95 },
    copyContext: { kind: 'hotdeal', product: '검사용 물티슈 20팩', price: 23900, category: '생필품' }
  };
}
const utilityPost = (id, date = at) => ({ status: 'published', idempotencyKey: id, postUrl: `https://cafe.daangn.com/don-akkineun-sa/posts/${id}`, type: 'tip', contentKind: 'service', topic: `분야-${id}`, publishedAt: date });
const unknown = (id, startedAt = at) => ({ status: 'publish_unknown', key: id, title: `이전 제출 ${id}`, postUrl: `https://cafe.daangn.com/don-akkineun-sa/posts/${id}`, startedAt, sourceUrl: `https://shop.example/${id}` });

test('unclassified uncertain post does not count as a utility or a confirmed commercial post', () => {
  const history = submissionHistory([], { slot: unknown('old') });
  assert.equal(isCommercialContent(history[0]), false);
  assert.equal(isUtilityContent(history[0]), false);
  assert.equal(history[0].status, 'publish_unknown');
  assert.equal(history[0].publishedAt, undefined);
  assert.equal(chooseItem([deal()], history, history, config), null, 'uncertain recent submission cannot permit consecutive deals');
});
test('unknown submissions reserve possible commercial capacity without rewriting types', () => {
  const journal = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`s${i}`, unknown(`old${i}`, `2026-10-20T0${i}:00:00Z`)]));
  const history = submissionHistory([utilityPost('latest-service', '2026-10-20T03:30:00Z')], journal);
  assert.equal(history.length, 5);
  assert.equal(chooseItem([deal()], history, history, config), null, 'four uncertain earlier submissions reserve the commercial maximum');
  assert.equal(history.filter(row => row.status === 'published').length, 1);
});
test('mixed confirmed and unknown history cannot bypass the total daily cap', () => {
  const confirmed = Array.from({ length: 7 }, (_, i) => utilityPost(`confirmed${i}`));
  const history = submissionHistory(confirmed, { old: unknown('eighth') });
  assert.equal(history.length, 8);
  assert.equal(chooseItem([deal()], history, history, config), null);
  assert.equal(history.filter(row => row.status === 'published').length, 7);
});
test('the same confirmed URL in both ledgers occupies only one daily place', () => {
  const record = utilityPost('same');
  const history = submissionHistory([record], { slot: { status: 'published', key: 'same', record, postUrl: record.postUrl } });
  assert.equal(history.length, 1);
  assert.equal(chooseItem([deal()], history, history, config)?.id, 'synthetic-new');
});
test('KST day uses submission time without making an unknown publishedAt', () => {
  const history = submissionHistory([], {
    previous: unknown('previous', '2026-10-19T14:59:00Z'),
    current: unknown('current', '2026-10-19T15:01:00Z')
  });
  const today = history.filter(row => row.submittedAt && kstDay(new Date(row.submittedAt)) === '2026-10-20');
  assert.equal(today.length, 1);
  assert.equal(today[0].idempotencyKey, 'current');
  assert.equal(today[0].publishedAt, undefined);
});

test('missing legacy types never masquerade as utility portfolio observations', () => {
  const unknownRows = Array.from({ length: 15 }, (_, i) => ({ status: 'publish_unknown', title: `원문 ${i}` }));
  const known = [utilityPost('known-utility'), { status: 'publish_unknown', contentKind: 'hotdeal' }];
  assert.deepEqual(portfolioHistory([...known, ...unknownRows]), { total: 2, counts: { utility: 1, deal: 1 } });
  assert.deepEqual(portfolioHistory(unknownRows), { total: 0, counts: {} });
});

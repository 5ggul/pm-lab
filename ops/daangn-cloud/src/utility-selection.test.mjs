import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { chooseUtility, isUtilityItem } from './utility-selection.mjs';
import { chooseItem } from './growth-engine.mjs';

// Synthetic verified-source fixtures: these are not publishable offers.
const config = {
  minCopyQuality: 74,
  topicDailyMax: 2,
  categoryDailyCaps: {},
  burstMinCopyQuality: 88,
  burstMinEditorialScore: 85,
  burstRequireVerified: true
};
function service(id, quality = 90, category = '도서관 이용') {
  const url = `https://official.example/${id}`;
  const facts = [`${id} 서비스의 참여 기관은 공식 목록에 있습니다.`, '기관별 이용 조건은 방문 전에 확인해야 합니다.'];
  return {
    id, type: 'tip', trustScore: 100, sourceUrl: url, sourceId: `source-${id}`, contentVersion: `fixture-${id}`,
    verification: { status: 'verified', method: 'reviewed_facts_and_source_evidence' },
    editorialPlan: { status: 'eligible', score: 90, seriesId: `series-${id}` },
    qualityScores: { finalScore: quality },
    copyMeta: { surfaceFamily: `surface-${id}` },
    copyContext: { kind: 'service', sourceTitle: `${id} 공식 서비스 이용 방법`, category, readerNeed: '대상 서비스를 이용할 수 있는지 확인', editorialAngle: '대상 기관과 이용 조건을 함께 확인', facts, requiredFacts: facts, claims: facts.map(value => ({ value, sourceUrl: url, verified: true })) }
  };
}
function historyFor(item) {
  return { contentKind: item.copyContext.kind, topic: item.copyContext.category, editorialPlan: item.editorialPlan, copyMeta: item.copyMeta };
}

test('utility novelty can outweigh a one-point quality difference', () => {
  const repeat = service('repeat', 91), fresh = service('fresh', 90, '공공시설 이용');
  assert.equal(chooseUtility([repeat, fresh], [historyFor(repeat)], [], {}, config).id, 'fresh');
});
test('quality still ranks otherwise equally novel candidates', () => {
  assert.equal(chooseUtility([service('lower', 78), service('higher', 94)], [], [], {}, config).id, 'higher');
});
test('low or missing copy quality cannot buy entry through diversity', () => {
  const low = service('low', 73), missing = service('missing');
  delete missing.qualityScores;
  assert.equal(chooseUtility([low, missing], [], [], {}, config), null);
});
test('burst slots preserve stronger copy and editorial requirements', () => {
  const normal = service('normal', 87), weakEditorial = service('weak', 94), excellent = service('excellent', 90);
  weakEditorial.editorialPlan.score = 84;
  assert.equal(chooseUtility([normal, weakEditorial], [], [], {}, config, true), null);
  assert.equal(chooseUtility([normal, weakEditorial, excellent], [], [], {}, config, true).id, 'excellent');
});
test('unverified or review-only utility remains blocked', () => {
  const unverified = service('unverified'), review = service('review');
  unverified.verification.status = 'unverified';
  review.editorialPlan.status = 'review';
  assert.equal(chooseUtility([unverified, review], [], [], {}, config), null);
});
test('category cap includes uncertain submissions that consumed that category', () => {
  const item = service('capped');
  const today = [{ ...historyFor(item), status: 'publish_unknown' }];
  assert.equal(chooseUtility([item], [], today, {}, { ...config, categoryDailyCaps: { '도서관 이용': 1 } }), null);
});
test('explicit uncapped category stays uncapped while zero disables it', () => {
  const item = service('uncapped'), today = Array.from({ length: 3 }, () => historyFor(item));
  assert.equal(chooseUtility([item], [], today, {}, { ...config, categoryDailyCaps: { '도서관 이용': null } }).id, 'uncapped');
  assert.equal(chooseUtility([item], [], [], {}, { ...config, categoryDailyCaps: { '도서관 이용': 0 } }), null);
});
test('tip limit applies across utility and commercial pipelines', () => {
  const item = service('sixth', 94);
  const today = Array.from({ length: 5 }, (_, i) => ({ type: 'tip', contentKind: 'service', topic: `different-${i}`, status: 'published' }));
  assert.equal(chooseUtility([item], [], today, {}, { ...config, typeCaps: { tip: 5 } }, true), null);
  assert.equal(chooseUtility([item], [], today, {}, { ...config, typeCaps: { tip: null } }, true).id, 'sixth');
  assert.equal(chooseUtility([item], [], [], {}, { ...config, typeCaps: { tip: 0 } }), null);
});
test('missing legacy submission types cannot bypass a type cap', () => {
  assert.equal(chooseUtility([service('blocked')], [], [{ status: 'publish_unknown' }], {}, { ...config, typeCaps: { tip: 1 } }), null);
});
test('both publisher paths count unknown submissions toward the configured type cap', () => {
  const liveConfig = JSON.parse(fs.readFileSync(new URL('../growth-config.json', import.meta.url), 'utf8'));
  const tipCap = liveConfig.typeCaps?.tip;
  assert.ok(Number.isSafeInteger(tipCap) && tipCap > 1, 'live tip cap must be a positive finite integer for this regression');
  const item = service('cross-path', 96);
  item.editorialPlan.bucket = 'utility';
  const today = [
    ...Array.from({ length: tipCap - 1 }, () => ({ status: 'publish_unknown' })),
    { status: 'published', type: 'tip', contentKind: 'service', topic: '다른 분야' }
  ];
  assert.equal(chooseItem([item], today, today, liveConfig), null);
  assert.equal(chooseUtility([item], today, today, {}, liveConfig, true), null);
  const earlierToday = today.slice(1);
  assert.equal(chooseItem([item], earlierToday, earlierToday, liveConfig)?.id, item.id);
  assert.equal(chooseUtility([item], earlierToday, earlierToday, {}, liveConfig, true)?.id, item.id);
});
test('stored contentKind is recognized without fabricating copyContext', () => {
  assert.equal(isUtilityItem({ contentKind: 'service', status: 'publish_unknown' }), true);
  assert.equal(isUtilityItem({ status: 'publish_unknown' }), false);
  assert.equal(isUtilityItem({ contentKind: 'hotdeal' }), false);
});
test('selection never substitutes a deal when verified utility is unavailable', () => {
  assert.equal(chooseUtility([{ ...service('deal'), copyContext: { kind: 'hotdeal' } }], [], [], {}, config), null);
});
test('paused card content cannot pass the utility selector with forged tip metadata', () => {
  const paused = service('card-autopay', 99, '카드·자동납부');
  paused.board = '💰 꿀팁 공유';
  paused.topicFamily = 'utility';
  paused.contentRoute = { family: 'utility', type: 'tip', board: '💰 꿀팁 공유' };
  const allowed = service('library', 90);
  const before = JSON.stringify(paused);
  assert.equal(chooseUtility([paused], [], [], {}, config), null);
  assert.equal(chooseUtility([paused, allowed], [], [], {}, config), allowed);
  assert.equal(JSON.stringify(paused), before);
});
test('ranking does not mutate configuration, drafts, or historical records', () => {
  const item = service('unchanged'), recent = [historyFor(item)], today = [];
  const before = JSON.stringify({ item, recent, today, config });
  chooseUtility([item], recent, today, {}, config);
  assert.equal(JSON.stringify({ item, recent, today, config }), before);
});

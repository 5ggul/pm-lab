import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { capReached, configuredCap, publicationPacing, volumeSummary } from './volume-policy.mjs';
import { chooseItem, slotFor, slotDecision, planItem, isCommercialContent, isUtilityContent } from './growth-engine.mjs';
import { runReservedPublish } from './publish-journal.mjs';
import { clockSlot, runClock } from '../../daangn-clock/clock.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const now = new Date('2026-10-14T12:07:00+09:00');

function commercial(id = 'new-product', score = 88, category = '생필품', sellerKey = 'seller-a') {
  const sourceUrl = 'https://shop.example.test/products/' + id;
  return {
    id,
    type: 'hotdeal',
    sourceUrl,
    buyUrl: sourceUrl,
    sellerKey,
    price: 23900,
    trustScore: 96,
    postTitle: '검사 전용 물티슈 20팩 · 23,900원',
    postBody: '실제 발행하지 않는 합성 검사 입력',
    qualityScores: { finalScore: score },
    editorialPlan: { status: 'eligible', bucket: 'deal', score: 95 },
    verification: { status: 'verified', observedAt: now.toISOString() },
    expiresAt: '2026-10-26T23:59:00+09:00',
    copyContext: {
      kind: 'hotdeal',
      currentOffer: true,
      product: '베베숲 물티슈 70매 캡 20팩',
      category,
      price: 23900,
      referencePrice: 34130,
      referenceLabel: '판매처 할인 전 표시가',
      saving: 10230,
      merchant: '합성판매처',
      buyUrl: sourceUrl,
      shipping: '기본배송 무료 (제주·도서산간 조건 별도)',
      delivery: { total: 23900, scope: 'base' },
      requiredConditions: ['즉시할인가 · 카드할인·적립금 제외'],
      returnReason: '생활비 정보 확인',
      claims: [
        { verified: true, sourceUrl, value: 23900 },
        { verified: true, sourceUrl, value: 34130 }
      ]
    }
  };
}

function utility(id = 'library', score = 86, category = '도서관 이용') {
  const sourceUrl = `https://official.example.test/${id}`;
  const item = {
    id: 'service:' + id,
    sourceId: id,
    sourceUrl,
    contentVersion: '1234567890abcdef',
    type: 'tip',
    board: '💰 꿀팁 공유',
    trustScore: 98,
    postTitle: '도서관 회원증 하나로 여러 곳에서 대출 가능',
    postBody: '참여도서관은 회원증 하나로 이용할 수 있어요.\n\n모든 도서관이 아니라 참여도서관만 해당됩니다.\n\n' + sourceUrl,
    qualityScores: { finalScore: score },
    verification: {
      status: 'verified',
      observedAt: now.toISOString(),
      method: 'reviewed_facts_and_source_evidence'
    },
    copyContext: {
      kind: 'service',
      intent: 'PUBLIC_SERVICE',
      sourceTitle: '도서관 회원증 하나로 여러 곳에서 대출 가능',
      category,
      readerNeed: '책을 사기 전에 가까운 도서관 이용 가능 여부 확인',
      editorialAngle: '통합회원증 적용 도서관과 이용 조건 구분',
      shareRecipient: '여러 도서관을 이용하는 가족',
      returnReason: '생활에 쓰는 공공서비스 안내',
      facts: [
        '참여도서관은 회원증 하나로 이용할 수 있어요.',
        '참여도서관 목록은 공식 홈페이지에서 볼 수 있습니다.'
      ],
      requiredFacts: [
        '참여도서관은 회원증 하나로 이용할 수 있어요.',
        '참여도서관 목록은 공식 홈페이지에서 볼 수 있습니다.'
      ],
      conditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
      requiredConditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
      url: sourceUrl,
      claims: [
        { value: '참여도서관은 회원증 하나로 이용할 수 있어요.', verified: true, sourceUrl },
        { value: '참여도서관 목록은 공식 홈페이지에서 볼 수 있습니다.', verified: true, sourceUrl }
      ]
    }
  };
  item.editorialPlan = planItem(item, config, now);
  return item;
}

const post = (kind, topic, sellerKey = '') => ({
  status: 'published',
  type: kind === 'commercial' ? 'hotdeal' : 'tip',
  contentKind: kind === 'commercial' ? 'hotdeal' : 'service',
  topic,
  sellerKey,
  sourceStore: sellerKey,
  publishedAt: new Date(+now - 2 * 3600000).toISOString()
});

test('VOL-01 generic cap helpers preserve explicit null, zero and numeric caps', () => {
  assert.equal(capReached(50, null), false);
  assert.equal(capReached(0, 0), true);
  assert.equal(capReached(4, 5), false);
  assert.equal(capReached(5, 5), true);
  assert.equal(configuredCap(null, 5), null);
  assert.equal(configuredCap(0, 5), 0);
  assert.equal(configuredCap(undefined, 5), 5);
});

test('VOL-02 invalid cap or count fails closed', () => {
  for (const limit of [undefined, -1, NaN, Infinity, '5', false]) assert.equal(capReached(5, limit), true);
  assert.equal(capReached(-1, null), true);
});

test('VOL-03 production portfolio is five total with maximum two commercial and three utility targets', () => {
  assert.equal(config.dailyMax, 5);
  assert.equal(config.commercialDailyMax, 2);
  assert.equal(config.utilityDailyTarget, 3);
  assert.equal(config.maxConsecutiveCommercial, 1);
  assert.equal(config.typeCaps.hotdeal, 2);
  assert.equal(config.typeCaps.tip, 3);
  assert.equal(config.publishingMode, 'balanced-mix');
});

test('VOL-04 third commercial post is blocked even when quality is high', () => {
  const today = [
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '도서관 이용'),
    post('commercial', '생필품', 'seller-2')
  ];
  assert.equal(chooseItem([commercial('third', 99, '육아·아동', 'seller-3')], today, today, config), null);
});

test('VOL-05 one consecutive commercial post forces verified utility next', () => {
  const recent = [
    post('commercial', '먹거리·장보기', 'seller-1')
  ];
  const util = utility();
  assert.equal(chooseItem([commercial('deal', 99, '주방·살림', 'seller-2'), util], recent, [], config), util);
});

test('VOL-06 final daily slot is reserved for third utility post', () => {
  const today = [
    post('utility', '도서관 이용'),
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '공공시설 이용'),
    post('commercial', '생필품', 'seller-2')
  ];
  const util = utility('public-facility', 87, '육아·시니어 혜택');
  assert.equal(chooseItem([commercial('deal', 99, '주방·살림', 'seller-3'), util], today, today, config), util);
});

test('VOL-07 commercial content remains selectable before its cap when utility slots are still available', () => {
  const today = [post('utility', '도서관 이용')];
  const recent = [post('commercial', '먹거리·장보기', 'seller-1'), post('utility', '도서관 이용')];
  const deal = commercial('allowed', 90, '생필품', 'seller-2');
  assert.equal(chooseItem([deal, utility('other', 85, '공공시설 이용')], recent, today, config), deal);
});

test('VOL-08 daily cap blocks all additional content', () => {
  const today = [
    post('utility', '도서관 이용'),
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '공공시설 이용'),
    post('commercial', '생필품', 'seller-2'),
    post('utility', '환급·숨은돈')
  ];
  assert.equal(chooseItem([commercial('extra'), utility('extra')], today, today, config), null);
});

test('VOL-09 quality and source gates still block filler content', () => {
  const low = commercial('low', config.minCopyQuality - 1, '생필품', 'seller-low');
  const review = { ...commercial('review'), editorialPlan: { status: 'review', bucket: 'deal', score: 99 } };
  assert.equal(chooseItem([low, review], [], [], config), null);
  const missing = commercial('missing');
  missing.copyContext.claims = [];
  const plan = planItem(missing, config, now);
  assert.equal(plan.status, 'review');
  assert.ok(plan.reasons.includes('claim_not_verified'));
});

test('VOL-10 quality wins before learning and diversity tie breakers', () => {
  const strong = commercial('strong', 90, '생필품', 'seller-a');
  const weaker = commercial('weaker', 85, '주방·살림', 'seller-b');
  assert.equal(chooseItem([weaker, strong], [], [], config, item => item === weaker ? 100 : 0), strong);
});

test('VOL-11 equal-quality ties prefer a fresh category and seller', () => {
  const repeated = commercial('repeated', 88, '생필품', 'seller-a');
  const fresh = commercial('fresh', 88, '주방·살림', 'seller-b');
  const recent = [post('commercial', '생필품', 'seller-a'), post('utility', '도서관 이용')];
  assert.equal(chooseItem([repeated, fresh], recent, [], config), fresh);
});

test('VOL-12 commercial clock exposes only 12 and 18 KST slots', () => {
  assert.deepEqual(config.slotHoursKst, [12, 18]);
  for (let hour = 0; hour < 24; hour += 1) {
    const time = new Date(`2026-10-14T${String(hour).padStart(2, '0')}:07:00+09:00`);
    const expected = config.slotHoursKst.includes(hour) ? `2026-10-14@${hour}` : null;
    assert.equal(slotFor(time, config), expected);
    assert.equal(clockSlot(+time, config), expected);
  }
  assert.deepEqual(config.utilitySlotHoursKst, [9, 15, 21]);
});

test('VOL-13 pacing blocks rapid publication then releases exactly when due', () => {
  const published = [{ status: 'published', publishedAt: '2026-10-14T11:50:00+09:00' }];
  const wait = publicationPacing(published, {}, config, now);
  assert.equal(wait.run, false);
  assert.equal(wait.nextEligibleAt, '2026-10-14T03:20:00.000Z');
  assert.equal(publicationPacing(published, {}, config, new Date('2026-10-14T12:20:00+09:00')).run, true);
});

test('VOL-14 uncertain submissions count for pacing and malformed active history fails closed', () => {
  assert.equal(publicationPacing([], { s: { status: 'publish_unknown', finishedAt: '2026-10-14T12:00:00+09:00' } }, config, now).run, false);
  assert.equal(publicationPacing([], { s: { status: 'publishing' } }, config, now).reason, 'pacing_history_unverified');
});

test('VOL-15 terminal slots and durable reservations prevent duplicate submission', async () => {
  const slot = '2026-10-14@12';
  for (const status of ['published', 'publishing', 'publish_unknown', 'daily_cap']) {
    assert.equal(slotDecision({ [slot]: { status } }, slot, config, now).run, false);
  }
  const journal = {};
  let calls = 0;
  const options = {
    item: commercial(),
    key: 'same-product-key',
    slot,
    journal,
    persist: async () => {},
    publish: async () => { calls += 1; return { status: 'publish_unknown' }; },
    now: () => now
  };
  assert.equal((await runReservedPublish(options)).status, 'publish_unknown');
  assert.equal((await runReservedPublish({ ...options, slot: '2026-10-14@18' })).status, 'blocked_reservation');
  assert.equal(calls, 1);
});

test('VOL-16 volume report reflects the balanced five-post ceiling', () => {
  const summary = volumeSummary(config, 3);
  assert.equal(summary.dailyCap, 5);
  assert.equal(summary.remaining, 2);
  assert.equal(summary.minPublishGapMinutes, 30);
  assert.ok(summary.capLabel.includes('일일 상한 5건'));
});

test('VOL-17 commercial clock dispatches configured slot and ignores utility hours', async () => {
  const encode = value => ({ content: Buffer.from(JSON.stringify(value)).toString('base64') });
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (options.method === 'POST') return { ok: true, status: 204 };
    if (url.includes('growth-config')) return { ok: true, status: 200, json: async () => encode(config) };
    if (url.includes('publish-ledger')) return { ok: true, status: 200, json: async () => encode({}) };
    if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
    throw new Error('unexpected mocked endpoint');
  };
  const dispatched = await runClock({ scheduledTime: +now }, { GITHUB_DISPATCH_TOKEN: 'synthetic-only' }, fetcher);
  assert.equal(dispatched.status, 'dispatched');
  assert.equal(dispatched.slot, '2026-10-14@12');
  const utilityHour = await runClock({ scheduledTime: +new Date('2026-10-14T09:10:00+09:00') }, { GITHUB_DISPATCH_TOKEN: 'synthetic-only' }, fetcher);
  assert.equal(utilityHour.status, 'outside_slot');
});

test('VOL-18 workflow schedules and concurrency keep commercial and utility publishers separated safely', async () => {
  const commercialYaml = await fs.readFile(new URL('../../../.github/workflows/daangn-cloud.yml', import.meta.url), 'utf8');
  const utilityYaml = await fs.readFile(new URL('../../../.github/workflows/daangn-utility-publisher.yml', import.meta.url), 'utf8');
  assert.ok(commercialYaml.includes('daangn-cloud-publisher-${{ github.ref }}'));
  assert.ok(utilityYaml.includes('daangn-cloud-publisher-${{ github.ref }}'));
  assert.ok(utilityYaml.includes('cron: "10 0,6,12 * * *"'));
  assert.ok(utilityYaml.includes('npm run utility'));
});

test('VOL-19 safety thresholds and retry limits remain unchanged', () => {
  assert.equal(config.minCurrentOfferQuality, 92);
  assert.equal(config.minCopyQuality, 72);
  assert.equal(config.topicAutoThreshold, 80);
  assert.equal(config.maxTechnicalAttempts, 2);
  assert.equal(config.minPublishGapMinutes, 30);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  baseDailyTarget,
  burstQualityEligible,
  capReached,
  configuredCap,
  isBurstSlot,
  publicationPacing,
  requiresBurstQuality,
  volumeSummary
} from './volume-policy.mjs';
import {
  chooseItem,
  slotFor,
  slotDecision,
  planItem,
  isCommercialContent,
  isUtilityContent
} from './growth-engine.mjs';
import { runReservedPublish } from './publish-journal.mjs';
import { clockSlot, runClock } from '../../daangn-clock/clock.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const now = new Date('2026-10-14T12:07:00+09:00');

function commercial(id = 'new-product', score = 90, category = '생필품', sellerKey = 'seller-a', editorialScore = 95) {
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
    editorialPlan: { status: 'eligible', bucket: 'deal', score: editorialScore },
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

function utility(id = 'library', score = 90, category = '도서관 이용', editorialScore = 95) {
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
  item.editorialPlan = { ...item.editorialPlan, status: 'eligible', score: editorialScore, bucket: 'utility' };
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

test('VOL-01 cap helpers preserve null, zero and numeric limits', () => {
  assert.equal(capReached(50, null), false);
  assert.equal(capReached(0, 0), true);
  assert.equal(capReached(7, 8), false);
  assert.equal(capReached(8, 8), true);
  assert.equal(configuredCap(null, 8), null);
  assert.equal(configuredCap(undefined, 8), 8);
});

test('VOL-02 production policy uses five as base and nine as quality ceiling', () => {
  assert.equal(baseDailyTarget(config), 5);
  assert.equal(config.dailyMax, 9);
  assert.equal(config.commercialDailyMax, 3);
  assert.equal(config.utilityDailyTarget, 4);
  assert.equal(config.maxConsecutiveCommercial, 1);
  assert.equal(config.typeCaps.hotdeal, 3);
  assert.equal(config.typeCaps.tip, 6);
  assert.equal(config.publishingMode, 'adaptive-quality');
  assert.ok(config.utilityDailyTarget > config.commercialDailyMax);
});

test('VOL-03 first five posts use the normal verified quality floor', () => {
  const today = [
    post('utility', '도서관 이용'),
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '공공시설 이용'),
    post('commercial', '생필품', 'seller-2')
  ];
  const regular = commercial('normal-fifth', config.minCopyQuality, '육아·아동', 'seller-3');
  assert.equal(chooseItem([regular], today.slice(0, -1), today, config), regular);
});

test('VOL-04 after five posts ordinary candidates are blocked and exceptional candidates are allowed', () => {
  const today = [
    post('utility', '도서관 이용'),
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '공공시설 이용'),
    post('commercial', '생필품', 'seller-2'),
    post('utility', '요금·생활비 절약')
  ];
  const ordinary = commercial('ordinary-sixth', config.burstMinCopyQuality - 1, '육아·아동', 'seller-3');
  const excellent = commercial('excellent-sixth', config.burstMinCopyQuality, '주방·살림', 'seller-4', config.burstMinEditorialScore);
  assert.equal(chooseItem([ordinary], today, today, config), null);
  assert.equal(chooseItem([ordinary, excellent], today, today, config), excellent);
});

test('VOL-05 burst eligibility requires copy, editorial and verification thresholds', () => {
  assert.equal(burstQualityEligible(commercial('good'), config), true);
  assert.equal(burstQualityEligible(commercial('low-copy', config.burstMinCopyQuality - 1), config), false);
  assert.equal(burstQualityEligible(commercial('low-editorial', 99, '생필품', 'seller-x', config.burstMinEditorialScore - 1), config), false);
  const unverified = commercial('unverified', 99);
  unverified.verification.status = 'unverified';
  assert.equal(burstQualityEligible(unverified, config), false);
  assert.equal(requiresBurstQuality(4, config), false);
  assert.equal(requiresBurstQuality(5, config), true);
});

test('VOL-06 commercial share is capped at three even when every candidate is excellent', () => {
  const today = [
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '도서관 이용'),
    post('commercial', '생필품', 'seller-2'),
    post('utility', '공공시설 이용'),
    post('commercial', '주방·살림', 'seller-3')
  ];
  assert.equal(chooseItem([commercial('fourth-commercial', 99, '여성의류', 'seller-4')], today, today, config), null);
});

test('VOL-07 one commercial post in a row forces utility before another sale post', () => {
  const recent = [post('utility', '도서관 이용'), post('commercial', '생필품', 'seller-1')];
  const util = utility('public-facility', 90, '공공시설 이용');
  assert.equal(chooseItem([commercial('deal', 99, '주방·살림', 'seller-2'), util], recent, [], config), util);
});

test('VOL-08 remaining capacity is reserved for the four-post utility target', () => {
  const today = [
    post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '도서관 이용'),
    post('commercial', '생필품', 'seller-2'),
    post('utility', '공공시설 이용'),
    { status: 'published', type: 'other', contentKind: 'other', topic: '생활정보 A' },
    { status: 'published', type: 'other', contentKind: 'other', topic: '생활정보 B' },
    { status: 'published', type: 'other', contentKind: 'other', topic: '생활정보 C' }
  ];
  const util = utility('refund', 92, '환급·숨은돈');
  assert.equal(chooseItem([commercial('extra-deal', 99, '여성의류', 'seller-3'), util], today, today, config), util);
});

test('VOL-09 hard ceiling blocks the tenth post', () => {
  const today = [
    post('utility', '도서관 이용'), post('commercial', '먹거리·장보기', 'seller-1'),
    post('utility', '공공시설 이용'), post('commercial', '생필품', 'seller-2'),
    post('utility', '요금·생활비 절약'), post('commercial', '주방·살림', 'seller-3'),
    post('utility', '환급·숨은돈'),
    { status: 'published', type: 'other', contentKind: 'other', topic: '생활정보 A' },
    { status: 'published', type: 'other', contentKind: 'other', topic: '생활정보 B' }
  ];
  assert.equal(chooseItem([utility('tenth', 99, '생활정보')], today, today, config), null);
});

test('VOL-10 low quality and unverified source gates still reject filler', () => {
  const low = commercial('low', config.minCopyQuality - 1, '생필품', 'seller-low');
  assert.equal(chooseItem([low], [], [], config), null);
  const missing = commercial('missing');
  missing.copyContext.claims = [];
  const plan = planItem(missing, config, now);
  assert.equal(plan.status, 'review');
  assert.ok(plan.reasons.includes('claim_not_verified'));
});

test('VOL-11 quality wins before learning and diversity tie breakers', () => {
  const strong = commercial('strong', 92, '생필품', 'seller-a');
  const weaker = commercial('weaker', 85, '주방·살림', 'seller-b');
  assert.equal(chooseItem([weaker, strong], [], [], config, item => item === weaker ? 100 : 0), strong);
});

test('VOL-12 unified clocks provide more chances without removing the hard cap', () => {
  assert.deepEqual(config.slotHoursKst, [9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  assert.deepEqual(config.burstSlotHoursKst, [14, 17, 19, 20, 22]);
  assert.deepEqual(config.utilitySlotHoursKst, []);
  assert.deepEqual(config.utilityBurstSlotHoursKst, []);
  for (let hour = 0; hour < 24; hour += 1) {
    const time = new Date(`2026-10-14T${String(hour).padStart(2, '0')}:07:00+09:00`);
    const expected = config.slotHoursKst.includes(hour) ? `2026-10-14@${hour}` : null;
    assert.equal(slotFor(time, config), expected);
    assert.equal(clockSlot(+time, config), expected);
  }
  assert.equal(isBurstSlot(new Date('2026-10-14T14:07:00+09:00'), config, 'commercial'), true);
  assert.equal(isBurstSlot(new Date('2026-10-14T12:07:00+09:00'), config, 'commercial'), false);
  assert.equal(isBurstSlot(new Date('2026-10-14T17:10:00+09:00'), config, 'commercial'), true);
  assert.equal(isBurstSlot(new Date('2026-10-14T17:10:00+09:00'), config, 'utility'), false);
});

test('VOL-13 pacing keeps at least fifty minutes between submissions', () => {
  const published = [{ status: 'published', publishedAt: '2026-10-14T11:50:00+09:00' }];
  const wait = publicationPacing(published, {}, config, now);
  assert.equal(wait.run, false);
  assert.equal(wait.nextEligibleAt, '2026-10-14T03:40:00.000Z');
  assert.equal(publicationPacing(published, {}, config, new Date('2026-10-14T12:40:00+09:00')).run, true);
});

test('VOL-14 terminal slots and durable reservations prevent duplicates', async () => {
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

test('VOL-15 volume report explains base target and quality expansion', () => {
  const summary = volumeSummary(config, 3);
  assert.equal(summary.baseDailyTarget, 5);
  assert.equal(summary.dailyCap, 9);
  assert.equal(summary.baseRemaining, 2);
  assert.equal(summary.remaining, 6);
  assert.equal(summary.minPublishGapMinutes, 50);
  assert.ok(summary.capLabel.includes('기본 5건'));
  assert.ok(summary.capLabel.includes('최대 9건'));
});

test('VOL-16 unified clock dispatches both utility-first and commercial opportunities', async () => {
  const encode = value => ({ content: Buffer.from(JSON.stringify(value)).toString('base64') });
  const fetcher = async (url, options = {}) => {
    if (options.method === 'POST') return { ok: true, status: 204 };
    if (url.includes('growth-config')) return { ok: true, status: 200, json: async () => encode(config) };
    if (url.includes('publish-ledger')) return { ok: true, status: 200, json: async () => encode({}) };
    if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
    throw new Error('unexpected mocked endpoint');
  };
  const dispatched = await runClock({ scheduledTime: +now }, { GITHUB_DISPATCH_TOKEN: 'synthetic-only' }, fetcher);
  assert.equal(dispatched.status, 'dispatched');
  assert.equal(dispatched.slot, '2026-10-14@12');
  const utilityFirstHour = await runClock({ scheduledTime: +new Date('2026-10-14T09:10:00+09:00') }, { GITHUB_DISPATCH_TOKEN: 'synthetic-only' }, fetcher);
  assert.equal(utilityFirstHour.status, 'dispatched');
  assert.equal(utilityFirstHour.slot, '2026-10-14@9');
});

test('VOL-17 one unified workflow schedules all adaptive checks and retires split publishing', async () => {
  const unifiedYaml = await fs.readFile(new URL('../../../.github/workflows/daangn-cloud.yml', import.meta.url), 'utf8');
  const utilityPreviewYaml = await fs.readFile(new URL('../../../.github/workflows/daangn-utility-publisher.yml', import.meta.url), 'utf8');
  assert.ok(unifiedYaml.includes('daangn-cloud-publisher-${{ github.ref }}'));
  assert.ok(unifiedYaml.includes('cron: "7,37 0,2,3,5,6,8,9,10,11,12,13 * * *"'));
  assert.ok(unifiedYaml.includes('npm run cycle'));
  assert.equal(utilityPreviewYaml.includes('schedule:'), false);
  assert.ok(utilityPreviewYaml.includes('daangn-utility-preview-${{ github.ref }}'));
  assert.ok(utilityPreviewYaml.includes('npm run collect:utility'));
  assert.equal(utilityPreviewYaml.includes('npm run utility'), false);
});

test('VOL-18 safety thresholds remain stricter while quantity becomes adaptive', () => {
  assert.equal(config.minCurrentOfferQuality, 92);
  assert.equal(config.minCopyQuality, 74);
  assert.equal(config.burstMinCopyQuality, 88);
  assert.equal(config.burstMinEditorialScore, 85);
  assert.equal(config.topicAutoThreshold, 80);
  assert.equal(config.maxTechnicalAttempts, 2);
  assert.equal(config.minPublishGapMinutes, 50);
  assert.equal(isCommercialContent(commercial()), true);
  assert.equal(isUtilityContent(utility()), true);
});

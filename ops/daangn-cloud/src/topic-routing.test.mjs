import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { shoppingScope } from './content-scope.mjs';
import { selectCommunityCopy } from './copy-engine-v6.mjs';
import { planItem, prioritizeTopicFamilies } from './growth-engine.mjs';
import { applyTopicRoute, routeContent, topicBoards } from './topic-routing.mjs';
import { normalizeUtilityItem } from './utility-language.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-24T10:00:00Z');
const sourceUrl = 'https://www.korea.kr/news/policyNewsView.do?newsId=123456789';

function claims(values, url = sourceUrl) {
  return values.map((value, index) => ({ key: `fact_${index}`, value, sourceUrl: url, verified: true }));
}

function serviceFixture(overrides = {}) {
  const facts = [
    '어카운트인포에서 카드 자동납부 등록 내역을 조회할 수 있습니다.',
    '카드 자동납부의 변경과 해지도 같은 서비스에서 처리할 수 있어요.'
  ];
  const conditions = ['조회와 변경·해지는 안내된 이용시간 안에서만 가능합니다.'];
  return {
    id: 'service:card-autopay',
    sourceId: 'card-autopay',
    sourceUrl: 'https://official.example.test/card-autopay',
    contentVersion: '1234567890abcdef',
    type: 'tip',
    board: topicBoards.tip,
    trustScore: 98,
    verification: {
      status: 'verified',
      observedAt: now.toISOString(),
      method: 'reviewed_facts_and_source_evidence'
    },
    copyContext: {
      kind: 'service',
      intent: 'PUBLIC_SERVICE',
      sourceTitle: '카드 자동납부 조회·변경·해지 안내',
      category: '카드·자동납부',
      readerNeed: '여러 카드의 자동납부 내역을 한 번에 정리',
      editorialAngle: '조회와 변경·해지 이용시간을 구분',
      shareRecipient: '카드를 여러 장 쓰는 가족',
      returnReason: '카드 고정비 관리 서비스',
      facts,
      requiredFacts: facts,
      conditions,
      requiredConditions: conditions,
      url: 'https://official.example.test/card-autopay',
      claims: claims([...facts, ...conditions], 'https://official.example.test/card-autopay')
    },
    ...overrides
  };
}

function researchedFixture(overrides = {}) {
  const facts = [
    '통합 뒤 운임을 10% 인하해 체감할 수 있는 변화가 있었고 마일리지를 도입했어요.',
    '임산부와 청소년 대상 공공할인도 확대했어요.'
  ];
  const conditions = ['통합된 고속철도 열차를 이용할 때 적용돼요.'];
  return {
    id: 'research:123456789',
    sourceUrl,
    type: 'tip',
    board: topicBoards.tip,
    title: '고속철도 운임 10% 인하와 마일리지 안내',
    trustScore: 95,
    reviewRevision: 3,
    sourceTextHash: 'a'.repeat(64),
    expiresAt: new Date(now.getTime() + 86400000).toISOString(),
    verification: {
      status: 'verified',
      observedAt: now.toISOString(),
      method: 'official_source_evidence_and_separate_ai_review'
    },
    copyContext: {
      kind: 'researched',
      intent: 'HOUSEHOLD_BRIEF',
      sourceTitle: '고속철도 운임 10% 인하와 마일리지 안내',
      category: '교통·철도',
      readerNeed: '고속철도 요금 절감과 마일리지 적립 방법 확인',
      editorialAngle: '운임 인하와 공공할인 적용 조건 안내',
      shareRecipient: '고속철도를 이용하는 가족',
      returnReason: '새 생활비 정보와 이용 조건',
      facts,
      requiredFacts: facts,
      conditions,
      requiredConditions: conditions,
      url: sourceUrl,
      claims: claims([...facts, ...conditions])
    },
    ...overrides
  };
}

test('TOPIC-01 verified content routes to its actual board instead of one tip bucket', () => {
  assert.deepEqual(routeContent({ type: 'hotdeal', copyContext: { kind: 'hotdeal' } }), {
    family: 'deal', type: 'hotdeal', board: topicBoards.deal
  });
  assert.deepEqual(routeContent(serviceFixture()), {
    family: 'card', type: 'card', board: topicBoards.card
  });
  assert.deepEqual(routeContent(researchedFixture()), {
    family: 'life', type: 'life', board: topicBoards.life
  });
  assert.deepEqual(routeContent(researchedFixture({
    title: '가족 문화축제 무료 체험',
    copyContext: { ...researchedFixture().copyContext, sourceTitle: '가족 문화축제 무료 체험' }
  })), {
    family: 'event', type: 'event', board: topicBoards.life
  });
});

test('TOPIC-02 planItem applies routing before verified scope and editorial scoring', () => {
  const card = serviceFixture();
  const plan = planItem(card, config, now);
  assert.equal(card.type, 'card');
  assert.equal(card.board, topicBoards.card);
  assert.equal(plan.topicFamily, 'card');
  assert.equal(plan.status, 'eligible');
  assert.equal(shoppingScope(card, now), true);

  const life = researchedFixture();
  const lifePlan = planItem(life, config, now);
  assert.equal(life.type, 'life');
  assert.equal(life.board, topicBoards.life);
  assert.equal(lifePlan.topicFamily, 'life');
  assert.equal(lifePlan.status, 'eligible');
  assert.equal(shoppingScope(life, now), true);
});

test('TOPIC-03 utility language cleanup preserves facts while preventing total copy rejection', () => {
  const item = researchedFixture();
  normalizeUtilityItem(item);
  assert.equal(item.copyContext.facts.some(value => value.includes('체감할 수 있는')), false);
  assert.notEqual(
    item.copyContext.facts[0].replace(/[.!?]+$/g, '').slice(-5),
    item.copyContext.facts[1].replace(/[.!?]+$/g, '').slice(-5)
  );
  item.editorialPlan = planItem(item, config, now);
  const copy = selectCommunityCopy(item, [], 'daangn', {});
  assert.equal(copy.copyRejected, false);
  assert.ok(copy.postTitle);
  assert.ok(copy.postBody);
  assert.equal(copy.postBody.includes('체감할 수 있는'), false);
});

test('TOPIC-04 underfilled topic families win before an already supplied deal family', () => {
  const deal = applyTopicRoute({ id: 'deal', type: 'hotdeal', copyContext: { kind: 'hotdeal' } });
  const card = applyTopicRoute(serviceFixture({ id: 'card' }));
  const life = applyTopicRoute(researchedFixture({ id: 'life' }));

  assert.deepEqual(prioritizeTopicFamilies([deal, card, life], [], config), [life]);
  assert.deepEqual(prioritizeTopicFamilies([deal, card, life], [{ topicFamily: 'life' }], config), [card]);
  assert.deepEqual(
    prioritizeTopicFamilies([deal, card, life], [{ topicFamily: 'life' }, { topicFamily: 'card' }], config),
    [deal]
  );
});

test('TOPIC-05 card, life and event types are enabled with independent caps', () => {
  assert.ok(config.typeCaps.card > 0);
  assert.ok(config.typeCaps.life > 0);
  assert.ok(config.typeCaps.event > 0);
  assert.ok(config.topicFamilyTargets.card > 0);
  assert.ok(config.topicFamilyTargets.life > 0);
  assert.ok(config.topicFamilyDailyCaps.deal <= config.commercialDailyMax);
});

test('TOPIC-06 bounded collection drift stays fresh but large future drift is blocked', () => {
  const base = {
    id: 'hot:freshness',
    type: 'hotdeal',
    board: topicBoards.deal,
    sourceUrl: 'https://shop.example.test/freshness',
    buyUrl: 'https://shop.example.test/freshness',
    trustScore: 96,
    expiresAt: new Date(now.getTime() + 86400000).toISOString(),
    copyContext: {
      kind: 'hotdeal',
      currentOffer: true,
      product: '검증용 생수 20병',
      category: '먹거리·장보기',
      price: 10000,
      referencePrice: 12000,
      readerNeed: '장보기 비용과 적용 조건',
      editorialAngle: '현재 가격과 배송 조건 확인',
      shareRecipient: '같은 상품을 사는 가족',
      returnReason: '장보기 가격 정보',
      claims: [
        { value: '현재 상품가 10000원', sourceUrl: 'https://shop.example.test/freshness', verified: true },
        { value: '판매처 표시가 12000원', sourceUrl: 'https://shop.example.test/freshness', verified: true }
      ]
    }
  };
  const fresh = structuredClone(base);
  fresh.verification = { status: 'verified', observedAt: new Date(now.getTime() + 10000).toISOString() };
  assert.equal(planItem(fresh, config, now).reasons.includes('source_stale'), false);

  const future = structuredClone(base);
  future.verification = { status: 'verified', observedAt: new Date(now.getTime() + 300001).toISOString() };
  assert.equal(planItem(future, config, now).reasons.includes('source_stale'), true);
});

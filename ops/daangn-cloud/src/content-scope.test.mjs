import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { shoppingScope } from './content-scope.mjs';
import { chooseItem, planItem, isCommercialContent, isUtilityContent } from './growth-engine.mjs';
import { publishOne } from './publisher.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const now = new Date();

const deal = {
  type: 'hotdeal',
  buyUrl: 'https://shop.example/product/1',
  sourceUrl: 'https://shop.example/product/1',
  price: 10000,
  discountPct: 20,
  saving: 2500,
  verification: { status: 'verified', observedAt: now.toISOString() },
  copyContext: {
    kind: 'hotdeal',
    product: '세제 2개',
    price: 10000,
    category: '생필품',
    returnReason: '장보기 가격 비교',
    claims: [{ value: '세제 2개 현재가 10,000원', verified: true, sourceUrl: 'https://shop.example/product/1' }]
  }
};
deal.editorialPlan = planItem(deal, config, now);
deal.qualityScores = { finalScore: 84 };

const service = {
  id: 'service:library',
  sourceId: 'library',
  sourceUrl: 'https://official.example/service',
  contentVersion: '1234567890abcdef',
  type: 'tip',
  board: '💰 꿀팁 공유',
  trustScore: 98,
  verification: {
    status: 'verified',
    observedAt: now.toISOString(),
    method: 'reviewed_facts_and_source_evidence'
  },
  copyContext: {
    kind: 'service',
    intent: 'PUBLIC_SERVICE',
    sourceTitle: '도서관 회원증 하나로 여러 곳에서 대출 가능',
    category: '도서관 이용',
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
    url: 'https://official.example/service',
    claims: [
      { value: '참여도서관은 회원증 하나로 이용할 수 있어요.', verified: true, sourceUrl: 'https://official.example/service' },
      { value: '참여도서관 목록은 공식 홈페이지에서 볼 수 있습니다.', verified: true, sourceUrl: 'https://official.example/service' }
    ]
  }
};
service.editorialPlan = planItem(service, config, now);
service.qualityScores = { finalScore: 86 };

const researched = {
  id: 'research:123',
  sourceUrl: 'https://www.korea.kr/news/policyNewsView.do?newsId=123',
  sourceTextHash: 'a'.repeat(64),
  reviewRevision: 3,
  expiresAt: new Date(now.getTime() + 2 * 864e5).toISOString(),
  type: 'tip',
  board: '💰 꿀팁 공유',
  trustScore: 95,
  verification: {
    status: 'verified',
    observedAt: now.toISOString(),
    method: 'official_source_evidence_and_separate_ai_review'
  },
  copyContext: {
    kind: 'researched',
    intent: 'HOUSEHOLD_BRIEF',
    sourceTitle: '생활비 지원 신청 조건 변경',
    category: '생활정보',
    readerNeed: '현재 신청 가능한 생활비 지원 조건 확인',
    editorialAngle: '대상과 신청 조건을 공식 원문으로 구분',
    shareRecipient: '지원 대상이 될 수 있는 가족',
    returnReason: '새 생활비 정보와 이용 조건',
    facts: ['신청 대상은 공식 안내의 소득 조건을 충족한 가구입니다.', '신청은 공식 홈페이지에서 할 수 있습니다.'],
    requiredFacts: ['신청 대상은 공식 안내의 소득 조건을 충족한 가구입니다.', '신청은 공식 홈페이지에서 할 수 있습니다.'],
    conditions: ['세부 자격은 가구 상황에 따라 달라집니다.'],
    requiredConditions: ['세부 자격은 가구 상황에 따라 달라집니다.'],
    url: 'https://www.korea.kr/news/policyNewsView.do?newsId=123',
    claims: [
      { value: '신청 대상은 공식 안내의 소득 조건을 충족한 가구입니다.', verified: true, sourceUrl: 'https://www.korea.kr/news/policyNewsView.do?newsId=123' },
      { value: '신청은 공식 홈페이지에서 할 수 있습니다.', verified: true, sourceUrl: 'https://www.korea.kr/news/policyNewsView.do?newsId=123' }
    ]
  }
};
researched.editorialPlan = planItem(researched, config, now);
researched.qualityScores = { finalScore: 85 };

assert.equal(config.dailyMax, 5);
assert.equal(config.commercialDailyMax, 2);
assert.equal(config.utilityDailyTarget, 3);
assert.equal(config.maxConsecutiveCommercial, 1);
assert.equal(config.publishingMode, 'balanced-mix');
assert.equal(config.features.publicServices, true);
assert.equal(config.features.research, true);

assert.equal(shoppingScope(deal), true);
assert.equal(shoppingScope(service), true);
assert.equal(shoppingScope(researched), true);
assert.equal(service.editorialPlan.status, 'eligible');
assert.equal(researched.editorialPlan.status, 'eligible');
assert.equal(isCommercialContent(deal), true);
assert.equal(isUtilityContent(service), true);
assert.equal(isUtilityContent(researched), true);

const forgedService = {
  ...service,
  copyContext: {
    ...service.copyContext,
    claims: service.copyContext.claims.map(claim => ({ ...claim, verified: false }))
  }
};
assert.equal(shoppingScope(forgedService), false);

const staleResearch = {
  ...researched,
  expiresAt: new Date(now.getTime() - 1000).toISOString()
};
assert.equal(shoppingScope(staleResearch, now), false);

for (const kind of ['policy', 'event', 'question']) {
  const stale = { ...deal, copyContext: { ...deal.copyContext, kind, sourceTitle: '보험료 할인 혜택 쿠폰' } };
  assert.equal(shoppingScope(stale), false);
  assert.ok(planItem(stale, config, now).reasons.includes('outside_shopping_scope'));
  assert.equal(chooseItem([stale], [], [], config), null);
  await assert.rejects(
    () => publishOne(stale),
    error => error.message === 'OUTSIDE_SHOPPING_SCOPE' && error.beforeSubmit
  );
}

assert.equal(chooseItem([deal], [], [], config), deal);

const twoCommercial = Array.from({ length: 2 }, (_, index) => ({
  type: 'hotdeal',
  contentKind: 'hotdeal',
  sourceStore: `shop${index}`,
  topic: `topic${index}`
}));
assert.equal(chooseItem([deal], twoCommercial, twoCommercial, config), null, 'commercial cap must stop a third sale post');

const oneCommercialRecent = [
  { type: 'hotdeal', contentKind: 'hotdeal', topic: '먹거리·장보기' }
];
assert.equal(
  chooseItem([deal, service], oneCommercialRecent, [], config),
  service,
  'one commercial post must be followed by verified utility content'
);

const fourPostsWithTwoUtility = [
  { type: 'tip', contentKind: 'service', topic: '공공시설 이용' },
  { type: 'hotdeal', contentKind: 'hotdeal', topic: '먹거리·장보기' },
  { type: 'tip', contentKind: 'researched', topic: '환급·숨은돈' },
  { type: 'hotdeal', contentKind: 'hotdeal', topic: '생필품' }
];
assert.equal(
  chooseItem([deal, researched], fourPostsWithTwoUtility, fourPostsWithTwoUtility, config),
  researched,
  'last remaining daily slot is reserved for the third verified utility post'
);

const lower = { ...deal, id: 'lower', qualityScores: { finalScore: 73 } };
const higher = { ...deal, id: 'higher', qualityScores: { finalScore: 88 } };
assert.equal(
  chooseItem([lower, higher], [], [], config, item => item === lower ? 100 : 0),
  higher,
  'learning cannot promote lower-quality copy over a better draft'
);
assert.equal(
  chooseItem([{ ...higher, qualityScores: { finalScore: config.minCopyQuality - 1 } }], [], [], config),
  null,
  'draft below configured quality floor stays unpublished'
);

console.log('balanced commercial and verified utility scope checks passed');

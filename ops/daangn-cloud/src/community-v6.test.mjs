import assert from 'node:assert/strict';
import { renderCommunityCandidates, selectCommunityCopy } from './copy-engine.mjs';
import { assessCopyCandidate } from './quality-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { publicCondition } from './editorial-language.mjs';
import { growthCopyFailures } from './growth-engine.mjs';
import {
  approvedDealClaimGroups,
  bodyContainsApprovedDealClaim,
  renderUtilitySurfaceCandidates,
  renderShoppingSurfaceCandidates
} from './editorial-diversity.mjs';

// All products, prices, service claims and example URLs in this file are
// synthetic fixtures. These checks never collect sources or publish posts.

const shopping = {
  id: 'shopping:v6:fixture',
  type: 'hotdeal',
  board: '🎁 핫딜 정보',
  sourceUrl: 'https://shop.example/product/1',
  trustScore: 96,
  verification: {
    status: 'verified',
    observedAt: new Date().toISOString(),
    method: 'shopping_offer_v1'
  },
  copyContext: {
    kind: 'hotdeal',
    currentOffer: true,
    intent: 'CURRENT_OFFER',
    product: '베베숲 물티슈 70매 캡 20팩',
    category: '육아·아동',
    price: 23900,
    priceLabel: '상품가',
    referencePrice: 34130,
    referenceLabel: '판매처 할인 전 표시가',
    saving: 10230,
    shipping: '기본배송 무료 (제주·도서산간 조건 별도)',
    delivery: { total: 23900 },
    requiredConditions: [
      '즉시할인가 · 카드할인·적립금 제외.',
      '구매수량 최대 5개.',
      '행사 종료 10/31 23:59.'
    ],
    conditions: [
      '즉시할인가 · 카드할인·적립금 제외.',
      '구매수량 최대 5개.',
      '행사 종료 10/31 23:59.'
    ],
    buyUrl: 'https://shop.example/product/1'
  }
};

const facts = dealPriceFacts(shopping.copyContext);
const approved = approvedDealClaimGroups(shopping.copyContext, facts);
assert.equal(approved.unit.some(sentence => /총 .*을 상품가로 나누/.test(sentence)), false,
  'A per-item price divides the price by quantity, never quantity by price');
assert.ok(approved.unit.some(sentence => sentence.includes('상품가를 총 20팩으로 나누면')));
const shoppingCandidates = renderCommunityCandidates(shopping, 'daangn', []);
assert.ok(shoppingCandidates.length >= 80, 'V6 should cross factual titles with a broad surface family pool');
assert.ok(new Set(shoppingCandidates.map(candidate => candidate.surfaceFamily)).size >= 14);
assert.ok(new Set(shoppingCandidates.map(candidate => candidate.leadFamily)).size >= 5);
assert.ok(new Set(shoppingCandidates.map(candidate => candidate.declaredLinkPosition)).size >= 3);

for (const candidate of shoppingCandidates) {
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.price), 'verified total price wording missing');
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.comparisonDiscount), 'verified comparison wording missing');
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.unit), 'verified unit-price wording missing');
  assert.ok(bodyContainsApprovedDealClaim(candidate.postBody, approved.delivery), 'verified delivered-total wording missing');
  assert.ok(candidate.postBody.includes(shopping.copyContext.shipping));
  assert.ok(candidate.postBody.includes(facts.purchaseFit));
  for (const condition of shopping.copyContext.requiredConditions) {
    assert.ok(publicCondition(candidate.postBody).includes(publicCondition(condition)));
  }
  assert.equal(/저도|제가|써봤|먹어봤|대박|역대급|무조건/.test(candidate.postTitle + candidate.postBody), false);
}

const selected = selectCommunityCopy(shopping, [], 'daangn');
assert.equal(selected.copyRejected, false, JSON.stringify(selected.copyRejectReasons));
assert.equal(selected.copyMeta.managedSurface, true);
assert.ok(selected.copyMeta.surfaceFamily);
assert.ok(selected.qualityScores.finalScore >= 72);
const restoredMeta = JSON.parse(JSON.stringify(selected.copyMeta));
for (const field of ['contentIdentity', 'managedSurface', 'surfaceFamily', 'leadFamily', 'paragraphPattern', 'closingFamily', 'frameSignature']) {
  assert.ok(restoredMeta[field], `Persisted history must retain ${field}`);
  assert.equal(restoredMeta[field], selected.copyMeta[field]);
}
assert.ok(selected.postBody.includes('할인 기한: 10/31 23:59.'));
assert.equal(/다른 판매처.*최저가.*미확인/.test(selected.postBody), false);

assert.equal(selectCommunityCopy(shopping, [{ copyMeta: restoredMeta }]).copyRejected, true,
  'Changing the layout cannot republish the same content identity');
assert.equal(selectCommunityCopy(shopping, [{ bodyText: selected.postBody }]).copyRejected, true,
  'Legacy body-only history still blocks the same merchant product URL');
assert.equal(selectCommunityCopy(shopping, [{ sourceUrl: shopping.sourceUrl + '?utm_source=legacy' }]).copyRejected, true,
  'Tracking parameters cannot disguise the same merchant product URL');

for (const [label, body] of [
  ['price mutation', selected.postBody.replaceAll('23,900원', '23,901원')],
  ['missing purchase restriction', selected.postBody.replace('구매수량 최대 5개.', '')]
]) {
  const changed = { ...selected, postBody: body };
  const qa = assessCopyCandidate({ item: shopping, candidate: changed, recentPosts: [], platform: 'daangn' });
  assert.equal(qa.ok && growthCopyFailures(shopping, changed).length === 0,
    false, label);
}

const firstCandidate = shoppingCandidates[0];
const firstQa = assessCopyCandidate({
  item: shopping,
  candidate: firstCandidate,
  recentPosts: [],
  platform: 'daangn'
});
assert.ok(firstQa.meta.managedSurface);
const repeatedQa = assessCopyCandidate({
  item: shopping,
  candidate: firstCandidate,
  recentPosts: [{
    title: firstCandidate.postTitle,
    bodyText: firstCandidate.postBody,
    copyMeta: firstQa.meta,
    styleMode: firstCandidate.styleMode
  }],
  platform: 'daangn'
});
assert.equal(repeatedQa.ok, false);
assert.ok(repeatedQa.reasons.includes('recent_surface_family_duplicate'));
assert.ok(repeatedQa.reasons.includes('recent_frame_duplicate'));

const simulatedProducts = [
  ['베베숲 물티슈 70매 캡 20팩', '육아·아동'],
  ['주방세제 리필 1L 4개', '주방·살림'],
  ['두루마리 화장지 30롤', '생필품'],
  ['생수 2L 12병', '먹거리·장보기'],
  ['세탁세제 3L 3개', '생필품'],
  ['키친타월 12롤', '주방·살림'],
  ['즉석밥 210g 24개', '먹거리·장보기'],
  ['치약 120g 10개', '생필품'],
  ['샴푸 500ml 3개', '뷰티·여성용품'],
  ['아기 기저귀 4단계 4팩', '육아·아동'],
  ['종량제 호환 봉투 30매', '생필품'],
  ['커피 캡슐 30개', '먹거리·장보기']
];
const simulated = [];
for (let index = 0; index < simulatedProducts.length; index += 1) {
  const [product, category] = simulatedProducts[index];
  const price = 23900 + index * 410;
  const referencePrice = price + 10230 + index * 17;
  const item = {
    ...shopping,
    id: `shopping:v6:simulation:${index}`,
    sourceUrl: `https://shop.example/product/${index + 2}`,
    copyContext: {
      ...shopping.copyContext,
      product,
      category,
      price,
      referencePrice,
      saving: referencePrice - price,
      delivery: { total: price },
      buyUrl: `https://shop.example/product/${index + 2}`
    }
  };
  const picked = selectCommunityCopy(item, simulated, 'daangn');
  assert.equal(picked.copyRejected, false, `simulation ${index}: ${JSON.stringify(picked.copyRejectReasons)}`);
  assert.equal(simulated.slice(-12).some(post => post.copyMeta.surfaceFamily === picked.copyMeta.surfaceFamily), false);
  assert.equal(simulated.slice(-8).some(post => post.copyMeta.frameSignature === picked.copyMeta.frameSignature), false);
  simulated.push({
    status: 'published',
    title: picked.postTitle,
    bodyText: picked.postBody,
    copyMeta: picked.copyMeta,
    styleMode: picked.styleMode,
    contentKind: 'hotdeal',
    topic: category
  });
}
assert.equal(simulated.length, 12);

const utility = {
  id: 'service:v6:fixture',
  type: 'tip',
  board: '💰 꿀팁 공유',
  sourceUrl: 'https://official.example/service',
  trustScore: 98,
  verification: {
    status: 'verified',
    observedAt: new Date().toISOString(),
    method: 'reviewed_facts_and_source_evidence'
  },
  copyContext: {
    kind: 'service',
    intent: 'PUBLIC_SERVICE',
    sourceTitle: '도서관 회원증 하나로 여러 곳에서 대출 가능',
    category: '도서관 이용',
    readerNeed: '책을 구매하기 전에 이용할 수 있는 도서관 찾기',
    editorialAngle: '통합회원증을 사용할 수 있는 참여도서관 확인 순서',
    facts: [
      '참여도서관은 회원증 하나로 이용할 수 있어요.',
      '참여도서관 목록은 공식 홈페이지에 있습니다.',
      '가입과 이용 절차는 도서관별 안내를 따라야 합니다.'
    ],
    requiredFacts: [
      '참여도서관은 회원증 하나로 이용할 수 있어요.',
      '참여도서관 목록은 공식 홈페이지에 있습니다.',
      '가입과 이용 절차는 도서관별 안내를 따라야 합니다.'
    ],
    conditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
    requiredConditions: ['모든 도서관이 아니라 참여도서관만 해당됩니다.'],
    url: 'https://official.example/service'
  }
};

const utilityCandidates = renderCommunityCandidates(utility, 'daangn', []);
assert.ok(utilityCandidates.length >= 24);
assert.ok(new Set(utilityCandidates.map(candidate => candidate.surfaceFamily)).size > 12,
  'A same-kind utility feed must have more actual structures than the recent12 exclusion window');
assert.ok(new Set(utilityCandidates.map(candidate => candidate.declaredLinkPosition)).size >= 3);
assert.ok(new Set(utilityCandidates.map(candidate => candidate.leadFamily)).size >= 3);
for (const candidate of utilityCandidates) {
  for (const fact of utility.copyContext.requiredFacts) assert.ok(candidate.postBody.includes(fact));
  for (const condition of utility.copyContext.requiredConditions) assert.ok(candidate.postBody.includes(condition));
}

const utilitySelected = selectCommunityCopy(utility, simulated, 'daangn');
assert.equal(utilitySelected.copyRejected, false, JSON.stringify(utilitySelected.copyRejectReasons));
assert.equal(utilitySelected.copyMeta.managedSurface, true);

// Exercise the selector against serialized structural history alone. Other
// tests above cover duplicate wording; this isolates exhaustion of the layout
// pool across consecutive same-kind posts, including a second complete cycle.
const structuralHistory = [];
for (let index = 0; index < 30; index += 1) {
  const picked = selectCommunityCopy(utility, structuralHistory, 'daangn');
  assert.equal(picked.copyRejected, false, `utility structural cycle ${index}: ${JSON.stringify(picked.copyRejectReasons)}`);
  assert.equal(structuralHistory.slice(-12).some(post => post.copyMeta.surfaceFamily === picked.copyMeta.surfaceFamily), false);
  assert.equal(structuralHistory.slice(-8).some(post => post.copyMeta.frameSignature === picked.copyMeta.frameSignature), false);
  structuralHistory.push(JSON.parse(JSON.stringify({ copyMeta: {
    managedSurface: picked.copyMeta.managedSurface,
    surfaceFamily: picked.copyMeta.surfaceFamily,
    frameSignature: picked.copyMeta.frameSignature
  } })));
}

const directUtilityArgs = {
  ctx: {
    ...utility.copyContext,
    facts: [
      ...utility.copyContext.facts,
      '회원 자격은 해당 기관에서 심사합니다.',
      '추가 제공 항목은 기본 이용 범위에 포함되지 않습니다.'
    ],
    requiredFacts: [...utility.copyContext.requiredFacts, '온라인 신청만으로 이용 승인이 확정되지는 않습니다.'],
    conditions: ['시설별 운영일은 별도 공지를 따릅니다.'],
    requiredConditions: [
      ...utility.copyContext.requiredConditions,
      '타인 명의로 신청할 수 없습니다.',
      '신분 확인 서류가 필요합니다.',
      '기관별 이용 제한을 따라야 합니다.'
    ],
    sourceUrls: ['https://official.example/terms', 'https://official.example/eligibility']
  },
  titles: [{ title: '합성 생활정보 검증 예제', strategy: 'FIXTURE' }],
  allowedStyleModes: ['BARE', 'CONTEXT', 'CONDITION_FIRST']
};
const fullUtilityCandidates = renderUtilitySurfaceCandidates(directUtilityArgs);
for (const candidate of fullUtilityCandidates) {
  for (const fact of [...directUtilityArgs.ctx.facts, ...directUtilityArgs.ctx.requiredFacts]) assert.ok(candidate.postBody.includes(fact));
  for (const condition of [...directUtilityArgs.ctx.conditions, ...directUtilityArgs.ctx.requiredConditions]) assert.ok(candidate.postBody.includes(condition));
  for (const url of [...directUtilityArgs.ctx.sourceUrls, directUtilityArgs.ctx.url]) assert.ok(candidate.postBody.includes(url));
}

const otherKindCandidates = renderUtilitySurfaceCandidates({ ...directUtilityArgs, ctx: { ...directUtilityArgs.ctx, kind: 'researched' } });
assert.deepEqual(otherKindCandidates.map(candidate => candidate.surfaceFamily), fullUtilityCandidates.map(candidate => candidate.surfaceFamily),
  'Changing utility kind cannot disguise the same actual paragraph structure');

const trackingLine = '이 가격은 이전에 기록한 상품가와 비교한 합성 시험값입니다.';
const historyCandidates = renderShoppingSurfaceCandidates({
  ctx: shopping.copyContext,
  facts,
  offerTerms: { base: shopping.copyContext.product },
  conditions: shopping.copyContext.requiredConditions,
  history: trackingLine,
  titles: [{ title: '합성 가격 이력 시험', strategy: 'FIXTURE' }],
  allowedStyleModes: ['BARE', 'CONTEXT', 'CONDITION_FIRST', 'PRICE_FIRST', 'UNIT_FIRST', 'CHANGE_FIRST']
});
for (const candidate of historyCandidates) assert.ok(candidate.postBody.includes(trackingLine), 'Every plan must preserve provided price-history context');

// Distinct synthetic briefs plus distinct product fixtures exercise the full
// selector with complete, serialized text history rather than metadata alone.
const mixedBriefs = [
  ['책이음 참여도서관 찾기', ['통합 회원증 안내에는 참여기관 목록이 실려 있습니다.', '가까운 대출 지점은 지역 목록에서 찾을 수 있어요.', '기관별 가입 절차는 별도로 운영됩니다.'], '참여기관 밖에서는 같은 회원증을 사용할 수 없습니다.'],
  ['공유누리 공공시설 예약', ['공공자원 목록은 시설 유형별로 나뉩니다.', '대관 가능한 시간은 예약 달력에 표시돼요.', '신청 이후 승인 결과는 기관에서 전달합니다.'], '시설별 이용료와 취소 규정을 먼저 읽어야 합니다.'],
  ['통신요금 미환급금 조회', ['해지 이후 남은 정산 금액은 가입자 명의로 조회합니다.', '통신사별 조회 결과는 서로 다를 수 있어요.', '지급 신청에는 본인 확인 절차가 이어집니다.'], '조회 결과가 없으면 받을 금액이 있다고 표현할 수 없습니다.'],
  ['방송요금 해지 보증금 정산', ['방송 서비스의 보증금 정산은 장비 반납 내역과 연결됩니다.', '남아 있는 청구 항목은 해지 명세에서 볼 수 있어요.', '반납 방식은 각 사업자가 안내합니다.'], '기기를 반납해도 모든 청구 금액이 사라지는 것은 아닙니다.'],
  ['공개강좌 수강 신청 일정', ['온라인 강좌 목록에는 과목별 학습 목표가 포함됩니다.', '신청 버튼은 해당 강좌의 접수 기간에 열려요.', '학습 자료와 평가 일정은 강의실에서 제공합니다.'], '수강과 이수증 발급 조건은 구분해야 합니다.'],
  ['전기요금 복지 할인 대상', ['할인 신청서는 전기 사용 계약 정보를 요구합니다.', '적용 대상은 공식 자격 목록에서 확인할 수 있어요.', '접수 결과는 계약 정보와 함께 심사됩니다.'], '자격을 갖추어도 신청일에 따라 적용 시점이 달라집니다.'],
  ['수도요금 감면 신청 서류', ['상수도 감면 안내는 관할 지역 기준을 따릅니다.', '고지서의 고객번호로 사용 주소를 구분할 수 있어요.', '제출할 서류는 신청 유형별로 다릅니다.'], '다른 지역의 감면 비율을 그대로 적용하지 않아야 합니다.'],
  ['보육료 신청과 변경 처리', ['보육료 지원 유형은 아동의 이용 시설과 연결됩니다.', '현재 신청 상태는 민원 화면에서 볼 수 있어요.', '이용 방식 변경은 별도 절차로 접수합니다.'], '변경 신청 전에 기존 지원과 새 지원의 적용 기간을 대조해야 합니다.'],
  ['시니어 돌봄 서비스 접수', ['돌봄 상담은 생활 상황과 지원 필요도를 함께 살핍니다.', '담당 기관은 거주 지역 안내에서 찾을 수 있어요.', '제공 서비스는 상담 결과에 따라 결정합니다.'], '문의만으로 모든 방문 지원이 확정되는 것은 아닙니다.'],
  ['건강검진 대상 항목 확인', ['검진 대상 여부와 검사 항목은 개인별로 구분됩니다.', '이용할 기관은 지정 검진기관 목록에 나와 있어요.', '예약 가능일은 선택한 기관이 안내합니다.'], '일반검진 대상이라고 모든 추가 검사가 포함되지는 않습니다.'],
  ['폐가전 방문 수거 신청', ['방문 수거 목록은 가전 종류와 배출 조건을 함께 표시합니다.', '배출 주소를 입력하면 신청 가능한 날짜가 나와요.', '최종 수거 일정은 접수 내역으로 전달합니다.'], '수거 대상에 없는 물품을 임의로 함께 배출하면 안 됩니다.'],
  ['휴면예금 지급 신청', ['휴면 자산 조회는 본인 소유 내역을 대상으로 합니다.', '계좌별 조회 결과에서 관리 기관을 볼 수 있어요.', '지급 방법은 해당 자산의 처리 절차로 연결됩니다.'], '인증을 마치기 전에 받을 돈이 있다고 단정할 수 없습니다.'],
  ['교육비 바우처 사용 범위', ['사용처 안내는 지원 목적에 맞는 업종을 구분합니다.', '잔액과 이용 내역은 별도 조회 화면에서 볼 수 있어요.', '사용 내역 반영은 처리 일정에 따라 달라집니다.'], '가맹점이라고 모든 품목을 결제할 수 있는 것은 아닙니다.'],
  ['에너지 이용권 잔액 조회', ['에너지 지원은 사용 방식에 따라 잔액 표시가 나뉩니다.', '요금 차감 내역은 공급사 고지서에서도 볼 수 있어요.', '실제 차감 여부는 다음 정산 과정에서 반영됩니다.'], '조회 잔액을 현금으로 인출할 수 있다고 안내해서는 안 됩니다.'],
  ['어린이 공공체육 강좌 접수', ['체육 강좌는 대상 연령과 수업 장소를 함께 안내합니다.', '모집 상황은 강좌별 신청 화면에 나와 있어요.', '등록 안내는 접수 결과에 따라 발송합니다.'], '대기 접수 상태를 수강 확정으로 받아들이지 않아야 합니다.'],
  ['도서관 전자책 대여 기간', ['전자자료 목록은 이용 도서관의 구독 범위에 따릅니다.', '대출 가능한 자료는 전자책 화면에서 볼 수 있어요.', '반납과 연장은 자료별 이용 방식으로 처리합니다.'], '종이책 회원 자격만으로 모든 전자자료를 이용할 수는 없습니다.']
];
const mixedHistory = [];
for (let index = 0; index < mixedBriefs.length; index += 1) {
  const [sourceTitle, serviceFacts, condition] = mixedBriefs[index];
  const sourceUrl = `https://official.example/synthetic/${index}`;
  const service = {
    ...utility,
    id: `service:v6:mixed-fixture:${index}`,
    sourceUrl,
    copyContext: {
      ...utility.copyContext,
      sourceTitle,
      category: '생활정보',
      readerNeed: sourceTitle,
      editorialAngle: '',
      facts: serviceFacts,
      requiredFacts: serviceFacts,
      conditions: [condition],
      requiredConditions: [condition],
      url: sourceUrl
    }
  };
  const items = [service];
  if (index < simulatedProducts.length) {
    const [product, category] = simulatedProducts[index];
    const price = 19000 + index * 510;
    items.push({
      ...shopping,
      id: `shopping:v6:mixed-fixture:${index}`,
      sourceUrl: `https://shop.example/mixed/${index}`,
      copyContext: {
        ...shopping.copyContext,
        product,
        category,
        price,
        referencePrice: price + 12000,
        saving: 12000,
        delivery: { total: price },
        buyUrl: `https://shop.example/mixed/${index}`
      }
    });
  }
  for (const item of items) {
    const picked = selectCommunityCopy(item, mixedHistory, 'daangn');
    assert.equal(picked.copyRejected, false, `mixed history ${item.id}: ${JSON.stringify(picked.copyRejectReasons)}`);
    assert.equal(mixedHistory.slice(-12).some(post => post.copyMeta.surfaceFamily === picked.copyMeta.surfaceFamily), false);
    assert.equal(mixedHistory.slice(-8).some(post => post.copyMeta.frameSignature === picked.copyMeta.frameSignature), false);
    mixedHistory.push(JSON.parse(JSON.stringify({
      status: 'published',
      title: picked.postTitle,
      bodyText: picked.postBody,
      copyMeta: picked.copyMeta,
      styleMode: picked.styleMode,
      contentKind: item.copyContext.kind,
      topic: item.copyContext.category
    })));
  }
}
assert.equal(mixedHistory.length, 28);

console.log('v6 synthetic factual-preservation, metadata, structural-reuse and utility-cycle checks passed');

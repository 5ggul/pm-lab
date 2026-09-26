import assert from 'node:assert/strict';
import {
  renderCommunityCandidates,
  selectCommunityCopy,
  validateGeneratedCopy
} from './copy-engine.mjs';
import { buildCopyMeta, itemQuality } from './quality-engine.mjs';
import { platformProfile } from './platform-profiles.mjs';

const hot = {
  id: 'test:hot:1',
  type: 'hotdeal',
  board: '🎁 핫딜 정보',
  sourceUrl: 'https://example.com/p/1',
  price: 16500,
  saving: 5500,
  discountPct: 25,
  baselineSource: '상품 페이지 기준가',
  copyContext: {
    kind: 'hotdeal',
    intent: 'DEAL_UNIT',
    product: '테스트 물티슈 20팩',
    price: 16500,
    baselinePrice: 22000,
    baselineSource: '상품 페이지 기준가',
    saving: 5500,
    discountPct: 25,
    unitInfo: { count: 20, unit: '팩' },
    unitPrice: 825,
    shipping: '무료배송',
    category: '생활용품',
    merchant: '테스트몰',
    buyUrl: 'https://example.com/p/1',
    claims: [
      { key: 'current_price', value: 16500, confidence: 0.95 },
      { key: 'baseline_price', value: 22000, confidence: 0.90 },
      { key: 'saving', value: 5500, confidence: 0.99 },
      { key: 'discount_pct', value: 25, confidence: 0.99 },
      { key: 'unit_price', value: 825, confidence: 0.99 }
    ]
  }
};

const candidates = renderCommunityCandidates(hot, 'daangn');
assert.ok(candidates.length >= 20, 'v3 should generate a broad candidate pool');

const first = selectCommunityCopy(hot, [], 'daangn');
assert.equal(first.copyRejected, false);
assert.ok(first.copyMeta);
assert.ok(first.qualityScores.finalScore >= 72);
assert.equal(
  validateGeneratedCopy(first, first.postTitle, first.postBody, [], 'daangn').ok,
  true
);

const second = selectCommunityCopy(hot, [{
  title: first.postTitle,
  bodyText: first.postBody,
  copyMeta: first.copyMeta,
  styleMode: first.styleMode
}], 'daangn');
assert.equal(second.copyRejected, false);
assert.notEqual(first.copyMeta.skeleton, second.copyMeta.skeleton);
assert.notEqual(first.styleMode, second.styleMode);

const banned = validateGeneratedCopy(
  hot,
  '테스트 물티슈 16,500원',
  '핵심만 보면 16,500원입니다.\n무료배송.',
  [],
  'daangn'
);
assert.equal(banned.ok, false);
assert.ok(banned.reasons.includes('banned_ai_phrase'));

const fake = validateGeneratedCopy(
  hot,
  '테스트 물티슈 16,500원',
  '저도 샀어요.\n지금 16,500원 나와요.',
  [],
  'daangn'
);
assert.equal(fake.ok, false);
assert.ok(fake.reasons.includes('fake_experience'));

const cute = validateGeneratedCopy(
  hot,
  '테스트 물티슈 16,500원',
  '지금 16,500원 나와용.\n필요하면 보세용.',
  [],
  'daangn'
);
assert.equal(cute.ok, false);
assert.ok(cute.reasons.includes('cute_budget'));

const hype = validateGeneratedCopy(
  hot,
  '역대급 테스트 물티슈 16,500원',
  '무조건 이득입니다.\n지금 16,500원.',
  [],
  'daangn'
);
assert.equal(hype.ok, false);
assert.ok(hype.reasons.includes('hype_phrase'));

const unsupported = validateGeneratedCopy(
  hot,
  '테스트 물티슈 99,999원',
  '현재 99,999원.\n무료배송.',
  [],
  'daangn'
);
assert.equal(unsupported.ok, false);
assert.ok(unsupported.reasons.some(x => x.startsWith('unsupported_number:')));

const gaming = {
  ...hot,
  id: 'test:gaming',
  copyContext: {
    ...hot.copyContext,
    product: 'RTX 5090 게이밍 그래픽카드',
    category: '게이밍'
  }
};
assert.equal(itemQuality(gaming).ok, false);
const gamingCopy = selectCommunityCopy(gaming, [], 'daangn');
assert.equal(gamingCopy.copyRejected, true);

const event = {
  id: 'test:event',
  type: 'event',
  board: '💰 꿀팁 공유',
  sourceUrl: 'https://example.com/event/1',
  trustScore: 98,
  copyContext: {
    kind: 'event',
    intent: 'EVENT_FREE',
    name: '국가유산 미디어아트 부여 정림사지',
    region: '충청남도 부여군',
    cost: '무료',
    start: '9/7',
    end: '9/27',
    url: 'https://example.com/event/1',
    claims: [
      { key: 'name', value: '국가유산 미디어아트 부여 정림사지', confidence: 0.98 },
      { key: 'region', value: '충청남도 부여군', confidence: 0.98 },
      { key: 'price', value: '무료', confidence: 0.98 },
      { key: 'start', value: '9/7', confidence: 0.98 },
      { key: 'end', value: '9/27', confidence: 0.98 }
    ]
  }
};
const eventCandidates = renderCommunityCandidates(event, 'daangn');
assert.ok(eventCandidates.length >= 15);
assert.equal(eventCandidates.some(x => /부여\s+부여/.test(x.postTitle)), false);

const meta = buildCopyMeta(
  '테스트 물티슈 16,500원',
  '현재 16,500원.\n무료배송.\nhttps://example.com/p/1',
  { styleMode: 'PRICE_FIRST', skeleton: 'PRICE>SHIPPING', platform: 'daangn' }
);
assert.equal(meta.linkPosition, 'end');
assert.equal(meta.cuteEndingCount, 0);

assert.equal(platformProfile('daangn').maxCutePerPost, 1);
assert.equal(platformProfile('ppomppu').maxCutePerPost, 0);

console.log('copy-engine v3 tests passed');
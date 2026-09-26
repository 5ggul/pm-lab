import assert from 'node:assert/strict';
import { selectCommunityCopy, validateGeneratedCopy } from './copy-engine.mjs';

assert.equal(
  validateGeneratedCopy('물티슈 20팩 16,500원', '지금 16,500원 나와요.\n무료배송.\nhttps://example.com').ok,
  true
);

assert.equal(
  validateGeneratedCopy('테스트', '핵심만 보면 20,000원입니다.').ok,
  false
);

assert.equal(
  validateGeneratedCopy('테스트', '저도 샀어요. 가격 괜찮네요.').ok,
  false
);

assert.equal(
  validateGeneratedCopy('테스트', '지금 나와용.\n한번 보세용.\n요건 챙겨용.').ok,
  false
);

const item = {
  id: 'test:1',
  type: 'hotdeal',
  board: '🎁 핫딜 정보',
  sourceUrl: 'https://example.com/p/1',
  copyContext: {
    kind: 'hotdeal',
    intent: 'DEAL_UNIT',
    product: '테스트 물티슈 20팩',
    price: 16500,
    baselinePrice: 22000,
    saving: 5500,
    discountPct: 25,
    unitInfo: { count: 20, unit: '팩' },
    unitPrice: 825,
    shipping: '무료배송',
    category: '생활용품',
    buyUrl: 'https://example.com/p/1'
  }
};

const first = selectCommunityCopy(item, []);
const second = selectCommunityCopy(item, [{
  title: first.postTitle,
  titlePattern: first.titlePattern,
  bodyPattern: first.bodyPattern,
  copyMeta: first.copyMeta
}]);

assert.equal(validateGeneratedCopy(first.postTitle, first.postBody).ok, true);
assert.equal(validateGeneratedCopy(second.postTitle, second.postBody).ok, true);
assert.notEqual(first.copyMeta.skeleton, second.copyMeta.skeleton);

console.log('copy-engine v2 tests passed');
import assert from 'node:assert/strict';
import { buildInfoCardModel, imageSafetyPlan, remoteImageApproval, renderInfoCardHtml } from './image-safety.mjs';
import { publishOne as safePublishOne } from './safe-publisher.mjs';
import { chromium } from 'playwright';

const base = {
  type: 'hotdeal',
  imageRequired: true,
  imageUrl: 'https://shop.example/product.jpg',
  imageUsageApproved: true,
  sourceUrl: 'https://shop.example/products/1',
  verification: { status: 'verified' },
  copyContext: {
    kind: 'hotdeal',
    product: '테스트 상품 <script>alert(1)</script>',
    price: 12960,
    referencePrice: 14400,
    saving: 1440,
    shipping: '기본배송 무료',
    requiredConditions: ['할인 기한: 10/31 23:59', '카드할인·적립금 제외'],
    claims: [
      { key: 'current_price', value: 12960, verified: true },
      { key: 'shipping', value: '기본배송 무료', verified: true },
      { key: 'condition_0', value: '할인 기한: 10/31 23:59', verified: true },
      { key: 'condition_1', value: '카드할인·적립금 제외', verified: true }
    ]
  }
};

assert.equal(remoteImageApproval(base).approved, false, 'boolean-only merchant approval must never authorize reuse');
assert.deepEqual(imageSafetyPlan(base), { mode: 'generated_card', reason: 'remote_rights_unverified' });

const approved = {
  ...base,
  imageRights: {
    status: 'approved',
    basis: 'explicit_permission',
    sourceUrl: 'https://rights.example/permission/1',
    evidence: 'Written reuse permission from the image rights holder.'
  }
};
assert.equal(remoteImageApproval(approved).approved, true);
assert.equal(imageSafetyPlan(approved).mode, 'remote');

const merchantPageOnly = {
  ...approved,
  imageRights: { ...approved.imageRights, basis: 'merchant_page' }
};
assert.equal(imageSafetyPlan(merchantPageOnly).mode, 'generated_card');
assert.deepEqual(imageSafetyPlan({ imageRequired: false, imageUrl: base.imageUrl }), {
  mode: 'none', reason: 'unapproved_optional_image_removed'
});

const model = buildInfoCardModel(base);
assert.equal(model.price, '12,960원');
assert.equal(model.referencePrice, '14,400원');
assert.equal(model.saving, '1,440원');
assert.equal(model.discountPercent, '10%');
assert.equal(model.shipping, '기본배송 무료');
const html = renderInfoCardHtml(model);
assert.ok(html.includes('판매 페이지 확인값'));
assert.ok(html.includes('12,960원'));
assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(!html.includes('<script>alert(1)</script>'));

assert.throws(() => buildInfoCardModel({ ...base, verification: { status: 'review' } }), /INFO_CARD_SOURCE_NOT_VERIFIED/);
assert.throws(() => buildInfoCardModel({ ...base, copyContext: { ...base.copyContext, claims: [] } }), /INFO_CARD_REQUIRED_FACT_MISSING/);

const originalLaunch = chromium.launch;
let browserLaunches = 0;
chromium.launch = async () => { browserLaunches += 1; throw new Error('UNEXPECTED_BROWSER_LAUNCH'); };
try {
  for (const kind of ['researched', 'event']) {
    for (const [type, board] of [['tip', '💰 꿀팁 공유'], ['hotdeal', '🎁 핫딜 정보']]) {
      const paused = {
        ...base,
        type,
        board,
        copyContext: { ...base.copyContext, kind, sourceTitle: '가족 문화축제 공식 안내' }
      };
      await assert.rejects(
        () => safePublishOne(paused),
        error => error.message === 'PUBLICATION_ROUTE_BLOCKED' && error.beforeSubmit === true
      );
    }
  }
  assert.equal(browserLaunches, 0, 'paused drafts must be blocked before image rendering or publication');
} finally {
  chromium.launch = originalLaunch;
}

console.log('image rights: structured approval, original-card fallback and verified-fact rendering passed');

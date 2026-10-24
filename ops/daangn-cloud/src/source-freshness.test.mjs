import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { planItem } from './growth-engine.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url), 'utf8'));
const cycleStartedAt = new Date('2026-10-24T09:59:44.000Z');

function verifiedDeal(observedAt) {
  const sourceUrl = 'https://shop.example.test/products/freshness-fixture';
  return {
    id: 'hot:freshness-fixture',
    type: 'hotdeal',
    board: '🎁 핫딜 정보',
    sourceUrl,
    buyUrl: sourceUrl,
    trustScore: 96,
    sellerKey: 'fixture-seller',
    verification: {
      status: 'verified',
      observedAt,
      fingerprint: 'fixture-fingerprint'
    },
    copyContext: {
      kind: 'hotdeal',
      intent: 'CURRENT_OFFER',
      currentOffer: true,
      product: '검증용 생수 20병',
      category: '먹거리·장보기',
      price: 10000,
      referencePrice: 12000,
      saving: 2000,
      shipping: '기본배송 무료',
      merchant: '가상판매처',
      buyUrl: sourceUrl,
      readerNeed: '장보기 비용 확인',
      editorialAngle: '현재 가격과 배송 조건 확인',
      shareRecipient: '같은 상품을 사는 사람',
      returnReason: '장보기 할인 정보',
      requiredConditions: [],
      claims: [
        { key: 'current_price', value: 10000, sourceUrl, verified: true },
        { key: 'reference_price', value: 12000, sourceUrl, verified: true }
      ]
    }
  };
}

test('FRESH-01 collection completed after cycle start is not falsely stale', () => {
  const observedAt = new Date(cycleStartedAt.getTime() + 10_000).toISOString();
  const plan = planItem(verifiedDeal(observedAt), config, cycleStartedAt);
  assert.equal(plan.reasons.includes('source_stale'), false);
});

test('FRESH-02 a timestamp more than five minutes in the future stays blocked', () => {
  const observedAt = new Date(cycleStartedAt.getTime() + 5 * 60_000 + 1).toISOString();
  const plan = planItem(verifiedDeal(observedAt), config, cycleStartedAt);
  assert.equal(plan.reasons.includes('source_stale'), true);
});

test('FRESH-03 a hot deal older than fifteen minutes stays blocked', () => {
  const observedAt = new Date(cycleStartedAt.getTime() - 15 * 60_000 - 1).toISOString();
  const plan = planItem(verifiedDeal(observedAt), config, cycleStartedAt);
  assert.equal(plan.reasons.includes('source_stale'), true);
});

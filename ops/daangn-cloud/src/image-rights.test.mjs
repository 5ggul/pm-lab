import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyImageRights,
  normalizeImageRightsUrl,
  resolveImageRights
} from './image-rights.mjs';
import { runtimeDraftFailures } from './work-hardening.mjs';

const now = new Date('2026-10-24T10:00:00Z');
const sourceUrl = 'https://shop.example.test/products/123';
const imageUrl = 'https://cdn.example.test/images/123.jpg';

function item(overrides = {}) {
  return {
    id: 'hot:123',
    type: 'hotdeal',
    board: '🎁 핫딜 정보',
    sourceUrl,
    imageUrl,
    imageRequired: true,
    imageUsageApproved: true,
    postTitle: '생수 20병 상품가 10,000원',
    postBody: '생수 20병 상품가 10,000원입니다.',
    verification: {
      status: 'verified',
      fingerprint: 'offer-fingerprint-v1'
    },
    copyContext: {
      kind: 'hotdeal',
      price: 10000,
      conditions: [],
      requiredConditions: []
    },
    ...overrides
  };
}

function approvedRegistry(overrides = {}) {
  return {
    version: 1,
    mode: 'enforce',
    entries: [{
      id: 'merchant-image-123',
      status: 'approved',
      sourceUrl,
      imageUrl,
      rightsHolder: 'Example Merchant',
      basis: 'written_permission',
      evidenceUrl: 'https://shop.example.test/legal/image-permission-123',
      approvedBy: 'operator@example.test',
      approvedAt: '2026-10-20T00:00:00Z',
      expiresAt: '2027-10-20T00:00:00Z',
      platforms: ['daangn'],
      uses: ['community-post'],
      sourceFingerprint: 'offer-fingerprint-v1',
      ...overrides
    }]
  };
}

test('IMG-01 URL normalization removes tracking without broadening the asset match', () => {
  assert.equal(
    normalizeImageRightsUrl('https://cdn.example.test/images/123.jpg?utm_source=x&size=large#hero'),
    'https://cdn.example.test/images/123.jpg?size=large'
  );
  assert.equal(normalizeImageRightsUrl('javascript:alert(1)'), '');
});

test('IMG-02 an exact evidence-backed approval is accepted', () => {
  const candidate = item();
  const result = applyImageRights(candidate, { registry: approvedRegistry(), now });
  assert.equal(result.approved, true);
  assert.equal(candidate.imageUsageApproved, true);
  assert.equal(candidate.imageRights.id, 'merchant-image-123');
  assert.equal(candidate.verification.imageRightsStatus, 'approved');
});

test('IMG-03 a legacy true flag is overridden when the ledger has no approval', () => {
  const candidate = item({ imageUsageApproved: true });
  const result = applyImageRights(candidate, {
    registry: { version: 1, mode: 'enforce', entries: [] },
    now
  });
  assert.equal(result.approved, false);
  assert.equal(result.reason, 'IMAGE_RIGHTS_NOT_APPROVED');
  assert.equal(candidate.imageUsageApproved, false);
  assert.equal(candidate.imageRights.status, 'not_approved');
});

test('IMG-04 source, image and offer fingerprint remain exact-match gates', () => {
  assert.equal(resolveImageRights(item({ imageUrl: imageUrl + '?variant=2' }), {
    registry: approvedRegistry(), now
  }).reason, 'IMAGE_RIGHTS_NOT_APPROVED');

  assert.equal(resolveImageRights(item({ verification: { status: 'verified', fingerprint: 'changed' } }), {
    registry: approvedRegistry(), now
  }).reason, 'IMAGE_RIGHTS_SOURCE_CHANGED');
});

test('IMG-05 expired, weak-scope and malformed approvals are rejected', () => {
  assert.equal(resolveImageRights(item(), {
    registry: approvedRegistry({ expiresAt: '2026-10-23T00:00:00Z' }), now
  }).reason, 'IMAGE_RIGHTS_EXPIRED');

  assert.equal(resolveImageRights(item(), {
    registry: approvedRegistry({ platforms: ['instagram'] }), now
  }).reason, 'IMAGE_RIGHTS_SCOPE_INVALID');

  assert.equal(resolveImageRights(item(), {
    registry: approvedRegistry({ evidenceUrl: '' }), now
  }).reason, 'IMAGE_RIGHTS_EVIDENCE_MISSING');

  assert.equal(resolveImageRights(item(), {
    registry: { version: 2, mode: 'enforce', entries: [] }, now
  }).reason, 'IMAGE_RIGHTS_REGISTRY_INVALID');
});

test('IMG-06 draft validation blocks unapproved required images before submission', () => {
  const denied = item();
  const deniedFailures = runtimeDraftFailures(denied, {
    now,
    imageRightsRegistry: { version: 1, mode: 'enforce', entries: [] }
  });
  assert.ok(deniedFailures.includes('IMAGE_RIGHTS_NOT_APPROVED'));
  assert.equal(denied.imageUsageApproved, false);

  const approved = item();
  const approvedFailures = runtimeDraftFailures(approved, {
    now,
    imageRightsRegistry: approvedRegistry()
  });
  assert.equal(approvedFailures.some(code => code.startsWith('IMAGE_RIGHTS_')), false);
  assert.equal(approved.imageUsageApproved, true);
});

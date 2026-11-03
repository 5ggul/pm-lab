import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationHealth } from './publication-health.mjs';

const NOW = new Date('2026-11-03T05:30:00Z');
const post = (publishedAt, status = 'published', postUrl = 'https://cafe.daangn.com/don-akkineun-sa/posts/confirmed') =>
  ({ status, publishedAt, postUrl });

test('publication monitor recognizes a saved real cafe post, not the workflow status', () => {
  const actual = publicationHealth([post('2026-11-03T05:13:27Z')], NOW);
  assert.equal(actual.stalled, false);
  assert.equal(actual.confirmedToday, 1);
  assert.equal(actual.lastConfirmedAt, '2026-11-03T05:13:27.000Z');
});

test('a missing, uncertain or foreign-cafe post cannot clear the 48-hour warning', () => {
  const rows = [
    post('2026-11-01T05:29:59Z'),
    post('2026-11-03T05:13:27Z', 'publish_unknown'),
    post('2026-11-03T05:13:27Z', 'published', 'https://cafe.daangn.com/another-cafe/posts/confirmed')
  ];
  const health = publicationHealth(rows, NOW);
  assert.equal(health.stalled, true);
  assert.equal(health.confirmedToday, 0);
  assert.ok(health.idleHours > 48);
  assert.equal(publicationHealth([], NOW).stalled, true);
});

test('corrupted inputs fail closed instead of silently closing an incident', () => {
  assert.throws(() => publicationHealth({}, NOW), /INPUT_INVALID/);
  assert.throws(() => publicationHealth([], new Date('invalid')), /INPUT_INVALID/);
});

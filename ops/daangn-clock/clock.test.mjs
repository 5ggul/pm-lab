import assert from 'node:assert/strict';
import test from 'node:test';
import { runClock, clockSlot } from './clock.mjs';

const config = {
  enabled: true,
  slotHoursKst: [12, 18, 21],
  utilitySlotHoursKst: [9, 15],
  maxTechnicalAttempts: 2,
  researchWarmupHoursKst: []
};
const scheduledTime = Date.parse('2026-09-27T03:10:00Z'); // 12:10 KST
const env = { GITHUB_DISPATCH_TOKEN: 'test-only' };

function fixture(ledger = {}, runs = []) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, init = {}) => {
      calls.push({ url, ...init });
      if (init.method === 'POST') return new Response(null, { status: 204 });
      if (url.includes('/contents/')) {
        return Response.json({
          content: Buffer.from(JSON.stringify(url.includes('growth-config') ? config : ledger)).toString('base64')
        });
      }
      return Response.json({ workflow_runs: runs });
    }
  };
}

test('commercial clock opens only configured KST slots after minute seven', () => {
  assert.equal(clockSlot(Date.parse('2026-09-27T03:06:59Z'), config), null);
  assert.equal(clockSlot(Date.parse('2026-09-27T03:10:00Z'), config), '2026-09-27@12');
  assert.equal(clockSlot(Date.parse('2026-09-27T09:10:00Z'), config), '2026-09-27@18');
  assert.equal(clockSlot(Date.parse('2026-09-27T12:10:00Z'), config), '2026-09-27@21');
  assert.equal(clockSlot(Date.parse('2026-09-27T00:10:00Z'), config), null, '09 KST belongs to utility workflow');
  assert.equal(clockSlot(Date.parse('2026-09-27T06:10:00Z'), config), null, '15 KST belongs to utility workflow');
});

test('missing commercial slot dispatches production workflow', async () => {
  const f = fixture();
  const result = await runClock({ scheduledTime }, env, f.fetcher);
  assert.equal(result.status, 'dispatched');
  assert.equal(result.slot, '2026-09-27@12');
  assert.deepEqual(JSON.parse(f.calls.at(-1).body), { ref: 'main', inputs: { collect_only: false } });
});

test('utility hours are not dispatched through commercial clock', async () => {
  const f = fixture();
  const result = await runClock({ scheduledTime: Date.parse('2026-09-27T00:10:00Z') }, env, f.fetcher);
  assert.equal(result.status, 'outside_slot');
  assert.ok(f.calls.every(call => call.method !== 'POST'));
});

test('terminal and uncertain states prevent duplicate commercial dispatch', async () => {
  for (const status of ['published', 'publishing', 'publish_unknown', 'daily_cap', 'no_candidate', 'quality_or_category_skip']) {
    const f = fixture({ '2026-09-27@12': { status } });
    assert.equal((await runClock({ scheduledTime }, env, f.fetcher)).status, 'slot_handled');
    assert.ok(f.calls.every(call => call.method !== 'POST'));
  }
});

test('active workflow and exhausted retries stop dispatch', async () => {
  let f = fixture({}, [{ status: 'queued' }]);
  assert.equal((await runClock({ scheduledTime }, env, f.fetcher)).status, 'workflow_active');

  f = fixture({ '2026-09-27@12': { status: 'technical_failure', attempts: 2 } });
  assert.equal((await runClock({ scheduledTime }, env, f.fetcher)).status, 'retry_blocked');

  f = fixture({}, Array.from({ length: 2 }, () => ({
    status: 'completed',
    event: 'workflow_dispatch',
    created_at: '2026-09-27T03:08:00Z'
  })));
  assert.equal((await runClock({ scheduledTime }, env, f.fetcher)).status, 'dispatch_limit');
});

test('GitHub errors fail closed without dispatch', async () => {
  await assert.rejects(
    runClock({ scheduledTime }, env, async () => new Response('', { status: 403 })),
    /GITHUB_403/
  );
});

test('empty commercial supply retries once after cooldown, submitted posts never retry', async () => {
  const slot = '2026-09-27@12';
  const entry = { status: 'no_candidate', attempts: 1, finishedAt: '2026-09-27T03:10:00Z' };
  let f = fixture({ [slot]: entry });
  assert.equal((await runClock({ scheduledTime: Date.parse('2026-09-27T03:35:00Z') }, env, f.fetcher)).status, 'dispatched');

  for (const patch of [{ attempts: 2 }, { key: 'reserved' }, { status: 'published' }, { status: 'publish_unknown' }]) {
    f = fixture({ [slot]: { ...entry, ...patch } });
    await runClock({ scheduledTime: Date.parse('2026-09-27T03:35:00Z') }, env, f.fetcher);
    assert.ok(f.calls.every(call => call.method !== 'POST'));
  }
});

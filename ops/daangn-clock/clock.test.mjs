import assert from 'node:assert/strict';
import test from 'node:test';
import { runClock, clockSlot } from './clock.mjs';
const config = { enabled: true, slotHoursKst: Array.from({length:15}, (_,i)=>i+8), maxTechnicalAttempts:2 };
const scheduledTime = Date.parse('2026-09-27T05:10:00Z');
const env = { GITHUB_DISPATCH_TOKEN: 'test-only' };
function fixture(ledger = {}, runs = []) {
  const calls = [];
  return { calls, fetcher: async (url, init) => {
    calls.push({url, ...init});
    if (init.method === 'POST') return new Response(null, {status:204});
    if (url.includes('/contents/')) return Response.json({content: Buffer.from(JSON.stringify(url.includes('growth-config') ? config : ledger)).toString('base64')});
    return Response.json({workflow_runs:runs});
  }};
}
test('KST boundary and seven-minute minimum', () => {
  assert.equal(clockSlot(Date.parse('2026-09-26T23:05:00Z'), config), null);
  assert.equal(clockSlot(Date.parse('2026-09-26T23:10:00Z'), config), '2026-09-27@8');
  assert.equal(clockSlot(Date.parse('2026-09-27T14:10:00Z'), config), null);
});
test('missing slot dispatches only production workflow', async () => {
  const f=fixture(); assert.equal((await runClock({scheduledTime},env,f.fetcher)).status,'dispatched');
  assert.deepEqual(JSON.parse(f.calls.at(-1).body), {ref:'main',inputs:{collect_only:false}});
});
test('all terminal and uncertain states prevent duplicate dispatch', async () => {
  for (const status of ['published','publishing','publish_unknown','daily_cap','no_candidate','quality_or_category_skip']) {
    const f=fixture({'2026-09-27@14':{status}});
    assert.equal((await runClock({scheduledTime},env,f.fetcher)).status,'slot_handled');
    assert.ok(f.calls.every(c=>c.method !== 'POST'));
  }
});
test('active workflow and exhausted retries stop dispatch', async () => {
  let f=fixture({},[{status:'queued'}]); assert.equal((await runClock({scheduledTime},env,f.fetcher)).status,'workflow_active');
  f=fixture({'2026-09-27@14':{status:'technical_failure',attempts:2}}); assert.equal((await runClock({scheduledTime},env,f.fetcher)).status,'retry_blocked');
  f=fixture({},Array.from({length:2},()=>({status:'completed',event:'workflow_dispatch',created_at:'2026-09-27T05:08:00Z'})));
  assert.equal((await runClock({scheduledTime},env,f.fetcher)).status,'dispatch_limit');
});
test('GitHub errors fail closed without dispatch', async()=>{
  await assert.rejects(runClock({scheduledTime},env,async()=>new Response('',{status:403})),/GITHUB_403/);
});

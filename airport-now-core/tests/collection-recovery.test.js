import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWithRecovery,retryableFailure} from '../scripts/collection-recovery.mjs';
test('successful primary collection avoids unnecessary provider requests',async()=>{
  const calls=[];
  const result=await collectWithRecovery({worker:async name=>{calls.push(name);return {ok:true};},runner:async()=>{throw Error('unexpected fallback');}});
  assert.equal(result.ok,true);assert.deepEqual(calls,['primary']);
});
test('transient failure uses an alternate origin then bounded final recovery',async()=>{
  let clock=0;const calls=[];
  const result=await collectWithRecovery({now:()=>clock,sleep:async ms=>{clock+=ms;},worker:async(name,budget)=>{calls.push([name,budget]);clock+=budget;return {ok:name==='recovery'};},runner:async(name,budget)=>{calls.push([name,budget]);clock+=budget;return {ok:false};}});
  assert.equal(result.ok,true);assert.deepEqual(calls,[['primary',150000],['runner',90000],['recovery',140000]]);assert.equal(clock,390000);
});
test('authorization and quota failures stop rather than retrying across origins',async()=>{
  for(const report of [{httpStatus:404},{result:{kacArrival:{error:'GATEWAY_22'}}},{result:{kacArrival:{error:'GATEWAY_30'}}}])assert.equal(retryableFailure(report,'kacArrival'),false);
  assert.equal(retryableFailure({result:{kacArrival:{error:'GATEWAY_05'}}},'kacArrival'),true);
  const result=await collectWithRecovery({worker:async()=>({ok:false,retryable:false}),runner:async()=>{throw Error('must not retry');}});
  assert.equal(result.ok,false);
});

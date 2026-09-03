import test from 'node:test';import assert from 'node:assert/strict';import worker,{handleRequest} from '../src/worker.js';
test('readiness exposes no production-ready sources',async()=>{const r=await handleRequest(new Request('https://preview.local/api/readiness'),{});assert.equal(r.status,200);const j=await r.json();assert.equal(j.productionReadyCount,0);assert.ok(j.sources.every(x=>x.productionEnabled===false))});
test('data route refuses when D1 is not bound',async()=>{const r=await handleRequest(new Request('https://preview.local/api/search/flights?q=KE123'),{});assert.equal(r.status,503);assert.equal((await r.json()).error,'D1_NOT_BOUND')});
test('scheduled ingest is hard blocked',()=>assert.throws(()=>worker.scheduled(),/SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL/));

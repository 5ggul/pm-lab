import test from 'node:test';
import assert from 'node:assert/strict';
import clock,{runClock} from '../src/collector-clock.js';
test('clock isolates all sources, retries transient failures, and sends no provider credentials',async()=>{
  const counts=new Map();let active=0,peak=0;
  const report=await runClock({scheduledTime:123},{INGEST_TOKEN:'internal-test',CORE:{async fetch(req){
    const body=await req.json(),key=body.icao||body.task;
    assert.equal(req.headers.get('authorization'),'Bearer internal-test');
    assert.deepEqual(Object.keys(body).sort(),(body.icao?['task','icao','runId']:['task','runId']).sort());
    assert.match(body.runId,/^cron\.123\./);
    counts.set(key,(counts.get(key)||0)+1);active++;peak=Math.max(peak,active);
    await new Promise(r=>setTimeout(r,1));active--;
    const ok=key!=='iiacArrival'||counts.get(key)>1;
    return Response.json({result:{[body.task]:{ok,error:ok?null:'FETCH_TIMEOUT'}}});
  }}},{sleep:async()=>{}});
  assert.equal(report.results.length,19);assert.equal(report.ok,true);
  assert.equal(counts.get('iiacArrival'),2);assert.ok(peak<=6);
});
test('terminal failures do not prevent other sources and do not retry',async()=>{
  let count=0;
  await assert.rejects(runClock({scheduledTime:1},{INGEST_TOKEN:'test',CORE:{async fetch(){count++;return Response.json({error:'FORBIDDEN'},{status:403});}}},{sleep:async()=>{}}),/CLOCK_COLLECTION_INCOMPLETE/);
  assert.equal(count,19);assert.equal(clock.fetch().status,404);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {handleInternalIngest} from '../src/internal-ingest.js';
const token='test-token-abcdefghijklmnopqrstuvwxyz12345';
function db(){let busy=false;return {prepare(sql){return {bind(){return {async run(){if(sql.startsWith('INSERT')){if(busy)return{meta:{changes:0}};busy=true;}else busy=false;return{meta:{changes:1}};}};}};}};}
const env=()=>({APP_ENV:'preview',INGEST_TOKEN:token,DB:db()});
const req=(body={task:'iiacArrival',serviceKey:'fixture-key'},auth=token)=>new Request('https://test/internal/ingest/once',{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:JSON.stringify(body)});
test('ingest is hidden without a token or in production',async()=>{
  assert.equal((await handleInternalIngest(req({},'wrong'),env())).status,404);
  assert.equal((await handleInternalIngest(req(),{...env(),APP_ENV:'production'})).status,404);
  assert.equal((await handleInternalIngest(req(),{...env(),INGEST_TOKEN:''})).status,404);
});
test('ingest rejects malformed targets and oversized bodies before execution',async()=>{
  assert.equal((await handleInternalIngest(req({task:'unknown'}),env())).status,400);
  assert.equal((await handleInternalIngest(req({task:'metar',icao:'XXXX',kmaKey:'fixture'}),env())).status,400);
  assert.equal((await handleInternalIngest(req({task:'iiacArrival',serviceKey:'x'.repeat(5000)}),env())).status,413);
});
test('single-source invocation does not echo credentials and releases failure locks',async()=>{
  const e=env();let seen;
  const r=await handleInternalIngest(req(),e,{run:async(values,options)=>{seen={values,options};return{iiacArrival:{ok:true}};}});
  assert.equal(r.status,200);assert.deepEqual(seen.options.tasks,['iiacArrival']);
  assert.equal(seen.values.DATA_GO_KR_SERVICE_KEY,'fixture-key');assert.doesNotMatch(await r.text(),/fixture-key|Bearer/);
  assert.equal((await handleInternalIngest(req(),e,{run:async()=>{throw new Error('secret-data')}})).status,500);
  assert.equal((await handleInternalIngest(req(),e,{run:async()=>({iiacArrival:{ok:true}})})).status,200);
});
test('concurrent collector is rejected until the active run releases the lease',async()=>{
  const e=env();let release,started;const ready=new Promise(r=>started=r);
  const first=handleInternalIngest(req(),e,{run:async()=>{started();await new Promise(r=>release=r);return{iiacArrival:{ok:true}};}});
  await ready;assert.equal((await handleInternalIngest(req(),e)).status,409);
  release();assert.equal((await first).status,200);
});

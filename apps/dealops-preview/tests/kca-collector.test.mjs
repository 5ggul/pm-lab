import test from 'node:test';
import assert from 'node:assert/strict';
import {extractContentUrl,parseCsv,selectCandidates,toPayload,DATASET_PAGE} from '../collector/kca-price.mjs';
import worker from '../cloudflare/worker.mjs';
import {SQLiteD1} from './d1-sqlite.mjs';

const sampleRows=[
 {'상품명':'비비고 사골곰탕(500g)','조사일':'2026-08-28','판매가격':'2900','판매업소':'GS25(본사)','제조사':'CJ제일제당','세일여부':'N','원플러스원':'N'},
 {'상품명':'비비고 사골곰탕(500g)','조사일':'2026-08-28','판매가격':'1480','판매업소':'GS더프레시상계점','제조사':'CJ제일제당','세일여부':'Y','원플러스원':''},
 {'상품명':'비비고 사골곰탕(500g)','조사일':'2026-08-28','판매가격':'1500','판매업소':'GS더프레시본리점','제조사':'CJ제일제당','세일여부':'Y','원플러스원':''},
 {'상품명':'오뚜기 쇠고기미역국밥(314g)','조사일':'2026-08-28','판매가격':'4800','판매업소':'CU(본사)','제조사':'오뚜기','세일여부':'','원플러스원':'Y'},
 {'상품명':'물티슈 80매','조사일':'2026-08-07','판매가격':'2000','판매업소':'테스트점','제조사':'테스트','세일여부':'Y','원플러스원':''}
];

test('KCA page parser only accepts official data.go.kr file download URL',()=>{
  const u=extractContentUrl(`<script>{"contentUrl":"https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_1&fileDetailSn=1"}</script>`);
  assert.match(u,/^https:\/\/www\.data\.go\.kr\/cmm\/cmm\/fileDownload\.do/);
  assert.throws(()=>extractContentUrl('{"contentUrl":"https://evil.example/x.csv"}'));
});

test('CSV parser handles quoted commas and doubled quotes',()=>{
  const rows=parseCsv('상품명,조사일,판매가격,판매업소,제조사,세일여부,원플러스원\r\n"A, B",2026-08-28,1000,"점포 ""1""",회사,Y,N\r\n');
  assert.equal(rows[0]['상품명'],'A, B');assert.equal(rows[0]['판매업소'],'점포 "1"');
});

test('candidate selector uses latest survey, flagged rows and one product once',()=>{
  const x=selectCandidates(sampleRows,{now:Date.parse('2026-09-24T12:00:00+09:00'),limit:12});
  assert.equal(x.latest,'2026-08-28');assert.equal(x.candidates.length,2);
  assert.equal(x.candidates[0].onePlusOne,'Y');
  assert.equal(x.candidates.filter(v=>v.product.includes('사골곰탕')).length,1);
  assert.throws(()=>selectCandidates(sampleRows,{now:Date.parse('2026-12-31T12:00:00+09:00')}),/45일/);
});

test('payload labels survey facts and never marks current availability',()=>{
  const sel=selectCandidates(sampleRows,{now:Date.parse('2026-09-24T12:00:00+09:00')});
  const p=toPayload(sel,{generatedAt:1});assert.equal(p.source.url,DATASET_PAGE);assert.equal(p.source.mode,'permission');
  assert.ok(p.offers.every(x=>x.conditions.includes('조사 시점 기준')));assert.ok(p.offers.every(x=>x.endsAt===null&&x.affiliate===false));
});

test('Cloudflare collector imports unverified review candidates and never drafts, approves or publishes',async()=>{
  const db=new SQLiteD1();const token='collector-test-token-000000000000000000000';
  const env={DB:db,COLLECTOR_ENABLED:'true',COLLECTOR_TOKEN:token,AI_ENABLED:'false',ASSETS:{fetch:async()=>new Response('asset')}};
  try{
    const sel=selectCandidates(sampleRows,{now:Date.parse('2026-09-24T12:00:00+09:00')});const payload=toPayload(sel,{generatedAt:1});
    async function send(auth=token){const r=await worker.fetch(new Request('https://dealops.test/api/collector/kca',{method:'POST',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json','x-dealops-source':'kca-price-csv'},body:JSON.stringify(payload)}),env);return {r,data:await r.json()}}
    assert.equal((await send('wrong-token-000000000000000000000000')).r.status,401);
    const first=await send();assert.equal(first.r.status,200,JSON.stringify(first.data));assert.equal(first.data.added,2);assert.equal(first.data.drafted,0);
    const state=await worker.fetch(new Request('https://dealops.test/api/workspaces/local'),env);assert.equal(state.status,401);
    const row=await db.prepare("SELECT body FROM dealops_state WHERE id='global'").first(),saved=JSON.parse(row.body),store=saved.workspaces.local.store;
    assert.equal(store.sources[0].mode,'permission');assert.equal(store.sources[0].sourceKey,'kca-price-csv');assert.equal(store.offers.length,2);
    for(const o of store.offers){assert.equal(o.state,'NEW');assert.equal(o.sourceChecked,false);assert.equal(o.checkedAt,null);assert.equal(o.approval,null);assert.equal(o.publication,null);assert.equal(o.draft,null);assert.equal(o.volatile,true);}
    store.offers[0].sourceChecked=true;store.offers[0].checkedAt=Date.now();store.offers[0].draft={humanEdited:false,checkedAt:Date.now()};store.offers[0].state='DRAFTED';
    await db.prepare("UPDATE dealops_state SET body=? WHERE id='global'").bind(JSON.stringify(saved)).run();
    const second=await send();assert.equal(second.r.status,200);assert.equal(second.data.added,0);assert.equal(second.data.unchanged,2);assert.equal(second.data.reset,1);
    const row2=await db.prepare("SELECT body FROM dealops_state WHERE id='global'").first(),saved2=JSON.parse(row2.body),migrated=saved2.workspaces.local.store.offers.find(x=>x.id===store.offers[0].id);assert.equal(migrated.state,'NEW');assert.equal(migrated.sourceChecked,false);assert.equal(migrated.checkedAt,null);assert.equal(migrated.draft,null);
    const runs=await db.prepare('SELECT status,items_seen FROM collector_runs ORDER BY created_at').all();assert.equal(runs.results.at(-1).status,'completed');assert.equal(runs.results.at(-1).items_seen,2);
  }finally{db.close();}
});

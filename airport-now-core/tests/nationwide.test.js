import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {flightTime,comparisonTime} from '../src/flight-time.js';
import {flightUrl,parseFlightEnvelope,fetchFlightRows} from '../src/flight-client.js';
import {normalizeIiacDetail,normalizeKacFlight,collapseFlightRows} from '../src/flight-live.js';
import {ingestFlightRows,ingestOnce} from '../src/ingest/once.js';
import {persistFlightBatch} from '../src/storage/flight-batch.js';
import {ingestKmaMetarPayload} from '../src/ingest/kma-metar.js';
import {currentWeather} from '../src/read-model.js';
import {verifyReadPath} from '../scripts/verify-read-path.mjs';

const ctx={provider:'IIAC',direction:'DEPARTURE',serviceDate:'2026-09-06',observedAt:'2026-09-06T06:01:00Z'};
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/iiac-departure-live-sample.json',import.meta.url),'utf8'));
const arrival=JSON.parse(fs.readFileSync(new URL('./fixtures/iiac-arrival-detail-live-sample.json',import.meta.url),'utf8'));
// Synthetic KAC contract examples; not represented as captured live observations.
const kac={flightid:'KE123',masterflightid:'',codeshare:'N',depAirportCode:'GMP',arrvAirportCode:'CJU',
  io:'Out',scheduledatetime:'202609062350',estimateddatetime:'0015',rmkKor:'지연',fgenTime:'20260906234000',fid:'synthetic-1'};
const envelope=(rows,pageNo=1,totalCount=rows.length,numOfRows=100)=>({response:{header:{resultCode:'00'},body:{items:{item:rows},pageNo,totalCount,numOfRows}}});
function dbAdapter(t) {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));t.after(()=>sqlite.close());
  return {sqlite,prepare(sql){return {first:async()=>sqlite.prepare(sql).get(),all:async()=>({results:sqlite.prepare(sql).all()}),bind(...values){
    const params=values.map(v=>v===undefined?null:typeof v==='boolean'?Number(v):v);
    return {all:async()=>({results:sqlite.prepare(sql).all(...params)}),first:async()=>sqlite.prepare(sql).get(...params)||null,
      run:async()=>({meta:sqlite.prepare(sql).run(...params)})};
  }};},async batch(statements){sqlite.exec('BEGIN');try {const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}

test('provider KST timestamps validate dates and roll over only time-only values',()=>{
  assert.equal(flightTime('202609062350','2026-09-06'),'2026-09-06T23:50:00+09:00');
  assert.equal(comparisonTime('0015','2026-09-06','2026-09-06T23:50:00+09:00'),'2026-09-07T00:15:00+09:00');
  assert.equal(comparisonTime('202609060015','2026-09-06','2026-09-06T23:50:00+09:00'),'2026-09-06T00:15:00+09:00');
  for(const v of ['202602300000','202609062401','202609062360','abc'])assert.throws(()=>flightTime(v,ctx.serviceDate));
});
test('encoded and decoded service keys produce identical single-encoded query',()=>{
  const args={provider:'KAC',direction:'DEPARTURE',serviceDate:ctx.serviceDate};
  assert.equal(flightUrl({...args,serviceKey:'abc+/='}).href,flightUrl({...args,serviceKey:'abc%2B%2F%3D'}).href);
  assert.equal(flightUrl({...args,serviceKey:'abc+/='}).searchParams.get('searchday'),'20260906');
});
test('flight envelope rejects HTTP-200 errors and incomplete metadata, accepts singleton and empty',()=>{
  assert.throws(()=>parseFlightEnvelope({OpenAPI_ServiceResponse:{cmmMsgHeader:{returnReasonCode:'04'}}}),/GATEWAY_04/);
  assert.throws(()=>parseFlightEnvelope(envelope([],1,1)),/WITHOUT_ROWS/);
  assert.equal(parseFlightEnvelope(envelope(kac,1,1)).rows.length,1);
  assert.deepEqual(parseFlightEnvelope(envelope([])).rows,[]);
});
test('pagination consumes final partial page and rejects repeated pages and changing total',async()=>{
  const args={provider:'KAC',direction:'DEPARTURE',serviceDate:ctx.serviceDate,serviceKey:'fixture'};
  let calls=0;
  const result=await fetchFlightRows(args,{fetchImpl:async()=>new Response(JSON.stringify(envelope([{id:++calls}],calls,2,1)))});
  assert.equal(result.rows.length,2);assert.equal(result.pages,2);
  calls=0;
  await assert.rejects(fetchFlightRows(args,{fetchImpl:async()=>new Response(JSON.stringify(envelope([{id:1}],++calls,2,1)))}),/REPEATED_PAGE/);
  calls=0;
  await assert.rejects(fetchFlightRows(args,{fetchImpl:async()=>new Response(JSON.stringify(envelope([{id:++calls}],calls,calls===1?2:3,1)))}),/TOTAL_CHANGED/);
});
test('IIAC live detail departure has ICN origin, counter, terminal and master aliases',()=>{
  const r=collapseFlightRows(fixture.rows,normalizeIiacDetail,ctx);
  assert.equal(r.diagnostics.rejectedRows,0);assert.ok(r.aliases.length>0);
  assert.ok(r.flights.every(f=>f.origin==='ICN'&&f.scheduledDeparture&&!f.scheduledArrival));
  const mh=r.flights.find(f=>f.flightNumber==='MH039');assert.equal(mh.terminal,'T1');assert.equal(mh.status,'DEPARTED');
  assert.ok(r.aliases.some(a=>a.marketingFlightNumber==='QR4497'&&a.operatingFlightNumber==='MH039'));
});
test('KAC canonical mapping preserves source timestamp, cancellations and time-derived delay',()=>{
  const f=normalizeKacFlight(kac,{...ctx,provider:'KAC'});assert.equal(f.delayMinutes,25);assert.equal(f.destination,'CJU');assert.equal(f.sourceUpdatedAt,'2026-09-06T23:40:00+09:00');
  assert.equal(normalizeKacFlight({...kac,rmkKor:'결항'},{...ctx,provider:'KAC'}).status,'CANCELLED');
  assert.equal(normalizeKacFlight({...kac,rmkKor:'정시'},{...ctx,provider:'KAC'}).status,'DELAYED');
  assert.throws(()=>normalizeKacFlight({...kac,io:'In'},ctx),/DIRECTION_MISMATCH/);
});
test('malformed rows are quarantined and duplicate/alias selection is order independent',()=>{
  const rows=[...fixture.rows,fixture.rows[0],{flightId:'invalid'}];
  const a=collapseFlightRows(rows,normalizeIiacDetail,ctx),b=collapseFlightRows([...rows].reverse(),normalizeIiacDetail,ctx);
  assert.equal(a.diagnostics.rejectedRows,1);
  assert.deepEqual(a.flights.sort((a,b)=>a.flightInstanceId.localeCompare(b.flightInstanceId)),b.flights.sort((a,b)=>a.flightInstanceId.localeCompare(b.flightInstanceId)));
  assert.equal(a.aliases.length,new Set(a.aliases.map(x=>x.marketingFlightNumber)).size);
});
test('SQL transaction persists operating flights, alias search and no-change replay without new events',async t=>{
  const db=dbAdapter(t);const first=await ingestFlightRows(db,fixture.rows,ctx);
  const second=await ingestFlightRows(db,fixture.rows,{...ctx,observedAt:'2026-09-06T06:02:00Z'});
  assert.equal(second.emittedEvents,0);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM flight_events').get().n,first.operatingFlights);
  await ingestFlightRows(db,arrival.rows,{...ctx,direction:'ARRIVAL'});
  await ingestFlightRows(db,[kac],{...ctx,provider:'KAC'});
  const reads=await verifyReadPath(db,ctx.serviceDate);assert.ok(reads.counts.flight_codeshares>0);
});
test('batch SQL rollback cannot leave current flight without its event',async t=>{
  const db=dbAdapter(t);db.sqlite.exec("CREATE TRIGGER fail_event BEFORE INSERT ON flight_events BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  await assert.rejects(ingestFlightRows(db,fixture.rows,ctx),/test failure/);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM flight_current').get().n,0);
});
test('older flight capture cannot overwrite a newer state',async t=>{
  const db=dbAdapter(t);await ingestFlightRows(db,fixture.rows,ctx);
  const older=fixture.rows.map(r=>({...r,remark:'결항'}));
  const r=await ingestFlightRows(db,older,{...ctx,observedAt:'2026-09-06T05:00:00Z'});assert.equal(r.emittedEvents,0);
});
test('one-shot isolates flight errors and each airport weather failure and refuses production',async t=>{
  const db=dbAdapter(t);const called=[];
  const result=await ingestOnce({APP_ENV:'test',DB:db,DATAKEY:'fixture',KMAKEY:'fixture'},{now:()=>ctx.observedAt,airports:[{icao:'RKPC'},{icao:'RKSI'}],
    fetchImpl:async url=>{called.push(String(url));if(String(url).includes('Departures'))return new Response(JSON.stringify(envelope(fixture.rows)));throw new Error('sensitive URL/key must not escape');}});
  assert.equal(result.iiacDeparture.ok,true);assert.equal(result.iiacArrival.ok,false);assert.equal(result.kacArrival.ok,false);
  assert.equal(Object.keys(result.metar.airports).length,2);assert.equal(called.length,6);
  assert.doesNotMatch(JSON.stringify(result),/sensitive/);
  await assert.rejects(ingestOnce({APP_ENV:'production',DB:db}),/NOT_ALLOWED/);
});
test('request-time weather query rejects stale and future rows even when collector is down',async t=>{
  const db=dbAdapter(t);db.sqlite.prepare('INSERT INTO weather_current (icao,kind,phenomenon_time,source_id,observed_at) VALUES (?,?,?,?,?)').run('RKPC','METAR','2026-09-06T04:00:00Z','KMA_METAR_SPECI',ctx.observedAt);
  assert.equal(await currentWeather(db,{icao:'RKPC',asOf:ctx.observedAt}),null);
  db.sqlite.prepare('UPDATE weather_current SET phenomenon_time=?').run('2026-09-06T07:00:00Z');
  assert.equal(await currentWeather(db,{icao:'RKPC',asOf:ctx.observedAt}),null);
});
test('captured METAR writes once, rejects another station and does not present stale data as current',async t=>{
  const db=dbAdapter(t);
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/kma-metar-live-sample.json',import.meta.url),'utf8'));
  const opts={observedAt:fixture.provenance.capturedAt,expectedIcao:'RKPC'};
  const first=await ingestKmaMetarPayload(db,fixture.payload,opts);assert.equal(first.currentWritten,1);
  assert.equal((await ingestKmaMetarPayload(db,fixture.payload,opts)).eventWritten,0);
  await assert.rejects(ingestKmaMetarPayload(db,fixture.payload,{...opts,expectedIcao:'RKSI'}),/STATION_MISMATCH/);
  const stale=await ingestKmaMetarPayload(db,fixture.payload,{...opts,observedAt:'2026-09-07T06:00:00Z'});assert.equal(stale.staleSkipped,1);
  assert.equal(await currentWeather(db,{icao:'RKPC',asOf:'2026-09-07T06:00:00Z'}),null);
});
test('captured KAC rows resolve aliases, keep actual movement times, and map advance cancellations',()=>{
  for(const direction of ['ARRIVAL','DEPARTURE']) {
    const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/kac-'+direction.toLowerCase()+'-live-sample.json',import.meta.url),'utf8'));
    const batch=collapseFlightRows(fixture.rows,normalizeKacFlight,{...ctx,provider:'KAC',direction});
    assert.equal(batch.diagnostics.rejectedRows,0);assert.ok(batch.flights.length>0);
    const completed=batch.flights.filter(f=>['ARRIVED','DEPARTED'].includes(f.status));
    assert.ok(completed.length);assert.ok(completed.every(f=>direction==='ARRIVAL'?f.actualArrival:f.actualDeparture));
    assert.ok(batch.aliases.every(a=>a.marketingFlightNumber!==a.operatingFlightNumber));
  }
  assert.equal(normalizeKacFlight({...kac,rmkKor:'사전결항'},ctx).status,'CANCELLED');
});
test('KAC cannot overwrite ICN board data but retains KAC-airport flights to ICN',()=>{
  assert.throws(()=>normalizeKacFlight({...kac,depAirportCode:'ICN'},ctx),/OUT_OF_SOURCE_SCOPE/);
  assert.equal(normalizeKacFlight({...kac,arrvAirportCode:'ICN'},ctx).destination,'ICN');
  const batch=collapseFlightRows([{...kac,depAirportCode:'ICN'}],normalizeKacFlight,ctx);
  assert.equal(batch.diagnostics.outOfScopeRows,1);assert.equal(batch.diagnostics.rejectedRows,0);
});

test('HTTP airport pages preserve equal-time rows and collection freshness expires independently of flight changes',async t=>{
  const db=dbAdapter(t),{handleRequest}=await import('../src/worker.js');
  await ingestFlightRows(db,arrival.rows,{provider:'IIAC',direction:'ARRIVAL',serviceDate:ctx.serviceDate,observedAt:ctx.observedAt});
  await db.prepare("INSERT INTO source_health(source_id,readiness,last_success_at) VALUES ('IIAC_PASSENGER_ARRIVAL','LIVE_CAPTURED',?1)").bind(new Date().toISOString()).run();
  const read=async(offset=0)=>{
    const r=await handleRequest(new Request('https://test/api/airports/ICN/flights?direction=ARRIVAL&date='+ctx.serviceDate+'&limit=1&offset='+offset),{DB:db});
    return {status:r.status,body:await r.json()};
  };
  const ids=[];for(let i=0;i<20;i++){const r=await read(i);assert.equal(r.status,200);assert.equal(r.body.collection.current,true);if(!r.body.results.length)break;ids.push(r.body.results[0].flight_instance_id);}
  assert.ok(ids.length>1);assert.equal(new Set(ids).size,ids.length);
  await db.prepare("UPDATE source_health SET last_success_at=?1").bind(new Date(Date.now()-31*60000).toISOString()).run();
  assert.equal((await read()).body.collection.current,false);
  assert.equal((await read(-1)).status,400);
});

test('protected runner capture persists through real SQL and replay adds no events',async t=>{
  const db=dbAdapter(t),{handleRequest}=await import('../src/worker.js'),{serviceDateKst}=await import('../src/airports.js');
  const completedAt=new Date().toISOString(),serviceDate=serviceDateKst(completedAt),day=serviceDate.replaceAll('-','');
  const row={...kac,scheduledatetime:day+'1200',estimateddatetime:'1220',fgenTime:day+'120000'};
  const body={task:'kacDeparture',runId:'test-capture',capture:{startedAt:completedAt,completedAt,serviceDate,pages:[JSON.stringify(envelope([row]))]}};
  const env={DB:db,APP_ENV:'preview',INGEST_TOKEN:'test-token-abcdefghijklmnopqrstuvwxyz12345'};
  const call=()=>handleRequest(new Request('https://test/internal/ingest/once',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.INGEST_TOKEN},body:JSON.stringify(body)}),env);
  const first=await call();assert.equal(first.status,200);assert.equal((await first.json()).result.kacDeparture.emittedEvents,1);
  assert.equal((await (await call()).json()).result.kacDeparture.emittedEvents,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM collection_runs').get().n,1);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ingest_locks').get().n,0);
  const status=await handleRequest(new Request('https://test/api/status'),env);assert.equal(status.status,200);assert.ok((await status.json()).monitoringSince);
});

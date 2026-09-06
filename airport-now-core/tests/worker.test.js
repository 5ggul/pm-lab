import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{handleRequest} from '../src/worker.js';

test('readiness exposes verified sources but keeps production ingest disabled',async()=>{
  const r=await handleRequest(new Request('https://preview.local/api/readiness'),{});
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.productionReadyCount,0);
  assert.ok(j.sources.every(x=>x.productionEnabled===false));
  const sources=Object.fromEntries(j.sources.map(source=>[source.id,source]));
  assert.equal(sources.IIAC_PASSENGER_ARRIVAL.state,'LIVE_VERIFIED');
  assert.equal(sources.KMA_METAR_SPECI.state,'LIVE_VERIFIED');
  assert.equal(sources.IIAC_PASSENGER_DEPARTURE.readiness,'FIXTURE_READY');
  assert.equal(sources.KAC_FLIGHT_STATUS_GW.readiness,'FIXTURE_READY');
  assert.equal(sources.KAC_FLIGHT_SEARCH_GW,undefined);
});

test('public read API exposes browser-safe CORS headers',async()=>{
  const r=await handleRequest(new Request('https://preview.local/api/health'),{});
  assert.equal(r.status,200);
  assert.equal(r.headers.get('access-control-allow-origin'),'*');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  const preflight=await handleRequest(new Request('https://preview.local/api/search/flights',{method:'OPTIONS'}),{});
  assert.equal(preflight.status,204);
  assert.match(preflight.headers.get('access-control-allow-methods')||'',/GET/);
});

test('non-GET methods are refused',async()=>{
  const r=await handleRequest(new Request('https://preview.local/api/health',{method:'POST'}),{});
  assert.equal(r.status,405);
  assert.equal((await r.json()).error,'METHOD_NOT_ALLOWED');
});

test('data route refuses when D1 is not bound',async()=>{
  const r=await handleRequest(new Request('https://preview.local/api/search/flights?q=KE123'),{});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'D1_NOT_BOUND');
});

test('weather route returns only the read-model current row',async()=>{
  const weather={icao:'RKPC',kind:'METAR',phenomenon_time:new Date(Date.now()-30*60*1000).toISOString(),mean_wind_speed:8.2,visibility:10000};
  const db={prepare(sql){assert.match(sql,/weather_current/);return{bind(...args){assert.equal(args[0],'RKPC');return{async first(){return weather}}}}}};
  const r=await handleRequest(new Request('https://preview.local/api/weather/RKPC'),{DB:db});
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.current,true);
  assert.equal(j.weather.icao,'RKPC');
  assert.equal(j.maxAgeMinutes,90);
});

test('batch weather route serves multiple fresh airports with one D1 query',async()=>{
  const rows=[{icao:'RKPC',visibility:10000},{icao:'RKSI',visibility:8000}];
  const db={prepare(sql){assert.match(sql,/json_each/);return{bind(...args){assert.deepEqual(JSON.parse(args[0]),['RKPC','RKSI']);return{async all(){return{results:rows}}}}}}};
  const r=await handleRequest(new Request('https://preview.local/api/weather?icaos=RKPC,RKSI'),{DB:db});
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.results.length,2);
  assert.deepEqual(j.icaos,['RKPC','RKSI']);
});

test('scheduled ingest is hard blocked',()=>assert.throws(()=>worker.scheduled(),/SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL/));

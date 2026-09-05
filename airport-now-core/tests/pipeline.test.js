import test from 'node:test';
import assert from 'node:assert/strict';
import {INGEST_SOURCE_IDS,ingestProviderPayload} from '../src/ingest/pipeline.js';
import {AGGREGATE_SQL,aggregateServiceDate} from '../src/storage/aggregate.js';

test('ingest router exposes only explicit verified source ids',()=>{
  assert.ok(INGEST_SOURCE_IDS.includes('IIAC_PASSENGER_DEPARTURE'));
  assert.ok(INGEST_SOURCE_IDS.includes('KAC_FLIGHT_STATUS_DEPARTURE'));
  assert.ok(INGEST_SOURCE_IDS.includes('KMA_METAR_SPECI'));
  assert.equal(INGEST_SOURCE_IDS.includes('UNKNOWN'),false);
});

test('ingest router rejects unsupported sources before touching D1',async()=>{
  await assert.rejects(()=>ingestProviderPayload(null,{sourceId:'UNKNOWN',payload:{},observedAt:'2026-09-05T12:00:00+09:00'}),/UNSUPPORTED_INGEST_SOURCE/);
});

test('aggregate runner batches hourly route and flight-number metrics',async()=>{
  const calls=[];const db={prepare(sql){return{bind(v){calls.push({sql,v});return{}}}},async batch(stmts){calls.push({batch:stmts.length})}};
  const r=await aggregateServiceDate(db,'2026-09-05');
  assert.equal(r.statements,3);assert.equal(calls.at(-1).batch,3);
  assert.match(AGGREGATE_SQL.AIRPORT_HOURLY,/airport_hourly_metrics/);
  assert.match(AGGREGATE_SQL.ROUTE_DAILY,/route_daily_metrics/);
  assert.match(AGGREGATE_SQL.FLIGHT_NUMBER_DAILY,/flight_number_daily_metrics/);
});

test('aggregate runner rejects malformed service dates',async()=>{
  await assert.rejects(()=>aggregateServiceDate({},'20260905'),/INVALID_SERVICE_DATE/);
});

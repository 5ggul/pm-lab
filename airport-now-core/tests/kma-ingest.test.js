import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {metarFreshness,KMA_METAR_INGEST_SQL} from '../src/ingest/kma-metar.js';

test('METAR freshness uses phenomenon time rather than ingest time',()=>{
  assert.deepEqual(metarFreshness({phenomenonTime:'2026-09-05T02:00:00Z'},{observedAt:'2026-09-05T02:40:00Z',maxAgeMinutes:90}),{current:true,reason:null,ageMinutes:40});
  const stale=metarFreshness({phenomenonTime:'2026-02-19T10:00:00Z'},{observedAt:'2026-09-05T02:40:00Z',maxAgeMinutes:90});
  assert.equal(stale.current,false);assert.equal(stale.reason,'STALE');
});

test('future and missing phenomenon time are not eligible for current weather',()=>{
  assert.equal(metarFreshness({phenomenonTime:null},{observedAt:'2026-09-05T02:40:00Z'}).reason,'PHENOMENON_TIME_MISSING');
  assert.equal(metarFreshness({phenomenonTime:'2026-09-05T04:00:00Z'},{observedAt:'2026-09-05T02:40:00Z'}).reason,'FUTURE');
});

test('weather ingest SQL keeps current and immutable event paths separate',()=>{
  assert.match(KMA_METAR_INGEST_SQL.UPSERT_CURRENT,/weather_current/);
  assert.match(KMA_METAR_INGEST_SQL.INSERT_EVENT,/weather_events/);
  assert.match(KMA_METAR_INGEST_SQL.INSERT_EVENT,/INSERT OR IGNORE/);
});

test('D1 schema contains METAR history uniqueness key',()=>{
  const schema=fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS weather_events/);
  assert.match(schema,/PRIMARY KEY\(icao,kind,phenomenon_time\)/);
});

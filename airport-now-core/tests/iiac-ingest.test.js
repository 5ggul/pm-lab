import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ingestIiacArrivalPayload, parseIiacArrivalEnvelope, planFlightChanges, IIAC_BULK_SQL } from '../src/ingest/iiac-arrivals.js';
import { collapseIiacArrivalRows } from '../src/iiac-live.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/iiac-arrival-live-sample.json',import.meta.url),'utf8'));
const envelope={response:{header:{resultCode:'00',resultMsg:'NORMAL SERVICE.'},body:{items:fixture.rows}}};
const ctx={serviceDate:'2026-09-04',observedAt:'2026-09-04T15:10:00+09:00'};

function fakeDb(existing=[]){
  const calls=[];
  return {
    calls,
    prepare(sql){
      return {
        bind(...args){
          calls.push({sql,args});
          return {
            async all(){return{results:existing}},
            async run(){return{success:true}}
          };
        }
      };
    }
  };
}

test('IIAC envelope accepts direct items array from verified live response',()=>{
  assert.equal(parseIiacArrivalEnvelope(envelope).length,7);
  assert.throws(()=>parseIiacArrivalEnvelope({response:{header:{resultCode:'30',resultMsg:'DENIED'},body:{}}}),/IIAC_RESPONSE_ERROR:30/);
});

test('IIAC bulk SQL uses D1 json_each instead of one query per flight',()=>{
  for(const sql of Object.values(IIAC_BULK_SQL)) assert.match(sql,/json_each/);
});

test('new live sample ingests with five D1 queries total',async()=>{
  const db=fakeDb([]);
  const result=await ingestIiacArrivalPayload(db,envelope,ctx);
  assert.equal(result.rawRows,7);
  assert.equal(result.operatingFlights,4);
  assert.equal(result.marketingAliases,2);
  assert.equal(result.duplicateOperatingRows,1);
  assert.equal(result.changedFlights,4);
  assert.equal(result.emittedEvents,4);
  assert.equal(result.queryCount,5);
  assert.equal(db.calls.length,5);
});

test('change planner skips unchanged flights after first ingest',()=>{
  const collapsed=collapseIiacArrivalRows(fixture.rows,ctx);
  const existing=collapsed.flights.map(f=>({
    flight_instance_id:f.flightInstanceId,service_date:f.serviceDate,flight_number:f.flightNumber,
    operating_flight_number:f.operatingFlightNumber,operating_airline:f.operatingAirline,
    marketing_airline:f.marketingAirline,is_codeshare:f.isCodeshare?1:0,master_flight_number:f.masterFlightNumber,
    origin:f.origin,destination:f.destination,direction:f.direction,scheduled_departure:f.scheduledDeparture,
    estimated_departure:f.estimatedDeparture,actual_departure:f.actualDeparture,scheduled_arrival:f.scheduledArrival,
    estimated_arrival:f.estimatedArrival,actual_arrival:f.actualArrival,terminal:f.terminal,gate:f.gate,
    checkin_counter:f.checkinCounter,baggage_carousel:f.baggageCarousel,status_raw:f.statusRaw,status:f.status,
    delay_minutes:f.delayMinutes,status_updated_at:f.statusUpdatedAt,source_id:f.sourceId,
    source_updated_at:f.sourceUpdatedAt,observed_at:'older',source_record_key:f.sourceRecordKey
  }));
  const plan=planFlightChanges(existing,collapsed.flights);
  assert.equal(plan.changedFlights.length,0);
  assert.equal(plan.events.length,0);
});

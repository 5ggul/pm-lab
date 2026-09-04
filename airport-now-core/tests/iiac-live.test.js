import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseIiacArrivalRows, normalizeIiacArrivalLive } from '../src/iiac-live.js';

const ctx={serviceDate:'2026-09-04',observedAt:'2026-09-04T15:10:00+09:00'};
const shared={scheduleDateTime:'0025',estimatedDateTime:'0027',airport:'홍콩',gatenumber:'24',carousel:'6',remark:'도착',airportCode:'HKG',terminalId:'P01'};

test('IIAC live batch collapses Master/Slave rows into one operating flight',()=>{
  const rows=[
    {...shared,airline:'캐세이퍼시픽항공',flightId:'CX426',codeshare:'Master',masterflightid:''},
    {...shared,airline:'콴타스항공',flightId:'QF8233',codeshare:'Slave',masterflightid:'CX426'},
    {...shared,airline:'아메리칸항공',flightId:'AA8905',codeshare:'Slave',masterflightid:'CX426'}
  ];
  const out=collapseIiacArrivalRows(rows,ctx);
  assert.deepEqual(out.diagnostics,{rawRows:3,operatingFlights:1,marketingAliases:2});
  assert.equal(out.flights.length,1);
  assert.equal(out.flights[0].flightNumber,'CX426');
  assert.equal(out.flights[0].operatingFlightNumber,'CX426');
  assert.equal(out.flights[0].operatingAirline,'CX');
  assert.equal(out.flights[0].marketingAirline,null);
  assert.deepEqual(out.aliases.map(x=>x.marketingFlightNumber).sort(),['AA8905','QF8233']);
});

test('IIAC live adapter keeps midnight rollover in KST',()=>{
  const f=normalizeIiacArrivalLive({airline:'타이거에어 타이완',flightId:'IT602',scheduleDateTime:'2330',estimatedDateTime:'0005',airport:'타이베이',gatenumber:'114',carousel:'9',remark:'도착',codeshare:null,masterflightid:'',airportCode:'TPE',terminalId:'P02'},ctx);
  assert.equal(f.scheduledArrival,'2026-09-04T23:30:00+09:00');
  assert.equal(f.estimatedArrival,'2026-09-05T00:05:00+09:00');
  assert.equal(f.delayMinutes,35);
});

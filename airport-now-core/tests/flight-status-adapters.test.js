import test from 'node:test';
import assert from 'node:assert/strict';
import {collapseIiacDepartureRows,collapseKacFlightStatusRows,mapOperationalRemark,normalizeIiacDepartureDetailedRow,normalizeKacFlightStatusRow,parseDataGoKrEnvelope,providerKstIso} from '../src/flight-status-adapters.js';

const ctx={serviceDate:'2026-09-05',observedAt:'2026-09-05T12:00:00+09:00'};

test('provider datetime accepts documented HHMM and fgenTime shapes',()=>{
  assert.equal(providerKstIso('0915',ctx.serviceDate),'2026-09-05T09:15:00+09:00');
  assert.equal(providerKstIso('20260905120530',ctx.serviceDate),'2026-09-05T12:05:30+09:00');
});

test('operational remarks map without inferring causes',()=>{
  assert.equal(mapOperationalRemark('출발'),'DEPARTED');
  assert.equal(mapOperationalRemark('지연'),'DELAYED');
  assert.equal(mapOperationalRemark('결항'),'CANCELLED');
  assert.equal(mapOperationalRemark('기상악화'),'UNKNOWN');
});

test('IIAC documented departure fields normalize to ICN departure',()=>{
  const f=normalizeIiacDepartureDetailedRow({flightId:'KE123',masterflightid:null,airportCode:'CJU',scheduleDateTime:'0915',estimatedDateTime:'0935',terminalid:'P03',gatenumber:'240',chkinrange:'A01-A10',remark:'지연',fid:'abc'},ctx);
  assert.equal(f.origin,'ICN');assert.equal(f.destination,'CJU');assert.equal(f.direction,'DEPARTURE');
  assert.equal(f.status,'DELAYED');assert.equal(f.delayMinutes,20);assert.equal(f.terminal,'T2');assert.equal(f.sourceRecordKey,'abc');
});

test('IIAC departure collapse stores codeshare marketing flight as alias',()=>{
  const rows=[
    {flightId:'KE123',airportCode:'CJU',scheduleDateTime:'0915',estimatedDateTime:'0915',codeshare:'Master',remark:'출발'},
    {flightId:'DL7001',masterflightid:'KE123',airportCode:'CJU',scheduleDateTime:'0915',estimatedDateTime:'0915',codeshare:'Slave',remark:'출발'}
  ];
  const c=collapseIiacDepartureRows(rows,ctx);
  assert.equal(c.flights.length,1);assert.equal(c.flights[0].flightNumber,'KE123');assert.equal(c.aliases[0].marketingFlightNumber,'DL7001');
});

test('KAC documented departure and arrival field names normalize',()=>{
  const departure=normalizeKacFlightStatusRow({flightid:'7C101',masterflightid:null,depAirportCode:'GMP',arrvAirportCode:'CJU',scheduledatetime:'1010',estimateddatetime:'1028',rmkKor:'지연',fgenTime:'20260905101530',fid:'d1',codeshare:'N'},{...ctx,direction:'DEPARTURE'});
  assert.equal(departure.origin,'GMP');assert.equal(departure.destination,'CJU');assert.equal(departure.status,'DELAYED');assert.equal(departure.delayMinutes,18);
  const arrival=normalizeKacFlightStatusRow({flightid:'TW202',depAirportCode:'CJU',arrAirportCode:'GMP',scheduledatetime:'1120',estimateddatetime:'1120',rmkKor:'도착',fid:'a1',codeshare:'N'},{...ctx,direction:'ARRIVAL'});
  assert.equal(arrival.direction,'ARRIVAL');assert.equal(arrival.status,'ARRIVED');assert.equal(arrival.scheduledArrival,'2026-09-05T11:20:00+09:00');
});

test('KAC collapse uses masterflightid as operating identity',()=>{
  const rows=[
    {flightid:'KE1201',depAirportCode:'GMP',arrvAirportCode:'CJU',scheduledatetime:'1000',estimateddatetime:'1000',rmkKor:'출발',codeshare:'Y',masterflightid:'KE1201'},
    {flightid:'AF9001',depAirportCode:'GMP',arrvAirportCode:'CJU',scheduledatetime:'1000',estimateddatetime:'1000',rmkKor:'출발',codeshare:'Y',masterflightid:'KE1201'}
  ];
  const c=collapseKacFlightStatusRows(rows,{...ctx,direction:'DEPARTURE'});
  assert.equal(c.flights.length,1);assert.equal(c.flights[0].flightNumber,'KE1201');assert.equal(c.aliases[0].marketingFlightNumber,'AF9001');
});

test('data.go.kr envelope accepts object or array item and rejects provider errors',()=>{
  assert.equal(parseDataGoKrEnvelope({response:{header:{resultCode:'00'},body:{items:{item:{flightid:'KE1'}},totalCount:1}}}).rows.length,1);
  assert.throws(()=>parseDataGoKrEnvelope({response:{header:{resultCode:'30',resultMsg:'SERVICE KEY ERROR'},body:{}}},{sourceId:'KAC'}),/KAC_RESPONSE_ERROR:30/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKacFlightSearchUrl, parseKacFlightSearchEnvelope, KAC_FLIGHT_SEARCH_ENDPOINT, KAC_FLIGHT_SEARCH_FIELDS } from '../src/kac-live.js';

test('KAC flight search uses official /info operation',()=>{
  const u=new URL(buildKacFlightSearchUrl({serviceKey:'abc',flightNumber:'KE1814',lineType:'D',ioType:'O',airportCode:'GMP',startTime:'0600',endTime:'1800'}));
  assert.equal(KAC_FLIGHT_SEARCH_ENDPOINT,'https://apis.data.go.kr/B551178/flight-search/info');
  assert.equal(u.pathname,'/B551178/flight-search/info');
  assert.equal(u.searchParams.get('schFln'),'KE1814');
  assert.equal(u.searchParams.get('schLineType'),'D');
  assert.equal(u.searchParams.get('schIOType'),'O');
  assert.equal(u.searchParams.get('schAirCode'),'GMP');
});

test('KAC documented response fields remain explicit',()=>{
  assert.deepEqual(KAC_FLIGHT_SEARCH_FIELDS,['airlineKorean','airport','arrivedEng','arrivedKor','boardingEng','boardingKor','city','etd','gate','io','line','rmkEng','rmkKor','std','airFln','airlineEnglish']);
});

test('KAC envelope parser accepts GW body item array',()=>{
  const out=parseKacFlightSearchEnvelope({response:{header:{resultCode:'00',resultMsg:'NORMAL SERVICE.'},body:{items:{item:[{airFln:'KE1814'}]},totalCount:'1',pageNo:'1',numOfRows:'10'}}});
  assert.equal(out.rows.length,1);
  assert.equal(out.totalCount,1);
});

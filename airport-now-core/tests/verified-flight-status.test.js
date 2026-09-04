import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIiacDepartureDetailedUrl,buildKacDepartUrl,buildKacArrivalUrl,VERIFIED_FLIGHT_STATUS_SPEC} from '../src/verified-flight-status.js';

test('verified IIAC departure endpoint is exact official Gateway path',()=>{
  const u=new URL(buildIiacDepartureDetailedUrl({serviceKey:'KEY',searchday:'20260904'}));
  assert.equal(u.origin+u.pathname,'https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/getPassengerDeparturesDeOdp');
  assert.equal(u.searchParams.get('type'),'json');
});

test('verified KAC status endpoints use flight-status depart and arrival',()=>{
  const d=new URL(buildKacDepartUrl({serviceKey:'KEY',searchday:'20260904',airportCode:'CJU'}));
  const a=new URL(buildKacArrivalUrl({serviceKey:'KEY',searchday:'20260904',airportCode:'CJU'}));
  assert.equal(d.pathname,'/B551178/flight-status/depart');
  assert.equal(a.pathname,'/B551178/flight-status/arrival');
  assert.equal(d.searchParams.get('airport_code'),'CJU');
  assert.equal(VERIFIED_FLIGHT_STATUS_SPEC.KAC_DEPARTURE.datasetId,'15158625');
});

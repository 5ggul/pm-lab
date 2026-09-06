import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeKmaMetarLiveResponse} from '../src/kma-live-parser.js';

const xml=`<iwxxm:METAR xmlns:aixm="http://www.aixm.aero/schema/5.1.1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:xlink="http://www.w3.org/1999/xlink">
<iwxxm:issueTime><gml:TimeInstant><gml:timePosition>2026-09-04T05:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
<aixm:AirportHeliport><aixm:designator>RKPC</aixm:designator><aixm:name>JEJU INTERNATIONAL AIRPORT</aixm:name></aixm:AirportHeliport>
<iwxxm:airTemperature uom="Cel">27</iwxxm:airTemperature>
<iwxxm:dewpointTemperature uom="Cel">19</iwxxm:dewpointTemperature>
<iwxxm:qnh uom="hPa">1008</iwxxm:qnh>
<iwxxm:meanWindDirection uom="deg">80</iwxxm:meanWindDirection>
<iwxxm:meanWindSpeed uom="[kn_i]">025</iwxxm:meanWindSpeed>
<iwxxm:windGustSpeed uom="[kn_i]">038</iwxxm:windGustSpeed>
<iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility>
<iwxxm:amount xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"/>
</iwxxm:METAR>`;

test('live KMA envelope parses IWXXM 2023-1 and converts knots to m/s',()=>{
  const payload={response:{header:{resultCode:'00',resultMsg:'NORMAL_SERVICE'},body:{items:{item:[{icaoCode:'',airportName:'',metarMsg:xml}]}}}};
  const [v]=normalizeKmaMetarLiveResponse(payload,{observedAt:'2026-09-04T05:53:31Z'});
  assert.equal(v.icao,'RKPC');
  assert.equal(v.airportName,'JEJU INTERNATIONAL AIRPORT');
  assert.equal(v.phenomenonTime,'2026-09-04T05:00:00Z');
  assert.equal(v.airTemperature,27);
  assert.equal(v.dewpointTemperature,19);
  assert.equal(v.qnh,1008);
  assert.equal(v.meanWindDirection,80);
  assert.equal(v.meanWindSpeed,12.9);
  assert.equal(v.windGustSpeed,19.5);
  assert.equal(v.visibility,10000);
  assert.deepEqual(v.cloudAmounts,['BKN']);
  assert.equal(v.canonicalUnits.wind,'m/s');
});

test('non-normal KMA response is rejected',()=>{
  assert.throws(()=>normalizeKmaMetarLiveResponse({response:{header:{resultCode:'99'}}}),/KMA_API_ERROR_99/);
});

import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {getPlatformProxy} from 'wrangler';
import {ingestFlightRows} from '../src/ingest/once.js';
import {verifyReadPath} from './verify-read-path.mjs';
import {ingestKmaMetarPayload} from '../src/ingest/kma-metar.js';

const proxy=await getPlatformProxy({configPath:fileURLToPath(new URL('../wrangler.local.jsonc',import.meta.url)),persist:false});
try {
  await proxy.env.DB.exec(await fs.readFile(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));
  const outcomes={};
  for(const direction of ['ARRIVAL','DEPARTURE']) {
    const name=direction==='ARRIVAL'?'iiac-arrival-detail-live-sample':'iiac-departure-live-sample';
    const fixture=JSON.parse(await fs.readFile(new URL('../tests/fixtures/'+name+'.json',import.meta.url),'utf8'));
    const ctx={provider:'IIAC',direction,serviceDate:'2026-09-06',observedAt:fixture.provenance.capturedAt};
    outcomes[direction]=await ingestFlightRows(proxy.env.DB,fixture.rows,ctx);
    const repeat=await ingestFlightRows(proxy.env.DB,fixture.rows,ctx);
    assert.equal(repeat.emittedEvents,0);
  }
  const weather=JSON.parse(await fs.readFile(new URL('../tests/fixtures/kma-metar-live-sample.json',import.meta.url),'utf8'));
  outcomes.METAR=await ingestKmaMetarPayload(proxy.env.DB,weather.payload,{observedAt:weather.provenance.capturedAt,expectedIcao:'RKPC'});
  console.log(JSON.stringify({mode:'captured-excerpts-local-D1',outcomes,reads:await verifyReadPath(proxy.env.DB,'2026-09-06')},null,2));
}finally{await proxy.dispose();}

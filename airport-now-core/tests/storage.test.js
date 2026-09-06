import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { persistenceDecision } from '../src/storage/writer.js';

const row={flight_instance_id:'2026-09-03:KE123:CJU:GMP:DEPARTURE',service_date:'2026-09-03',flight_number:'KE123',operating_flight_number:'KE123',origin:'CJU',destination:'GMP',direction:'DEPARTURE',status:'SCHEDULED',gate:'5',delay_minutes:0,source_id:'T',observed_at:'old'};
const next={flightInstanceId:row.flight_instance_id,serviceDate:'2026-09-03',flightNumber:'KE123',operatingFlightNumber:'KE123',origin:'CJU',destination:'GMP',direction:'DEPARTURE',status:'SCHEDULED',gate:'5',delayMinutes:0,sourceId:'T',observedAt:'new'};
const schema=fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8');

test('unchanged observation skips flight/history writes',()=>assert.deepEqual(persistenceDecision(row,next),{writeFlight:false,writeEvent:false,changedFields:[]}));
test('meaningful change writes snapshot and event',()=>{const d=persistenceDecision(row,{...next,gate:'6'});assert.equal(d.writeFlight,true);assert.equal(d.writeEvent,true);assert.deepEqual(d.changedFields,['gate'])});
test('D1 schema stores codeshare aliases used by flight search',()=>{assert.match(schema,/CREATE TABLE IF NOT EXISTS flight_codeshares/);assert.match(schema,/idx_flight_codeshares_marketing_date/)});

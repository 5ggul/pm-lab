import test from 'node:test';import assert from 'node:assert/strict';import {moduleAvailability,parkingSpec,warningSpec} from '../src/capability-read-model.js';
test('empty official capability is unavailable, not fabricated',()=>assert.deepEqual(moduleAvailability([]),{available:false,reason:'NO_OFFICIAL_CURRENT_RECORD',freshnessMinutes:null,dataAsOf:null}));
test('stale capability is unavailable',()=>assert.equal(moduleAvailability([{observed_at:'2026-09-03T00:00:00Z'}],{nowIso:'2026-09-03T01:00:00Z',maxAgeMinutes:15}).reason,'STALE'));
test('fresh capability is available',()=>assert.equal(moduleAvailability([{observed_at:'2026-09-03T00:55:00Z'}],{nowIso:'2026-09-03T01:00:00Z',maxAgeMinutes:15}).available,true));
test('provider phenomenon time wins over fresh ingest timestamp',()=>{const r=moduleAvailability([{phenomenon_time:'2026-02-19T10:00:00Z',observed_at:'2026-09-05T03:00:00Z'}],{nowIso:'2026-09-05T03:05:00Z',maxAgeMinutes:20});assert.equal(r.available,false);assert.equal(r.reason,'STALE')});
test('capability queries validate airport codes',()=>{assert.throws(()=>parkingSpec('JEJU'),/INVALID_IATA/);assert.throws(()=>warningSpec('RPC','now'),/INVALID_ICAO/)})

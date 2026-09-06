import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapturedFlight} from '../src/captured-flight.js';
import {coverageReport,collectionState} from '../src/collector-status.js';
const at=Date.parse('2026-09-06T08:30:00Z');
const page=(number,total,rows)=>JSON.stringify({response:{header:{resultCode:'00'},body:{pageNo:number,numOfRows:1,totalCount:total,items:rows}}});
const capture=()=>({startedAt:'2026-09-06T08:29:00Z',completedAt:'2026-09-06T08:30:00Z',serviceDate:'2026-09-06',pages:[page(1,2,[{id:1}]),page(2,2,[{id:2}])]});
test('captured imports require complete ordered pages and recent observation time',()=>{
  assert.equal(validateCapturedFlight('kacArrival',capture(),at).observationTime,'2026-09-06T08:30:00Z');
  assert.throws(()=>validateCapturedFlight('kacArrival',{...capture(),pages:[page(1,2,[{id:1}])]},at),/PAGINATION_INCOMPLETE/);
  assert.throws(()=>validateCapturedFlight('kacArrival',{...capture(),pages:[page(2,1,[{id:1}])]},at),/INVALID_CAPTURE_PAGE/);
  assert.throws(()=>validateCapturedFlight('kacArrival',capture(),at+301000),/INVALID_CAPTURE_TIME/);
  assert.throws(()=>validateCapturedFlight('metar',capture(),at),/INVALID_CAPTURE/);
});
test('a failed poll does not discard a still-fresh successful snapshot',()=>{
  const health={readiness:'ERROR',last_success_at:new Date(at-10*60000).toISOString()};
  assert.deepEqual([collectionState(health,at).current,collectionState(health,at).state],[true,'DEGRADED']);
  assert.equal(collectionState(health,at+21*60000).current,false);
});
test('availability merges overlaps and measures all-source intersections, not poll success ratios',()=>{
  const rows=[{source_id:'A',success:1,success_at:new Date(at).toISOString()},{source_id:'A',success:1,success_at:new Date(at+20*60000).toISOString()},{source_id:'B',success:1,success_at:new Date(at+10*60000).toISOString()}];
  const r=coverageReport(rows,{start:at,end:at+60*60000,sourceIds:['A','B']});
  assert.equal(r.sources.A.coveredMinutes,50);assert.equal(r.sources.B.coveredMinutes,30);assert.equal(r.allSourcesAvailabilityPercent,50);
  assert.equal(coverageReport([],{start:at,end:at,sourceIds:['A']}).allSourcesAvailabilityPercent,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeWindows,FLIGHT_SOURCES} from '../src/collector-status.js';
test('native monitoring cannot pass a full-window target during initial observation',()=>{
  const start=Date.parse('2026-09-07T04:20:00Z'),end=start+600000;
  const records=FLIGHT_SOURCES.map(source_id=>({source_id,success:1,success_at:new Date(start).toISOString()}));
  for(const result of nativeWindows(records,new Date(start).toISOString(),end)){
    assert.equal(result.allSourcesAvailabilityPercent,100);assert.equal(result.windowComplete,false);assert.equal(result.meetsTarget,null);
  }
  assert.equal(nativeWindows([],null,end)[0].observedMinutes,0);
});
test('old native monitoring with no successful collections fails the mature window',()=>{
  const end=Date.parse('2026-09-15T00:00:00Z');
  const results=nativeWindows([],'2026-09-07T00:00:00Z',end);
  assert.ok(results.every(r=>r.windowComplete&&r.meetsTarget===false&&r.allSourcesAvailabilityPercent===0));
});

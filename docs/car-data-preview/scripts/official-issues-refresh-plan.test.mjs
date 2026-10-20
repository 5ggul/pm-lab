import test from 'node:test';
import assert from 'node:assert/strict';
import {needsOfficialIssuesRebuild as needed} from './official-issues-refresh-plan.mjs';
const good={ok:true,checked_at:'2026-10-13T00:00:00Z',source_states:{reports:{ok:true,available:true},recalls:{ok:true,available:true}}};
test('daily checks of identical files do not queue unnecessary full generation',()=>{
  assert.equal(needed('same','same',good,{...good,checked_at:'2026-10-14T00:00:00Z'}),false);
});
test('new aggregates rebuild; outages and recoveries update the visible warning',()=>{
  assert.equal(needed('old','new',good,good),true);
  const failed={...good,ok:false,source_states:{...good.source_states,reports:{ok:false,available:true}}};
  assert.equal(needed('same','same',good,failed),true);
  assert.equal(needed('same','same',failed,good),true);
  assert.equal(needed('same','same',failed,{...failed,checked_at:'later'}),false);
});

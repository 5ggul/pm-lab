import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {needsOfficialIssuesRebuild} from './official-issues-refresh-plan.mjs';

// Inspect the real workflow without network requests, credentials or repository
// writes. These checks protect failure publication and source-race boundaries.
const workflow=fs.readFileSync(new URL('../../../.github/workflows/car-official-issues-refresh.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const publishGuard=fs.readFileSync(new URL('./check-car-publish-base.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const steps=workflow.split(/\n {6}- name: /).slice(1);
const step=label=>{const value=steps.find(value=>value.startsWith(label+'\n'));assert(value,'Missing workflow step: '+label);return value;};
const mainOnly=source=>{assert.match(source,/github\.event_name != 'pull_request'/);assert.match(source,/github\.ref == 'refs\/heads\/main'/);};

test('official source checks are daily, branch-isolated and offline on PR/review branches',()=>{
  assert.match(workflow,/schedule:\s*\n(?:\s*#[^\n]*\n)*\s*- cron: '37 21 \* \* \*'/);
  assert.match(workflow,/group: car-official-issues-refresh-\$\{\{ github\.ref \}\}/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/timeout-minutes: 15/);
  mainOnly(step('Check official CSV replacement files with bounded retries'));
  mainOnly(step('Commit validated snapshots and honest source-check status'));
  assert.doesNotMatch(workflow,/wrangler|pages deploy|vercel.*deploy|secrets\./i,'collector must use public sources and dispatch the verified publication pipeline');
});

test('failed collection preserves the normal validation path and signals failure after warning publication',()=>{
  const fetch=step('Check official CSV replacement files with bounded retries');
  assert.match(fetch,/continue-on-error: true/);
  assert.match(fetch,/for attempt in 1 2 3; do/);
  assert.match(fetch,/fetch-official-issues\.mjs/);
  const build=step('Build and validate retained or refreshed snapshots offline');
  assert.match(build,/build-official-issues-index\.mjs/);
  assert.match(build,/validate-official-issues\.mjs/);
  assert.doesNotMatch(build,/continue-on-error|\|\| true|--require-source-health/);
  const publish=step('Commit validated snapshots and honest source-check status');
  assert.match(publish,/if: success\(\)/);
  const failure=step('Surface source failure after retaining the last good data');
  assert.match(failure,/if: always\(\)/);mainOnly(failure);
  assert.match(failure,/validate-official-issues\.mjs --require-source-health/);
  assert(workflow.indexOf('name: Rebuild public pages only')<workflow.indexOf('name: Surface source failure'),'source warning must be published before this run reports a collection failure');
});

test('source, aggregate and health publish together only after every stale-input check',()=>{
  const publish=step('Commit validated snapshots and honest source-check status');
  assert.match(publish,/FILES=\(car-data-preview\/data\/official-issues docs\/car-data-preview\/data\/generated\/official-issues-index\.json docs\/car-data-preview\/data\/generated\/official-issues-status\.json\)/);
  assert(publish.indexOf('tar -czf')<publish.indexOf('git reset --hard'),'validated output must be retained before resetting the checkout');
  assert.match(publish,/for attempt in 1 2 3; do\s+git fetch origin main\s+node docs\/car-data-preview\/scripts\/check-car-publish-base\.mjs car-official-issues-refresh\.yml\s+git reset --hard origin\/main/);
  assert(publish.indexOf('tar -xzf')<publish.indexOf('git add'),'only restored, validated outputs are staged');
  assert.match(publishGuard,/'car-data-preview\/data\/official-issues'/,'guard must cover manifests, immutable raw snapshots, source settings and reviewed aliases');
  assert.match(publishGuard,/'\.github\/workflows\/car-\*\.yml'/,'collector workflow changes also invalidate a stale build');
});

test('full page rebuild is requested for source content or health transitions rather than daily timestamps',()=>{
  const dispatch=step('Rebuild public pages only after content or health changes');mainOnly(dispatch);
  assert.match(dispatch,/steps\.plan\.outputs\.needs_rebuild == 'true'/);
  assert.match(dispatch,/car-preview-validate\.yml\/dispatches/);
  const good={ok:true,checked_at:'2026-10-19T00:00:00Z',source_states:{reports:{ok:true,available:true},recalls:{ok:true,available:true}}};
  const failed={...good,ok:false,source_states:{...good.source_states,reports:{ok:false,available:true}}};
  assert.equal(needsOfficialIssuesRebuild('same','same',good,{...good,checked_at:'2026-10-20T00:00:00Z'}),false);
  assert.equal(needsOfficialIssuesRebuild('old','replacement',good,good),true);
  assert.equal(needsOfficialIssuesRebuild('same','same',good,failed),true);
  assert.equal(needsOfficialIssuesRebuild('same','same',failed,good),true);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {changedCarInputs,assertPublishContext} from './check-car-publish-base.mjs';

const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'car-publish-qa-'));
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const commit=(file,value)=>{fs.mkdirSync(path.dirname(path.join(cwd,file)),{recursive:true});fs.writeFileSync(path.join(cwd,file),value);git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
try {
  git('init','-q');git('config','user.email','qa@example.invalid');git('config','user.name','QA');
  const base=commit('docs/car-data-preview/data/fuel-price.json','old');
  commit('docs/other-product/index.html','unrelated');
  assert.deepEqual(changedCarInputs(base,'HEAD',cwd),[],'unrelated main commits are safe');
  // Uncommitted generated files must not trigger false conflicts.
  fs.writeFileSync(path.join(cwd,'docs/car-data-preview/data/fuel-price.json'),'generated');
  assert.deepEqual(changedCarInputs(base,'HEAD',cwd),[]);
  commit('docs/car-data-preview/data/fuel-price.json','new upstream data');
  assert.deepEqual(changedCarInputs(base,'HEAD',cwd),['docs/car-data-preview/data/fuel-price.json']);
  const next=git('rev-parse','HEAD');
  commit('.github/workflows/car-family-build.yml','new generator configuration');
  assert.equal(changedCarInputs(next,'HEAD',cwd).length,1);
  assert.throws(()=>assertPublishContext({GITHUB_REF:'refs/heads/review',GITHUB_EVENT_NAME:'workflow_dispatch'}));
  assert.throws(()=>assertPublishContext({GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'pull_request'}));
  assert.doesNotThrow(()=>assertPublishContext({GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule'}));
  console.log('Publish race QA PASS: changed car inputs blocked, unrelated commits allowed, review branches blocked');
} finally {fs.rmSync(cwd,{recursive:true,force:true});}

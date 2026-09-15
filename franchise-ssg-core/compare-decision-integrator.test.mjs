import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyCompareDecision,validateCompareDecision} from './compare-decision-integrator.mjs';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'compare-decision-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'assets/app.js'),'console.log("base")\n');fs.writeFileSync(path.join(root,'assets/site.css'),'body{}\n');return root}
test('compare decision integrator changes only shared app/css and is idempotent',t=>{const root=fixture(t);assert.deepEqual(applyCompareDecision(root).changedFiles,['assets/app.js','assets/site.css']);const app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');assert.match(app,/v11\.52 compare decision: start/);assert.match(css,/v11\.52 compare decision css: start/);assert.deepEqual(applyCompareDecision(root).changedFiles,[]);assert.deepEqual(validateCompareDecision(root),{compareDecision:true});});
test('compare decision integrator rejects relative roots',()=>assert.throws(()=>applyCompareDecision('relative'),/absolute/));

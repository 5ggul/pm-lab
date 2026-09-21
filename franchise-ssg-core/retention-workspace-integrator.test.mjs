import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyRetentionWorkspace,validateRetentionWorkspace} from './retention-workspace-integrator.mjs';

const core=path.dirname(fileURLToPath(import.meta.url));
function brand(i){
  const up=i<68,prev=100+i,cur=prev+(up?i+1:-(i-67));
  return{name:'브랜드'+i,route:'/brands/b'+i+'/',slug:'b'+i,tier:'B',categorySlug:'cafe',categoryName:'카페·커피',cost:5000+i,stores:cur,sales:20000+i,growth:(cur-prev)/prev*100,history:[{year:2024,stores:prev,newStores:10,contractEnd:1,contractCancel:0},{year:2025,stores:cur,newStores:11,contractEnd:1,contractCancel:0}],components:{franchise:100,education:100,deposit:100,etc:4700+i},sourceYear:2025,category:{count:136,costMedian:6000,storesMedian:150,salesMedian:21000,growthMedian:0},salesPerArea:1000+i};
}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-retention-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  const brands=Array.from({length:136},(_,i)=>brand(i));
  fs.writeFileSync(path.join(root,'data-snapshot-v11-26.json'),JSON.stringify({snapshot_id:'trusted-2025-test',source_year:2025,brand_count:136,brands}));
  for(const b of brands){const d=path.join(root,...b.route.split('/').filter(Boolean));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),'<html><head></head><body><main data-v10-brand="1"><h1>'+b.name+'</h1><!-- v11.49 brand cost checks --><section class="v49-cost-checks"></section></main></body></html>')}
  fs.writeFileSync(path.join(root,'index.html'),'<html><head></head><body><a class="logo" href="/pm-lab/franchise-ssg-preview">창업데이터랩</a><main><h1>홈</h1><!-- v11.52 home decision: end --></main></body></html>');
  fs.mkdirSync(path.join(root,'compare'),{recursive:true});fs.writeFileSync(path.join(root,'compare/index.html'),'<html><head></head><body><a class="logo" href="/pm-lab/franchise-ssg-preview">창업데이터랩</a><main><h1>비교</h1><!-- v11.34 compare workspace --><section class="v34-workspace" data-v34-workspace="hub"><select data-v34-pick></select><select data-v34-pick></select><select data-v34-pick></select><select data-v34-pick></select></section></main></body></html>');
  fs.mkdirSync(path.join(root,'updates'),{recursive:true});fs.writeFileSync(path.join(root,'updates/index.html'),'<html><head></head><body><a class="logo" href="/pm-lab/franchise-ssg-preview">창업데이터랩</a><main><h1>데이터 변경 기록</h1><section class="block v11-24-polish" data-v11-24-polish="updates"></section></main></body></html>');
  return root;
}

test('retention workspace adds 136 brand workspaces, saved compare and update radar',()=>{
  const root=fixture();
  try{
    const result=applyRetentionWorkspace(root,core);
    assert.equal(result.retentionWorkspace,true);assert.equal(result.brandWorkspaces,136);assert.equal(result.updatesRadarRows,12);
    const mega=fs.readFileSync(path.join(root,'brands/b0/index.html'),'utf8');
    assert.ok(mega.includes('data-v52-save-brand'));assert.equal((mega.match(/data-v52-check=/g)||[]).length,6);assert.ok(mega.includes('data-v52-candidate-note'));assert.ok(mega.includes('data-v52-note-count'));
    const home=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(home.includes('data-v52-retention-home="1"'));assert.ok(home.includes('franchiseLab')===false);assert.ok(home.includes('data-v52-editorial-rail="home"'));assert.equal((home.match(/class="v52-editorial-link"/g)||[]).length,3);
    const compare=fs.readFileSync(path.join(root,'compare/index.html'),'utf8');assert.ok(compare.includes('data-v52-load-saved'));assert.ok(compare.includes('data-v52-editorial-rail="compare"'));assert.equal((compare.match(/class="v52-editorial-link"/g)||[]).length,3);
    const updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');assert.equal((updates.match(/class="v52-change-radar-row"/g)||[]).length,12);assert.ok(updates.includes('data-v52-editorial-rail="updates"'));assert.equal((updates.match(/class="v52-editorial-link"/g)||[]).length,3);
    assert.deepEqual(validateRetentionWorkspace(root),{retentionWorkspace:true,brandWorkspaces:136,assetPages:139,homeWorkspace:true,compareSavedLoader:true,updatesRadarRows:12,localOnlyPersistence:true,candidateNotes:true,checklistProgressSummary:true,editorialRails:3,editorialGuideLinks:9});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('retention workspace is byte-for-byte idempotent',()=>{
  const root=fixture();
  try{
    applyRetentionWorkspace(root,core);
    const paths=['index.html','compare/index.html','updates/index.html','brands/b1/index.html','assets/retention-workspace.js','assets/retention-workspace.css'];
    const once=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    const result=applyRetentionWorkspace(root,core),twice=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    assert.equal(result.changed,0);assert.deepEqual(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('retention workspace rejects relative roots and trusted brand baseline drift',()=>{
  assert.throws(()=>applyRetentionWorkspace('relative',core),/absolute preview root/);
  const root=fixture();
  try{
    const s=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));s.brands.pop();s.brand_count=135;fs.writeFileSync(path.join(root,'data-snapshot-v11-26.json'),JSON.stringify(s));
    assert.throws(()=>applyRetentionWorkspace(root,core),/brand baseline/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

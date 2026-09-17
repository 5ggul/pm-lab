import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyHomeDecision,validateHomeDecision} from './home-decision-integrator.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-home-decision-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/home-decision.css'),'.fixture{}\n');
  fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><html><head><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"></head><body><main id="main" data-v25-home="1"><div class="shell"><section class="v41-home-hero"><form class="v25-search" data-v25-search><input name="q"><button>검색</button></form></section><section class="v25-sec"><header><h2>업종별 창업비용</h2></header></section><section class="v25-sec"><header><h2>예산</h2></header></section><script type="application/json" data-v25-search-map>{"메가MGC커피":"/brands/mega-mgc-coffee/"}</script></div></main></body></html>');
  return root;
}

test('home decision: injects four task routes without removing search or data sections',()=>{
  const root=fixture();
  try{
    const result=applyHomeDecision(root);assert.equal(result.changed,true);
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.equal((html.match(/data-v52-home-start-card=/g)||[]).length,4);
    assert.ok(html.indexOf('data-v52-home-start="1"')<html.indexOf('<h2>업종별 창업비용</h2>'));
    assert.ok(html.includes('<form class="v25-search" data-v25-search>'));
    assert.ok(html.includes('data-v25-search-map'));
    assert.deepEqual(validateHomeDecision(root),{homeDecision:true,startCards:4,searchPreserved:true,dataSectionsPreserved:true});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('home decision: repeat application is byte-for-byte idempotent',()=>{
  const root=fixture();
  try{
    applyHomeDecision(root);const once=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const second=applyHomeDecision(root),twice=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.equal(second.changed,false);assert.equal(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('home decision: rejects relative roots and missing CSS',()=>{
  assert.throws(()=>applyHomeDecision('relative'),/absolute preview root/);
  const root=fixture();
  try{applyHomeDecision(root);fs.unlinkSync(path.join(root,'assets/home-decision.css'));assert.throws(()=>validateHomeDecision(root),/CSS asset missing/)}finally{fs.rmSync(root,{recursive:true,force:true})}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyToolsDecision,validateToolsDecision} from './tools-decision-integrator.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-tools-decision-'));
  fs.mkdirSync(path.join(root,'tools'),{recursive:true});
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/tools-decision.css'),'.fixture{}\n');
  fs.writeFileSync(path.join(root,'tools/index.html'),'<!doctype html><html><head><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"></head><body><main id="main" data-v25-tools="1"><div class="shell v25-shell"><h1>데이터 도구</h1><section class="v25-toolset"><h2>계산</h2><a href="/pm-lab/franchise-ssg-preview/tools/startup-cost/">창업비용</a><a href="/pm-lab/franchise-ssg-preview/tools/monthly-profit-simulator/">월손익</a><a href="/pm-lab/franchise-ssg-preview/tools/brand-filter/">조건검색</a><a href="/pm-lab/franchise-ssg-preview/tools/category-median/">업종중앙값</a></section><details class="v25-method"><summary>비교 기준 보기</summary><div><p>기준</p></div></details></div></main></body></html>');
  return root;
}

test('tools decision: injects one static start section, FAQ and JSON-LD',()=>{
  const root=fixture();
  try{
    const before=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');
    const result=applyToolsDecision(root);
    assert.equal(result.changed,true);
    const html=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');
    assert.notEqual(html,before);
    assert.equal((html.match(/data-v52-tools-start="1"/g)||[]).length,1);
    assert.equal((html.match(/data-v52-tools-start-card=/g)||[]).length,4);
    assert.equal((html.match(/data-v52-tools-faq="1"/g)||[]).length,1);
    const data=JSON.parse(html.match(/<script type="application\/ld\+json" data-v52-tools-faq-jsonld>([\s\S]*?)<\/script>/)[1]);
    assert.equal(data['@type'],'FAQPage');
    assert.equal(data.mainEntity.length,4);
    assert.deepEqual(validateToolsDecision(root),{toolsDecision:true,startCards:4,faqItems:4});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('tools decision: second application is idempotent',()=>{
  const root=fixture();
  try{
    applyToolsDecision(root);
    const once=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');
    const second=applyToolsDecision(root);
    const twice=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');
    assert.equal(second.changed,false);
    assert.equal(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('tools decision: rejects relative roots and missing CSS assets',()=>{
  assert.throws(()=>applyToolsDecision('relative'),/absolute preview root/);
  const root=fixture();
  try{
    applyToolsDecision(root);
    fs.unlinkSync(path.join(root,'assets/tools-decision.css'));
    assert.throws(()=>validateToolsDecision(root),/CSS asset missing/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

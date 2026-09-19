import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyPublisherValue,validatePublisherValue} from './publisher-value-integrator.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-publisher-value-'));
  fs.mkdirSync(path.join(root,'methodology'),{recursive:true});
  fs.writeFileSync(path.join(root,'methodology/index.html'),'<html><body><main><article><h1>계산 기준</h1><p>기존 기준</p></article></main></body></html>');
  return root;
}
test('publisher value explains added analysis and automation method',()=>{
  const root=fixture();
  try{
    const result=applyPublisherValue(root);
    assert.equal(result.publisherValue,true);
    assert.deepEqual(validatePublisherValue(root),{publisherValue:true,valueItems:6,automationDisclosure:true,originalAnalysisDisclosure:true});
    const html=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
    assert.ok(html.includes('원천 공개데이터에 더하는 것'));
    assert.ok(html.includes('페이지가 만들어지고 검수되는 방식'));
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('publisher value is idempotent',()=>{
  const root=fixture();
  try{
    applyPublisherValue(root);
    const once=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
    const second=applyPublisherValue(root);
    const twice=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
    assert.equal(second.changed,false);assert.equal(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('publisher value rejects relative roots',()=>{
  assert.throws(()=>applyPublisherValue('relative'),/absolute preview root/);
});

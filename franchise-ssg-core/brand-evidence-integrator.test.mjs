import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyBrandEvidence,validateBrandEvidence} from './brand-evidence-integrator.mjs';

const core=path.dirname(fileURLToPath(import.meta.url));
function brand(i){
  const missing=i===0,areaMissing=i<2,prev=100+i,cur=prev+(i%2===0?10:-4);
  const pct=v=>Math.max(0,Math.min(100,v));
  return{name:'브랜드'+i,route:'/brands/b'+i+'/',slug:'b'+i,categorySlug:i%2===0?'cafe':'chicken',categoryName:i%2===0?'카페·커피':'치킨',cost:5000+i*10,stores:cur,sales:missing?null:20000+i*100,growth:(cur-prev)/prev*100,history:[{year:2024,stores:prev,newStores:10,contractEnd:2,contractCancel:1},{year:2025,stores:cur,newStores:12,contractEnd:3,contractCancel:2}],components:{franchise:1000,education:500,deposit:200,etc:3300+i*10},sourceYear:2025,category:{count:20,costMedian:6000,storesMedian:150,salesMedian:22000,costPercentile:pct(i/135*100),storesPercentile:pct((135-i)/135*100),salesPercentile:missing?null:pct(i/135*100),salesPerAreaMedian:1400,salesPerAreaSample:18,salesPerAreaPercentile:areaMissing?null:pct(i/135*100)},salesPerArea:areaMissing?0:1500+i};
}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-brand-evidence-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  const brands=Array.from({length:136},(_,i)=>brand(i));
  fs.writeFileSync(path.join(root,'data-snapshot-v11-26.json'),JSON.stringify({snapshot_id:'trusted-test',brand_count:136,brands}));
  const candidates=['/',...brands.map(b=>b.route)];
  fs.writeFileSync(path.join(root,'v11-quality-report.json'),JSON.stringify({indexPolicy:{productionCandidateUrls:candidates}}));
  for(const b of brands){const d=path.join(root,...b.route.split('/').filter(Boolean));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),'<html><head></head><body><main><h1>'+b.name+'</h1><!-- v11.52 contextual guides: end --></main></body></html>')}
  const n=path.join(root,'brands/nontrusted');fs.mkdirSync(n,{recursive:true});fs.writeFileSync(path.join(n,'index.html'),'<html><head></head><body><main><h1>비신뢰</h1></main></body></html>');
  return{root,brands};
}

test('brand evidence adds transparent calculations to 136 trusted brands only',()=>{
  const {root}=fixture();
  try{
    const result=applyBrandEvidence(root,core);
    assert.equal(result.brandEvidence,true);assert.equal(result.pages,136);assert.equal(result.metricRows,544);assert.equal(result.costPartRows,544);assert.equal(result.flowRows,136);
    assert.equal(result.missingSalesRows,1);assert.equal(result.missingAreaRows,2);assert.equal(result.candidateOnly,true);
    const b1=fs.readFileSync(path.join(root,'brands/b1/index.html'),'utf8');
    assert.ok(b1.includes('data-v52-brand-evidence="1"'));assert.equal((b1.match(/data-v52-evidence-metric="/g)||[]).length,4);assert.equal((b1.match(/data-v52-cost-part="/g)||[]).length,4);
    assert.ok(b1.includes('신규점'));assert.ok(b1.includes('계약종료'));assert.ok(b1.includes('계약해지'));assert.ok(b1.includes('높은 백분위가 더 좋은 브랜드라는 뜻은 아닙니다'));
    const missing=fs.readFileSync(path.join(root,'brands/b0/index.html'),'utf8');assert.ok(missing.includes('양수 공개값이 없어 업종 백분위 비교에서 제외'));
    const non=fs.readFileSync(path.join(root,'brands/nontrusted/index.html'),'utf8');assert.equal(non.includes('data-v52-brand-evidence='),false);
    assert.deepEqual(validateBrandEvidence(root),{brandEvidence:true,pages:136,metricRows:544,costPartRows:544,flowRows:136,missingSalesRows:1,missingAreaRows:2,candidateOnly:true});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('brand evidence integration is byte-for-byte idempotent',()=>{
  const {root}=fixture();
  try{
    applyBrandEvidence(root,core);
    const paths=['brands/b1/index.html','brands/b0/index.html','assets/brand-evidence.css'];
    const once=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    const result=applyBrandEvidence(root,core),twice=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    assert.equal(result.changed,0);assert.deepEqual(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('brand evidence rejects relative roots and candidate drift',()=>{
  assert.throws(()=>applyBrandEvidence('relative',core),/absolute preview root/);
  const {root,brands}=fixture();
  try{
    const q=JSON.parse(fs.readFileSync(path.join(root,'v11-quality-report.json'),'utf8'));q.indexPolicy.productionCandidateUrls=q.indexPolicy.productionCandidateUrls.filter(r=>r!==brands[0].route);fs.writeFileSync(path.join(root,'v11-quality-report.json'),JSON.stringify(q));
    assert.throws(()=>applyBrandEvidence(root,core),/Trusted brand not production candidate/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

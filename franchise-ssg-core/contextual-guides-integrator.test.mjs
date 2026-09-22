import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyContextualGuides,validateContextualGuides} from './contextual-guides-integrator.mjs';

const core=path.dirname(fileURLToPath(import.meta.url));
const hubs=['/brands/','/categories/','/tools/','/explore/','/rankings/','/cost-components/'];
function brand(i){
  const cafe=i%2===0,prev=100+i,cur=prev+(i%3===0?30:5);
  return{name:'브랜드'+i,route:'/brands/b'+i+'/',slug:'b'+i,categorySlug:cafe?'cafe':'chicken',categoryName:cafe?'카페·커피':'치킨',cost:i%4===0?13000:8000,stores:cur,sales:20000+i,growth:(cur-prev)/prev*100,sourceYear:2025};
}
function page(title,extra=''){return '<html><head></head><body><a class="logo" href="/pm-lab/franchise-ssg-preview">창업데이터랩</a><main><div class="shell page"><h1>'+title+'</h1>'+extra+'</div></main></body></html>'}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-context-guides-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  const brands=Array.from({length:136},(_,i)=>brand(i));
  fs.writeFileSync(path.join(root,'data-snapshot-v11-26.json'),JSON.stringify({snapshot_id:'trusted-2025-test',source_year:2025,brand_count:136,brands}));
  for(const b of brands){const d=path.join(root,...b.route.split('/').filter(Boolean));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),page(b.name,'<!-- v11.52 retention brand: end -->'))}
  for(const route of hubs){const d=path.join(root,...route.split('/').filter(Boolean));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),page(route))}
  fs.writeFileSync(path.join(root,'cost-components/index.html'),'<html><head></head><body><main><h1>비용구성</h1></main></body></html>');
  for(const slug of ['cafe','chicken','convenience']){const d=path.join(root,'categories',slug);fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),page(slug))}
  const candidates=[...brands.map(b=>b.route),'/categories/cafe/','/categories/chicken/',...hubs];
  fs.writeFileSync(path.join(root,'v11-quality-report.json'),JSON.stringify({indexPolicy:{productionCandidateUrls:candidates}}));
  return{root,brands};
}

test('contextual guides enrich only production candidate decision surfaces',()=>{
  const {root}=fixture();
  try{
    const result=applyContextualGuides(root,core);
    assert.equal(result.contextualGuides,true);assert.equal(result.brandGuideRails,136);assert.equal(result.categoryGuideRails,2);assert.equal(result.hubGuideRails,6);
    assert.equal(result.totalGuideRails,144);assert.equal(result.guideLinks,432);assert.equal(result.candidateOnly,true);
    const cafeBrand=fs.readFileSync(path.join(root,'brands/b0/index.html'),'utf8');
    assert.ok(cafeBrand.includes('저가커피 브랜드를 비교할 때 어떤 숫자를 봐야 하나'));assert.equal((cafeBrand.match(/class="v52-context-guide"/g)||[]).length,3);
    const chickenBrand=fs.readFileSync(path.join(root,'brands/b1/index.html'),'utf8');
    assert.ok(chickenBrand.includes('치킨 프랜차이즈 창업비용을 비교할 때 볼 항목'));
    const tools=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');assert.ok(tools.includes('손익분기 계산이 실제와 달라지는 이유'));
    const nonCandidate=fs.readFileSync(path.join(root,'categories/convenience/index.html'),'utf8');assert.equal(nonCandidate.includes('data-v52-context-guides='),false);
    assert.deepEqual(validateContextualGuides(root),{contextualGuides:true,brandGuideRails:136,categoryGuideRails:2,hubGuideRails:6,totalGuideRails:144,guideLinks:432,styledPages:144,candidateOnly:true});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('contextual guide integration is idempotent',()=>{
  const {root}=fixture();
  try{
    applyContextualGuides(root,core);
    const files=['brands/b0/index.html','categories/cafe/index.html','tools/index.html','assets/contextual-guides.css'];
    const once=files.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    const result=applyContextualGuides(root,core),twice=files.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    assert.equal(result.changed,0);assert.deepEqual(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('contextual guides reject relative roots and trusted candidate drift',()=>{
  assert.throws(()=>applyContextualGuides('relative',core),/absolute preview root/);
  const {root,brands}=fixture();
  try{
    const q=JSON.parse(fs.readFileSync(path.join(root,'v11-quality-report.json'),'utf8'));
    q.indexPolicy.productionCandidateUrls=q.indexPolicy.productionCandidateUrls.filter(r=>r!==brands[0].route);
    fs.writeFileSync(path.join(root,'v11-quality-report.json'),JSON.stringify(q));
    assert.throws(()=>applyContextualGuides(root,core),/Trusted brand missing from candidates/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

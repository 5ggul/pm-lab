import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyPrelaunchQuality,validatePrelaunchQuality} from './prelaunch-quality-integrator.mjs';

const FAQ={
  '@context':'https://schema.org','@type':'FAQPage',
  mainEntity:[
    {'@type':'Question',name:'질문 1?',acceptedAnswer:{'@type':'Answer',text:'답변 1'}},
    {'@type':'Question',name:'질문 2?',acceptedAnswer:{'@type':'Answer',text:'답변 2'}},
    {'@type':'Question',name:'질문 3?',acceptedAnswer:{'@type':'Answer',text:'답변 3'}},
    {'@type':'Question',name:'질문 4?',acceptedAnswer:{'@type':'Answer',text:'답변 4'}}
  ]
};

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-prelaunch-quality-'));
  for(const dir of ['assets','rankings','brands/mega-mgc-coffee','about','contact','terms'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/site.css'),'.base{}\n');
  fs.writeFileSync(path.join(root,'rankings/index.html'),`<!doctype html><html><head><script type="application/ld+json" data-v32-ranking-faq>${JSON.stringify(FAQ)}</script></head><body><main><h1>순위</h1><section class="block" id="reading"><h2>읽는 법</h2></section><aside class="source-box">출처</aside></main></body></html>`);
  fs.writeFileSync(path.join(root,'brands/mega-mgc-coffee/index.html'),`<!doctype html><html><body class="v40-market-ui v52-brand-decision"><main><h1>메가MGC커피</h1><section id="answer"></section><section id="cost"></section><section id="benchmark"></section><section id="stores"></section><section id="raw-data"></section><section id="evidence"></section><section id="official-current-cost"></section><section id="source"><p class="history-coverage-note"><strong>점포 이력 범위</strong>설명</p></section></main></body></html>`);
  fs.writeFileSync(path.join(root,'about/index.html'),'<html><body>운영주체의 실명·사업자 정보는 정식 서비스 공개 전에 실제 정보로 채워야 합니다.</body></html>');
  fs.writeFileSync(path.join(root,'contact/index.html'),'<html><body>realContactReady=false</body></html>');
  fs.writeFileSync(path.join(root,'terms/index.html'),'<html><body>실제 사업자 정보가 확정된 뒤 최종 약관에 반영해야 합니다.</body></html>');
  return root;
}

test('prelaunch quality fixes visible FAQ, contrast override and anchor offsets',()=>{
  const root=fixture();
  try{
    const result=applyPrelaunchQuality(root);
    assert.equal(result.prelaunchQuality,true);
    assert.equal(result.rankingFaqItems,4);
    assert.equal(result.historyNotePages,1);
    const rankings=fs.readFileSync(path.join(root,'rankings/index.html'),'utf8');
    assert.equal((rankings.match(/data-v52-ranking-faq-item/g)||[]).length,4);
    for(const item of FAQ.mainEntity){
      assert.equal(rankings.split(item.name).length-1,2);
      assert.equal(rankings.split(item.acceptedAnswer.text).length-1,2);
    }
    const css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');
    assert.ok(css.includes('history-coverage-note{color:#dbe3dc;background:#101610'));
    assert.ok(css.includes('scroll-margin-top:104px'));
    assert.ok(css.includes('scroll-margin-top:92px'));
    assert.deepEqual(validatePrelaunchQuality(root),{
      prelaunchQuality:true,rankingFaqVisible:true,rankingFaqItems:4,historyNotePages:1,historyNotes:1,brandAnchorOffsets:true,previewReleaseBlocked:true
    });
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('prelaunch quality is byte-for-byte idempotent',()=>{
  const root=fixture();
  try{
    applyPrelaunchQuality(root);
    const once=[
      fs.readFileSync(path.join(root,'rankings/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'assets/site.css'),'utf8')
    ];
    const result=applyPrelaunchQuality(root);
    const twice=[
      fs.readFileSync(path.join(root,'rankings/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'assets/site.css'),'utf8')
    ];
    assert.equal(result.changed,false);
    assert.deepEqual(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('prelaunch quality rejects relative roots and FAQ schema drift',()=>{
  assert.throws(()=>applyPrelaunchQuality('relative'),/absolute preview root/);
  const root=fixture();
  try{
    fs.writeFileSync(path.join(root,'rankings/index.html'),'<html><body><aside class="source-box"></aside></body></html>');
    assert.throws(()=>applyPrelaunchQuality(root),/FAQPage JSON-LD missing/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

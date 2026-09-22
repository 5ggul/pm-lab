import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyVisualIntegrity,validateVisualIntegrity} from './visual-integrity-integrator.mjs';

const STOCK='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2200&q=82';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-visual-integrity-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.mkdirSync(path.join(root,'brands/demo'),{recursive:true});
  fs.mkdirSync(path.join(root,'categories/demo'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/site.css'),'.baseline{}\n');
  fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html><head></head><body><main><h1>홈</h1><section class="v41-home-hero"><div class="v41-kicker">KOREA · FRANCHISE INTELLIGENCE</div><div class="v41-home-media"><figure class="v41-shot v41-shot-main"><img src="${STOCK}" alt="매장"></figure><div class="v41-frame-label"><b>01</b><span>FIELD / COST / SALES</span></div></div></section></main></body></html>`);
  fs.writeFileSync(path.join(root,'brands/demo/index.html'),`<!doctype html><html><head></head><body><main data-v10-brand="1"><h1>데모브랜드</h1><section class="v41-detail-hero"><div class="v41-detail-photo"><img src="${STOCK}" alt="브랜드 업종 공간"></div></section></main></body></html>`);
  fs.writeFileSync(path.join(root,'categories/demo/index.html'),`<!doctype html><html><head></head><body><main data-v10-category="1"><h1>데모업종</h1><section class="v41-category-scene"><div class="v41-category-photo"><img src="${STOCK}" alt="업종 공간"></div><div class="v41-category-type"><span>SECTOR</span><b>데모업종</b><em>PUBLIC DATA / 2025</em></div></section></main></body></html>`);
  return root;
}

test('visual integrity replaces remote stock photography and decorative English',()=>{
  const root=fixture();
  try{
    const result=applyVisualIntegrity(root);
    assert.equal(result.removedStockImages,3);
    assert.equal(result.affectedPages,3);
    const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.ok(!home.includes('images.unsplash.com'));
    assert.ok(home.includes('data-v52-local-visual="home"'));
    assert.ok(home.includes('국내 프랜차이즈 공개데이터'));
    assert.ok(home.includes('비용 · 점포 · 매출'));
    const category=fs.readFileSync(path.join(root,'categories/demo/index.html'),'utf8');
    assert.ok(category.includes('<span>업종 데이터</span>'));
    assert.ok(category.includes('<em>공개자료 · 2025</em>'));
    assert.deepEqual(validateVisualIntegrity(root),{visualIntegrity:true,stockImages:0,homeVisuals:1,brandVisuals:1,categoryVisuals:1,markedPages:3,decorativeEnglishRemoved:true});
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('visual integrity is idempotent',()=>{
  const root=fixture();
  try{
    applyVisualIntegrity(root);
    const once=[
      fs.readFileSync(path.join(root,'index.html'),'utf8'),
      fs.readFileSync(path.join(root,'brands/demo/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'categories/demo/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'assets/site.css'),'utf8')
    ];
    const second=applyVisualIntegrity(root);
    const twice=[
      fs.readFileSync(path.join(root,'index.html'),'utf8'),
      fs.readFileSync(path.join(root,'brands/demo/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'categories/demo/index.html'),'utf8'),
      fs.readFileSync(path.join(root,'assets/site.css'),'utf8')
    ];
    assert.equal(second.removedStockImages,0);
    assert.deepEqual(twice,once);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('visual integrity rejects relative roots and missing site css',()=>{
  assert.throws(()=>applyVisualIntegrity('relative'),/absolute preview root/);
  const root=fixture();
  try{
    fs.unlinkSync(path.join(root,'assets/site.css'));
    assert.throws(()=>applyVisualIntegrity(root),/site\.css missing/);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

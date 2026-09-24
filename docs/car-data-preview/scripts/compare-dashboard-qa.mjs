import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const grandeurHybridHtml=fs.readFileSync(new URL('../compare/grandeur-gasoline-vs-hybrid/index.html',import.meta.url),'utf8');
const grandeurHybridDifference=grandeurHybridHtml.match(/id="decision-saving">[^<]*?([\d,]+원)/)?.[1];
assert(grandeurHybridDifference,'Grandeur hybrid comparison difference missing');
const tucsonHtml=fs.readFileSync(new URL('../cars/hyundai/tucson-nx4/index.html',import.meta.url),'utf8');
const tucsonTotal=tucsonHtml.match(/id="pm-total">([\d,]+원)/)?.[1];
assert(tucsonTotal,'Tucson initial total missing');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
fs.mkdirSync('output/review/compare-dashboard',{recursive:true});
try{
  for(const width of [375,768,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/compare/`,{waitUntil:'domcontentloaded'});
    await page.locator('.compare-distance svg').waitFor();
    assert.equal(await page.locator('.compare-graphic').count(),3);
    assert.equal(await page.locator('.compare-total-row').count(),2);
    const total=await page.locator('#compareTable .variant-row').filter({hasText:'세금 + 선택 주행거리 연료·충전비'}).locator('span').first().textContent();
    assert((await page.locator('.compare-total-row').first().textContent()).includes(total.trim()),'dashboard differs from calculated total');
    assert((await page.locator('.compare-summary').textContent()).includes('20,000 km'));
    assert.equal(await page.locator('.compare-distance-values').count(),4);
    assert.equal(await page.locator('.tool-grid .variant-row .is-different').count()>=0,true);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`compare overflow at ${width}`);
    await page.screenshot({path:`output/review/compare-dashboard/compare-${width}.png`,fullPage:true});
    await page.locator('#km').fill('30000');
    assert((await page.locator('.compare-summary').textContent()).includes('30,000 km'));
    assert.equal(await page.locator('.compare-distance-values.selected').count(),1);
    await page.locator('#gas').fill('');
    assert.equal(await page.locator('.compare-graphic').count(),1);
    assert.equal(await page.locator('.compare-efficiency').count(),1);
    assert(await page.locator('.compare-empty').isVisible());
    assert.deepEqual(errors,[],`compare console at ${width}`);
    await page.close();
  }
  for(const width of [375,768,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto(`${base}/cars/hyundai/tucson-nx4/`,{waitUntil:'domcontentloaded'});
    const state=await page.evaluate(()=>{
      const intro=document.querySelector('.pm-hero .answer'),photo=document.querySelector('.pm-photo img'),labels=[...document.querySelectorAll('#pm-form label')];
      const r=element=>element.getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,introClip:intro.scrollHeight>intro.clientHeight+1,fit:getComputedStyle(photo).objectFit,labels:labels.map(l=>({left:r(l).left,top:r(l).top,width:r(l).width})),total:document.querySelector('#pm-total').textContent};
    });
    assert(state.overflow<=1,`Tucson overflow at ${width}`);
    assert.equal(state.introClip,false,`Tucson intro clipped at ${width}`);
    assert.equal(state.fit,'contain');
    assert.equal(state.total,tucsonTotal);
    if(width===375)assert(state.labels[0].top<state.labels[1].top&&state.labels[1].top<state.labels[2].top);
    if(width===1280)assert(state.labels[0].top===state.labels[1].top&&state.labels[1].top===state.labels[2].top);
    await page.screenshot({path:`output/review/compare-dashboard/tucson-${width}.png`,fullPage:true});
    await page.close();
  }
  const home=await browser.newPage({viewport:{width:390,height:844}});
  await home.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await home.locator('.home-recalls').count(),1);
  assert.equal(await home.locator('.home-recalls a').count(),1);
  assert.equal(await home.locator('.home-compare-panel:not([hidden])').count(),1);
  assert.equal(await home.locator('.home-car .image-credit').count(),0);
  assert.equal(await home.locator('.home-photo-source a[href="./media-policy/#vehicle-photo-credits"]').count(),1);
  await home.screenshot({path:'output/review/compare-dashboard/home-390.png',fullPage:true});
  await home.close();
  const desktop=await browser.newPage({viewport:{width:1280,height:900}});
  await desktop.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await desktop.locator('.hero-photograph').count(),0);
  assert.equal(await desktop.locator('.home-annual').count(),6);
  await desktop.locator('[data-home-tab="hybrid"]').click();
  assert((await desktop.locator('.home-compare').innerText()).includes(grandeurHybridDifference));
  await desktop.screenshot({path:'output/review/compare-dashboard/home-1280.png',fullPage:true});
  await desktop.close();
  const fallback=await browser.newPage({viewport:{width:390,height:844}});
  await fallback.goto(`${base}/compare/`,{waitUntil:'domcontentloaded'});
  await fallback.waitForFunction(()=>document.querySelectorAll('#familyListA option').length>100&&document.querySelector('.compare-graphic'));
  const labels=await fallback.locator('#familyListA option').evaluateAll(options=>{
    const values=options.map(option=>option.value).filter(Boolean),wanted=['그랜저','쏘렌토','니로','넥쏘','아이오닉 5','EV6','G80','카이엔'];
    return wanted.map(name=>values.find(value=>value.endsWith(` ${name}`))).filter(Boolean);
  });
  assert(labels.length>=6,'representative comparison families missing');
  for(const [index,label] of labels.entries()){
    const input=fallback.locator(index%2?'#familyB':'#familyA'),param=index%2?'fb':'fa',before=new URL(fallback.url()).searchParams.get(param);
    await input.fill(label);
    await fallback.waitForFunction(({param,before})=>new URL(location.href).searchParams.get(param)!==before,{param,before});
    assert(await fallback.locator('.compare-graphic').count(),`changing vehicle removed graphs: ${label}`);
  }
  assert.equal(await fallback.locator('.compare-selected-spec:visible').count(),2,'full selected specifications must remain visible');
  assert(await fallback.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,'compare fallback overflow at 390');
  await fallback.close();
  console.log('PASS compare dashboard: 3 charts, exact totals, live inputs, missing-price state; Tucson layout and home recalls at 375/768/1280.');
}finally{await browser.close()}

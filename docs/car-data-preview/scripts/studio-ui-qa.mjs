import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import {sizeGeometry} from '../assets/dimension-math.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const data=JSON.parse(fs.readFileSync(new URL('../data/dimension-comparison-reviewed.json',import.meta.url),'utf8'));
const a=data.records.find(r=>r.id==='kia-carnival-gasoline'),b=data.records.find(r=>r.id==='hyundai-grandeur');
assert.equal(data.records.length,9);assert.equal(new Set(data.records.map(r=>r.family_id)).size,8);
assert.equal(a.dimensions.height_mm,1775);assert.equal(data.records.find(r=>r.id==='kia-carnival-hybrid').dimensions.height_mm,1785);
for(const r of data.records){assert.ok(r.source.url.startsWith('https://'));assert.ok(r.source.reviewed_on);for(const value of Object.values(r.dimensions))assert.ok(Number.isFinite(value)&&value>0)}
for(const view of ['front','side','back'])for(const layout of ['overlay','beside']){
 const g=sizeGeometry(a.dimensions,b.dimensions,view,layout),[x,y]=g.boxes;
 assert.ok(Math.abs(x.width/y.width-a.dimensions[g.axis]/b.dimensions[g.axis])<1e-10);
 assert.ok(Math.abs(x.height/y.height-a.dimensions.height_mm/b.dimensions.height_mm)<1e-10);
 for(const box of g.boxes)assert.ok(Math.abs(box.y+box.height-350)<1e-10);
 if(layout==='beside')assert.ok(x.x+x.width<y.x);else assert.equal(x.x+x.width/2,y.x+y.width/2);
}
assert.throws(()=>sizeGeometry({...a.dimensions,height_mm:'1775~1785'},b.dimensions));
assert.throws(()=>sizeGeometry(a.dimensions,b.dimensions,'top'));
assert.deepEqual(sizeGeometry(a.dimensions,b.dimensions,'front'),sizeGeometry(a.dimensions,b.dimensions,'back'));
console.log('PASS exact dimensions, common scale, ground alignment, separate Carnival conditions');
const browser=await chromium.launch();
try{
 const page=await newQaPage(browser,{viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.home-car').count(),6);assert.equal(await page.locator('h1').count(),1);
 assert.ok(!/내 차, 1년에 얼마|연비부터 세금·연료비까지 한눈에/.test(await page.content()));
 const left=await page.locator('.home-search').boundingBox(),middle=await page.locator('#catalog').boundingBox(),right=await page.locator('.studio-inspector').boundingBox();assert.ok(left.x<middle.x&&middle.x<right.x);
 const preview=page.locator('[data-studio-select="hyundai-grandeur"]');await preview.click();assert.equal(await page.locator('.studio-detail h2').innerText(),'그랜저');
 assert.ok((await page.locator('.studio-primary').getAttribute('href')).includes('/cars/hyundai/grandeur-gn7/'));
 await page.locator('[data-studio-tab="spec"]').click();assert.match(await page.locator('.studio-dimensions').innerText(),/5,035/);
 assert.ok(!(await page.locator('.studio-inspector').innerText()).includes('unknown'));
 await page.goto(base+'/cars/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('[data-studio-select]').length===24);
 const firstId=await page.locator('.vehicle-card').first().getAttribute('data-family-id');assert.equal(await page.locator('[data-studio-select][aria-pressed="true"]').getAttribute('data-studio-select'),firstId);
 await page.locator('#catalogSearch').fill('EV3');await page.waitForFunction(()=>document.querySelector('.studio-detail h2')?.textContent==='EV3');
 assert.equal(await page.locator('.studio-secondary').last().innerText(),'크기 비교 차량 선택');assert.ok(!(await page.locator('.studio-secondary').last().getAttribute('href')).includes('?a='));
 await page.locator('#catalogSearch').fill('zzzznonexistent');await page.waitForFunction(()=>document.querySelector('.studio-detail h2')?.textContent==='검색 결과가 없습니다');
 for(const width of [375,390,430,1280]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/',{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width<1000){const trigger=page.locator('[data-studio-select="hyundai-grandeur"]');await trigger.click();assert.ok(await page.locator('.studio-inspector').isVisible());assert.ok(!await page.locator('#catalog').isVisible());await page.locator('.studio-back').click();assert.ok(await page.locator('#catalog').isVisible());assert.ok(await trigger.evaluate(el=>el===document.activeElement));}
 }
 await page.goto(base+'/compare/dimensions/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#sizeA').inputValue(),a.id);
 await page.locator('[data-size-view="front"]').click();assert.equal(await page.locator('#sizeViewTitle').innerText(),'앞에서');assert.match(await page.locator('#dimensionCanvas').innerHTML(),/1,995 mm/);
 await page.locator('[data-size-layout="beside"]').click();await page.locator('#sizeSwap').click();assert.equal(await page.locator('#sizeA').inputValue(),b.id);
 await page.locator('#sizeOpacity').fill('55');await page.locator('#sizeOpacity').dispatchEvent('input');assert.equal(await page.locator('[data-envelope="a"]').getAttribute('fill-opacity'),'0.55');
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#sizeA').inputValue(),b.id);assert.equal(await page.locator('[data-size-view="front"]').getAttribute('aria-pressed'),'true');
 await page.locator('#sizeB').selectOption(b.id);assert.equal(await page.locator('#sizeValues td').filter({hasText:'같음'}).count(),4);
 await page.goto(base+'/compare/dimensions/?a=unsupported',{waitUntil:'networkidle'});assert.ok(await page.locator('.size-query-notice').isVisible());
 for(const width of [375,390,430,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);await page.close();
 const nojs=await newQaPage(browser,{javaScriptEnabled:false});await nojs.goto(base+'/compare/dimensions/');assert.equal(await nojs.locator('[data-envelope]').count(),2);assert.equal(await nojs.locator('#sizeValues tr').count(),4);assert.ok(await nojs.locator('#sizeSourceA').isVisible());await nojs.close();
 console.log('PASS studio selection, filters, mobile back/focus, dimensions controls, URL state, invalid IDs and no-JS content');
}finally{await browser.close()}

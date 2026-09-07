import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import {sizeGeometry} from '../assets/dimension-math.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const data=JSON.parse(fs.readFileSync(new URL('../data/dimension-comparison-reviewed.json',import.meta.url),'utf8'));
const a=data.records.find(r=>r.id==='kia-carnival-gasoline'),b=data.records.find(r=>r.id==='hyundai-grandeur');
const families=JSON.parse(fs.readFileSync(new URL('../data/generated/catalog-list-index.json',import.meta.url),'utf8')).families;
assert.equal(new Set(data.records.map(r=>r.id)).size,data.records.length);
for(const r of data.records){assert.ok(families.some(f=>f.family_id===r.family_id),r.family_id);assert.ok(r.condition);assert.ok(r.dimensions.wheelbase_mm<r.dimensions.length_mm)}
assert.ok(data.records.length>=50);assert.ok(new Set(data.records.map(r=>r.family_id)).size>=23);
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
 assert.equal(await page.locator('h1').innerText(),'연비·세금·유지비 비교');
 const hero=page.locator('#showroomPhoto img');await hero.evaluate(i=>i.decode());assert.match(await hero.getAttribute('src'),/showroom-k8-background-edited.webp$/);assert.match(await page.locator('#showroomPhoto').innerText(),/CC BY-SA 4.0.*AI 배경 보정/);
 for(const id of await page.locator('[data-showroom-car]').evaluateAll(bs=>bs.map(b=>b.dataset.showroomCar))){await page.locator('[data-showroom-car="'+id+'"]').click();await page.locator('#showroomPhoto img').evaluate(i=>i.decode());assert.equal(await page.locator('[data-showroom-car][aria-pressed="true"]').count(),1)}

 await page.locator('[data-showroom-car="grandeur-gn7"]').click();assert.match(await page.locator('#showroomName').innerText(),/그랜저/);assert.match(await page.locator('#showroomMetrics').innerText(),/649,220/);assert.ok((await page.locator('#showroomCost').getAttribute('href')).includes('fa=hyundai-grandeur'));
 await page.goto(base+'/cars/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('[data-studio-select]').length===24);
 const firstId=await page.locator('.vehicle-card').first().getAttribute('data-family-id');assert.equal(await page.locator('[data-studio-select][aria-pressed="true"]').getAttribute('data-studio-select'),firstId);
 await page.locator('#catalogSearch').fill('EV3');await page.waitForFunction(()=>document.querySelector('.studio-detail h2')?.textContent==='EV3');
 assert.equal(await page.locator('.studio-secondary').last().innerText(),'크기 비교');assert.ok((await page.locator('.studio-secondary').last().getAttribute('href')).includes('?a=kia-ev3'));
 await page.locator('#catalogSearch').fill('zzzznonexistent');await page.waitForFunction(()=>document.querySelector('.studio-detail h2')?.textContent==='검색 결과가 없습니다');
 for(const width of [375,390,430,1280]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/',{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('[data-showroom-car="grandeur-gn7"]').click();assert.match(await page.locator('#showroomName').innerText(),/그랜저/);
  if(width<1000){await page.goto(base+'/cars/?q=EV3',{waitUntil:'networkidle'});const trigger=page.locator('[data-studio-select="kia-ev3"]');await trigger.click();assert.ok(await page.locator('.studio-inspector').isVisible());await page.locator('.studio-back').click();assert.ok(await trigger.evaluate(el=>el===document.activeElement));}

 }
 await page.goto(base+'/compare/dimensions/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#sizeA').inputValue(),a.id);
 await page.locator('[data-size-view="front"]').click();assert.equal(await page.locator('#sizeViewTitle').innerText(),'앞에서');assert.match(await page.locator('#dimensionCanvas').innerHTML(),/1,995 mm/);
 await page.locator('[data-size-layout="beside"]').click();await page.locator('#sizeSwap').click();assert.equal(await page.locator('#sizeA').inputValue(),b.id);
 await page.locator('#sizeOpacity').fill('55');await page.locator('#sizeOpacity').dispatchEvent('input');assert.equal(await page.locator('[data-envelope="a"]').getAttribute('fill-opacity'),'0.55');
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#sizeA').inputValue(),b.id);assert.equal(await page.locator('[data-size-view="front"]').getAttribute('aria-pressed'),'true');
 await page.locator('#sizeFamilyB').selectOption(b.family_id);assert.equal(await page.locator('#sizeValues td').filter({hasText:'같음'}).count(),4);
 await page.goto(base+'/compare/dimensions/?a=unsupported',{waitUntil:'networkidle'});assert.ok(await page.locator('.size-query-notice').isVisible());
 for(const width of [375,390,430,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.equal(await page.locator('#sizeFamilyA option').count(),592);
 const missing=JSON.parse(fs.readFileSync(new URL('../data/dimension-coverage.json',import.meta.url),'utf8')).missing_families[0];
 await page.locator('#sizeFamilyA').selectOption(missing.id);assert.equal(await page.locator('[data-envelope]').count(),0);assert.equal(await page.locator('#sizeA').inputValue(),'manual');
 for(const [k,v] of Object.entries({length_mm:'4800',width_mm:'1900',height_mm:'1600'}))await page.locator('#sizeA-'+k).fill(v);assert.equal(await page.locator('[data-envelope]').count(),2);assert.match(await page.locator('#sizeStatusA').innerText(),/직접 입력값/);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#sizeFamilyA').inputValue(),missing.id);assert.equal(await page.locator('#sizeA-height_mm').inputValue(),'1600');assert.equal(await page.locator('[data-envelope]').count(),2);
 await page.locator('#sizeA-height_mm').fill('0');assert.equal(await page.locator('[data-envelope]').count(),0);
 assert.deepEqual(errors,[]);await page.close();
 const nojs=await newQaPage(browser,{javaScriptEnabled:false});await nojs.goto(base+'/compare/dimensions/');assert.equal(await nojs.locator('[data-envelope]').count(),2);assert.equal(await nojs.locator('#sizeValues tr').count(),4);assert.ok(await nojs.locator('#sizeSourceA').isVisible());await nojs.close();
 console.log('PASS studio selection, filters, mobile back/focus, dimensions controls, URL state, invalid IDs and no-JS content');
}finally{await browser.close()}

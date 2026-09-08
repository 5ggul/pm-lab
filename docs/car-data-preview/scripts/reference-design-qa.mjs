import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch();
const routes=['','cars/','cars/hyundai/grandeur-gn7/','compare/','compare/grandeur-vs-k8/','compare/tucson-gasoline-vs-hybrid/','tools/annual-cost/','rankings/fuel-economy/','recalls/','guide/','guide/grandeur-wheel-fuel-cost/'];
fs.mkdirSync('output/review/reference-design',{recursive:true});
try{
 for(const width of [375,390,430,1280]){
  const page=await newQaPage(browser,{viewport:{width,height:900},reducedMotion:'reduce'});
  for(const route of routes){
   const response=await page.goto(`${base}/${route}`,{waitUntil:'networkidle'});assert.equal(response.status(),200,route);
   assert(await page.locator('body').getAttribute('data-reference-page'),route);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: ${route} overflow`);
   assert.deepEqual(await page.locator('.reference-section-nav a').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash)),[],route);
   assert(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size}),`${route}: duplicate IDs`);
   if(route.startsWith('compare/')&&route!=='compare/'){
    const matrix=page.locator('.reference-matrix');assert.equal(await matrix.count(),1);
    const rows=matrix.locator('tbody tr'),total=await rows.count();assert(total>0);
    const equal=await matrix.locator('tbody tr[data-equal=true]').count();
    const checkbox=page.getByRole('checkbox',{name:'다른 항목만'});await checkbox.check();
    assert.equal(await matrix.locator('tbody tr:visible').count(),total-equal);
    await checkbox.focus();await page.keyboard.press('Space');assert.equal(await matrix.locator('tbody tr:visible').count(),total);
   }
   if([390,1280].includes(width))await page.screenshot({path:`output/review/reference-design/${width}-${route.replaceAll('/','-')||'home'}.png`,fullPage:false});
  }
  await page.close();
 }
 const nojs=await newQaPage(browser,{javaScriptEnabled:false});
 await nojs.goto(`${base}/compare/tucson-gasoline-vs-hybrid/`);
 assert.equal(await nojs.locator('.reference-matrix tbody tr:visible').count(),await nojs.locator('.reference-matrix tbody tr').count());
 assert.equal(await nojs.getByRole('checkbox',{name:'다른 항목만'}).count(),0);
 await nojs.close();
 console.log('PASS reference design: 11 routes at 375/390/430/1280, anchor targets, unique IDs, difference filter and keyboard, no-JS comparison.');
}finally{await browser.close()}

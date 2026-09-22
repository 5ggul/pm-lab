import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const recallCount=JSON.parse(fs.readFileSync(path.join(root,'data/recalls.json'),'utf8')).notices.length;
const grandeurTotal=catalog.cars.find(car=>car.id==='grandeur-gn7').rep.total.toLocaleString('ko-KR')+'원';
const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const routes=['','cars/','cars/family/?id=hyundai-nexo','cars/kia/sorento-mq4/','cars/hyundai/ioniq-6-ce1/','compare/sorento-vs-santafe/','compare/','rankings/','rankings/fuel-economy/','recalls/','tools/annual-cost/'];
const forbiddenStyles=/assets\/(?:site|studio-ui|showroom-ui|clear-ui|page-design|motion-ui|reference-ui|pilot|utility|premium-data-ui|metric-visuals)\.css/;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
let checks=0;
try{
 for(const width of [360,375,390,430,1280]){
  const page=await newQaPage(browser,{viewport:{width,height:900}});
  for(const route of routes){
   const response=await page.goto(`${base}/${route}`,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,route);
   if(route.startsWith('cars/family/'))await page.waitForSelector('[data-family-universal="ready"]');
   const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,css:[...document.querySelectorAll('link[rel="stylesheet"]')].map(n=>n.getAttribute('href')),font:getComputedStyle(document.body).fontFamily,background:getComputedStyle(document.body).backgroundColor,animations:[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&s.animationDuration!=='0s'}).length}));
   assert(result.scroll<=width+1,`${route} overflows ${result.scroll-width}px at ${width}`);
   assert.equal(result.h1,1,`${route} H1`);
   assert(result.css.some(x=>x.includes('tokens.css'))&&result.css.some(x=>x.includes('base.css')));
   assert(result.css.every(x=>!forbiddenStyles.test(x)),`${route} loads legacy CSS`);
    assert(/Pretendard|system-ui|Segoe UI/.test(result.font)&&!result.font.includes('Inter'),`${route} font`);
   assert.equal(result.animations,0,`${route} load animation`);
   checks++;
  }
  await page.close();
 }
 const page=await newQaPage(browser,{viewport:{width:390,height:844}});
 await page.goto(base+'/');
 assert.equal(await page.locator('main>section').count(),3);
 assert.equal(await page.locator('main h1').count(),1);
 assert.equal(await page.locator('.home-car').count(),6);
 assert.equal(await page.locator('header input').count(),1);
 assert.equal(await page.locator('main form[role="search"],main form.db-search').count(),1);
 assert.equal(await page.locator('.home-compare-tabs [role="tab"]').count(),3);
 assert.equal(await page.locator('.home-annual').count(),6);
 assert((await page.locator('.home-car').first().innerText()).includes(grandeurTotal));
 await page.goto(base+'/cars/');await page.waitForFunction(()=>document.querySelectorAll('.vehicle-card').length===24);
 assert.equal(await page.locator('.vehicle-card-grid').evaluate(e=>getComputedStyle(e).display),'block');
 await page.goto(base+'/rankings/fuel-economy/');assert(await page.locator('.rank-row').count()>0);
 await page.goto(base+'/recalls/');assert.equal(await page.locator('.decision-recall').count(),recallCount);
 await page.close();
 const nojs=await newQaPage(browser,{javaScriptEnabled:false});
 await nojs.goto(base+'/cars/');assert((await nojs.locator('#catalogStatic li').count())>=24);
 await nojs.goto(base+'/');assert.equal(await nojs.locator('.home-car').count(),6);
 await nojs.close();
 console.log(`PASS editorial UI: ${checks} responsive route views; one search, six home cars, compact catalog, rankings, recalls and no-JS content.`);
}finally{await browser.close()}

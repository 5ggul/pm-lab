import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch({headless:true});
const jsonld=page=>page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.flatMap(n=>{const s=JSON.parse(n.textContent);return s['@graph']||[s];}));
const page=await newQaPage(browser,{viewport:{width:390,height:900}});
try{
  const nojs=await newQaPage(browser,{javaScriptEnabled:false,viewport:{width:390,height:900}});
  await nojs.goto(base+'/cars/');assert(await nojs.locator('#catalogStatic').isVisible());assert.equal(await nojs.locator('#catalogStatic .car-card').count(),6);
  for(const href of await nojs.locator('#catalogStatic .car-card').evaluateAll(a=>a.map(x=>x.href)))assert((await fetch(href)).ok,href);
  await nojs.close();
  await page.route('**/data/generated/catalog-list-index.json',r=>r.abort());await page.goto(base+'/cars/');await page.waitForSelector('.consumer-catalog');assert(await page.locator('#catalogStatic').isVisible());await page.unroute('**/data/generated/catalog-list-index.json');
  await page.goto(base+'/cars/');await page.waitForSelector('html[data-consumer-catalog="ready"]');assert(await page.locator('#catalogStatic').isHidden());assert.equal(await page.locator('#catalogGrid .vehicle-card').count(),24);
  await page.goto(base+'/tools/car-tax/');assert.equal(await page.locator('#costResult').textContent(),'290,836원');
  await page.locator('#cc').fill('2497');assert.equal(await page.locator('#costResult').textContent(),'649,220원');
  await page.locator('#taxFuel').selectOption('electric');assert.equal(await page.locator('#costResult').textContent(),'130,000원');assert(await page.locator('#cc').isDisabled());
  await page.goto(base+'/tools/ev-charge-cost/');assert.match(await page.locator('#costResult').textContent(),/입력/);await page.locator('#distance').fill('1000');await page.locator('#unitPrice').fill('350');assert.equal(await page.locator('#costResult').textContent(),'70,000원');await page.locator('#efficiency').fill('0');assert.match(await page.locator('#costResult').textContent(),/입력/);
  await page.goto(base+'/tools/fuel-cost/');await page.waitForFunction(()=>!document.querySelector('#liveFuelStatus').textContent.includes('확인 중'));await page.locator('#distance').fill('400');await page.locator('#unitPrice').fill('1800');assert.equal(await page.locator('#costResult').textContent(),'60,000원');assert.match(await page.locator('#priceOrigin').textContent(),/직접 입력/);
  await page.route('**/data/fuel-price.json',r=>r.abort());await page.goto(base+'/tools/fuel-cost/');await page.waitForFunction(()=>document.querySelector('#liveFuelStatus').textContent.includes('직접 입력'));assert.equal(await page.locator('#unitPrice').inputValue(),'');await page.locator('#unitPrice').fill('1800');assert.equal(await page.locator('#costResult').textContent(),'3,000,000원');await page.unroute('**/data/fuel-price.json');
  const routes=['/','/tools/','/tools/car-tax/','/tools/fuel-cost/','/tools/ev-charge-cost/','/tools/annual-cost/','/guide/','/guide/car-tax-basics/','/guide/ev-charging-budget/','/compare/grandeur-vs-k8/','/rankings/fuel-economy/'];
  for(const width of [375,390,430,1280]){
    await page.setViewportSize({width,height:900});
    for(const route of routes){
      const response=await page.goto(base+route);assert(response.ok(),route);
      assert.equal(await page.locator('h1').count(),1);assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} overflow ${route}`);
      const schema=await jsonld(page);assert(schema.length,`missing schema ${route}`);
      if(route.startsWith('/tools/')&&route!=='/tools/')assert(schema.some(s=>s['@type']==='WebApplication'));
    }
  }
  await page.goto(base+'/rankings/fuel-economy/');const list=(await jsonld(page)).find(s=>s['@type']==='ItemList');assert.equal(list.numberOfItems,await page.locator('.rank-row').count());assert.deepEqual(list.itemListElement.map(i=>i.position),await page.locator('.rank-row').evaluateAll(rows=>rows.map(r=>Number(r.dataset.rank))));
  await page.goto(base+'/guide/');assert.equal(await page.locator('.utility-directory>a').count(),6);
  for(const href of await page.locator('.utility-directory>a').evaluateAll(a=>a.map(x=>x.href)))assert((await fetch(href)).ok,href);
  await page.goto(base+'/cars/hyundai/grandeur-gn7/');assert(await page.locator('[data-fuel-status]').isVisible());assert.equal(await page.locator('#fuelPrice').inputValue(),Number(await page.evaluate(()=>CAR_CATALOG.gasPrice)).toFixed(2));
  fs.mkdirSync('output/playwright',{recursive:true});await page.setViewportSize({width:390,height:900});await page.goto(base+'/tools/fuel-cost/');await page.screenshot({path:'output/playwright/car-fuel-tool-mobile.png',fullPage:true});await page.setViewportSize({width:1280,height:900});await page.goto(base+'/tools/');await page.screenshot({path:'output/playwright/car-tools-desktop.png',fullPage:true});
  console.log('PASS static/no-JS/fetch-failure catalogue, three calculators, manual price fallback, four widths, schema and six guides.');
}finally{await browser.close();}

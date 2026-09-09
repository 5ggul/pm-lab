import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});const remote=/https:\/\/(thumb|upload|commons)\.wikimedia\.org\//;
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#ddd"/></svg>';
try{
 for(const width of [390,1280]){const context=await browser.newContext({viewport:{width,height:844}});await context.route(remote,r=>r.abort());const page=await context.newPage();const requested=[];page.on('request',r=>requested.push(r.url()));
  for(const route of ['/','/cars/','/cars/kia/sportage-nq5/']){await page.goto(base+route);if(route==='/cars/')await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');const photo=page.locator('picture[data-optimized-photo] img:visible').first();await photo.scrollIntoViewIfNeeded();await photo.evaluate(img=>img.decode());const result=await photo.evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,rendered:img.getBoundingClientRect().width}));assert.match(result.src,/\/assets\/vehicle-images\/.+\.webp$/);assert(Number(result.src.match(/-(\d+)-[a-f0-9]+\.webp$/)?.[1])>=Math.floor(result.rendered)*0.9,JSON.stringify({route,width,...result}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert(!requested.some(u=>u.includes('family-detail-index.json')),'Catalogue should not download full detail index');assert(requested.some(u=>u.includes('catalog-list-index.json')));await context.close();
 }
 // A failed local optimized file retries the credited original source.
 for(const failOriginal of [false,true]){const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/assets/vehicle-images/**',r=>r.abort());await context.route(remote,r=>failOriginal?r.abort():r.fulfill({contentType:'image/svg+xml',body:fixture}));const page=await context.newPage();
  for(const route of ['/cars/kia/sportage-nq5/','/cars/?q=EV3']){await page.goto(base+route);if(route.includes('?'))await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
   if(failOriginal){await page.waitForFunction(()=>document.querySelector('.pilot-photo-failed,[data-photo-error="true"]'));assert(await page.getByRole('status').filter({hasText:'사진을 불러오지 못했습니다'}).count()>0);}
   else{const img=page.locator('picture[data-optimized-photo] img:visible').first();await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('picture[data-optimized-photo] img')].some(i=>i.complete&&i.naturalWidth>0&&/wikimedia/.test(i.currentSrc)));}
  }await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});await context.route(remote,r=>r.abort());const page=await context.newPage();await page.goto(base+'/cars/');assert(await page.locator('a[href*="sorento-mq4"]').count()>0);const img=page.locator('picture[data-optimized-photo] img:visible').first();await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());assert.match(await img.evaluate(i=>i.currentSrc),/\.webp$/);await context.close();
 console.log('PASS responsive local images, remote outage, original retry, total image outage, compact catalog and no-JS HTML');
}finally{await browser.close()}



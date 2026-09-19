import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});const remote=/https:\/\/(thumb|upload|commons)\.wikimedia\.org\//;
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#ddd"/></svg>';
try{
 for(const width of [390,1280]){const context=await browser.newContext({viewport:{width,height:844}});await context.route(remote,r=>r.abort());const page=await context.newPage();const requested=[];page.on('request',r=>requested.push(r.url()));
  for(const route of ['/','/cars/','/cars/kia/sportage-nq5/']){await page.goto(base+route);if(route==='/cars/')await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');const photo=page.locator('picture[data-optimized-photo] img:visible').first();await photo.scrollIntoViewIfNeeded();await photo.evaluate(img=>img.decode());const result=await photo.evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,rendered:img.getBoundingClientRect().width}));assert.match(result.src,/\/assets\/vehicle-images\/.+\.webp$/);assert(Number(result.src.match(/-(\d+)-[a-f0-9]+\.webp$/)?.[1])>=Math.floor(result.rendered)*0.9,JSON.stringify({route,width,...result}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert(!requested.some(u=>u.includes('family-detail-index.json')),'Catalogue should not download full detail index');assert(requested.some(u=>u.includes('catalog-list-index.json')));await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});await context.route(remote,r=>r.abort());const page=await context.newPage();await page.goto(base+'/cars/');assert(await page.locator('a[href*="sorento-mq4"]').count()>0);assert.ok(await page.locator('#catalogStatic li').count()>=24);await context.close();
 console.log('PASS responsive local images, remote outage isolation, compact catalog and no-JS text links');
}finally{await browser.close()}



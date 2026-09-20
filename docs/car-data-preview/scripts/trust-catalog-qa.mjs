import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const fuel=JSON.parse(fs.readFileSync(path.join(root,'data/fuel-price.json'),'utf8'));
const pages=['compare/index.html','tools/annual-cost/index.html','cars/hyundai/grandeur-gn7/index.html','cars/kia/sorento-mq4/index.html','cars/kia/k8-gl3/index.html','cars/genesis/g80-rg3/index.html'];
for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,new RegExp(`data-price-date="${fuel.price_as_of}"`),`${page}: old fuel date`);
  assert.match(html,new RegExp(`data-price-stale="${fuel.stale}"`),`${page}: wrong fuel freshness`);
  assert.equal((html.match(/page-fuel-status-foot/g)||[]).length,1,`${page}: fuel footer count`);
}
const compare=fs.readFileSync(path.join(root,'compare/index.html'),'utf8');
assert.equal((compare.match(/comparison-directory/g)||[]).length,1,'comparison preset directory duplicated');
const list=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog-list-index.json'),'utf8'));
assert(list.families.every(row=>Number(row.record_count)>0),'catalog family record count missing');
assert.equal(list.families.find(row=>row.family_id==='kia-sorento')?.record_count,182,'Sorento record count');
const root404=fs.readFileSync(path.join(root,'../404.html'),'utf8');
assert.match(root404,/noindex,nofollow/);assert.doesNotMatch(root404,/href="\.\//,'root 404 has nested relative link');

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
try{
  const cars=await browser.newPage({viewport:{width:390,height:844}});
  await cars.goto(`${base}/cars/`,{waitUntil:'domcontentloaded'});
  await cars.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
  const card= cars.locator('.vehicle-card').first();
  assert(await card.locator('.vehicle-card-meta').textContent().then(text=>/신고 사양 [1-9][0-9]*개/.test(text)),'catalog shows missing record count');
  assert.equal(await cars.locator('.vehicle-card details,.vehicle-card summary').count(),0,'photo credit repeats in catalog rows');
  assert(await card.locator('.vehicle-card-annual small').textContent().then(Boolean),'representative condition missing');
  assert((await card.evaluate(el=>el.getBoundingClientRect().top))<844,'first catalog card is below first mobile viewport');
  assert((await cars.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=1,'catalog mobile overflow');
  await cars.close();

  const detail=await browser.newPage({viewport:{width:390,height:844}});
  await detail.goto(`${base}/cars/hyundai/grandeur-gn7/?spec=gas35&drive=2WD&wheel=19&km=30000`,{waitUntil:'domcontentloaded'});
  assert.equal(await detail.locator('#wheelSelect').inputValue(),'19','detail wheel query not restored');
  assert.match(await detail.locator('#configLine').textContent(),/3\.5 가솔린 · 2WD · 19인치/,'detail configuration not restored');
  await detail.reload({waitUntil:'domcontentloaded'});
  assert.equal(await detail.locator('#wheelSelect').inputValue(),'19','detail wheel lost after reload');
  assert.equal(new URL(detail.url()).searchParams.get('km'),'30000','detail distance lost');
  await detail.close();
  console.log('PASS trust/catalog: current fuel date, one comparison directory, record counts, compact credits, mobile first result, persistent detail selection, root 404.');
}finally{await browser.close()}

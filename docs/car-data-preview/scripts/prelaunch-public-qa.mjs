import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_URL||'http://127.0.0.1:4201/car-data-preview/';
const htmlFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file)}else if(entry.name==='index.html')htmlFiles.push(file)}}walk(root);
const banned=['Phase 1','GitHub Actions','품질 게이트','SEO 상세','세대 미분류','raw_only','reviewed_override'];
for(const term of banned)assert.equal(htmlFiles.filter(file=>fs.readFileSync(file,'utf8').includes(term)).length,0,`public HTML contains ${term}`);
const cars=fs.readFileSync(path.join(root,'cars/index.html'),'utf8');
assert.ok((cars.match(/<li><div><span>/g)||[]).length>=24,'cars no-JS list has fewer than 24 rows');
assert.ok(!/family\/\?id=/.test(fs.readFileSync(path.join(root,'cars/hyundai/index.html'),'utf8')),'manufacturer hub links generic family route');
const media=fs.readFileSync(path.join(root,'media-policy/index.html'),'utf8');
assert.match(media,/차량 사진 383종 출처 보기/);
const contact=fs.readFileSync(path.join(root,'contact/index.html'),'utf8');
assert.ok(!contact.includes('issues/new'),'GitHub Issues remains on contact page');
const nexo=JSON.parse(fs.readFileSync(path.join(root,'data/generated/family-detail-index.json'),'utf8')).families.find(row=>row.family_name==='넥쏘');
assert.ok(nexo,'Nexo family missing');
assert.match(fs.readFileSync(path.join(root,'cars/family/index.html'),'utf8'),/현대 넥쏘<\/strong> · 93\.7–107\.6 km\/kg/);
const misclassified=JSON.parse(fs.readFileSync(path.join(root,'data/generated/family-detail-index.json'),'utf8')).families.find(row=>row.family_id==='family-95297a2c89021776');
assert.equal(misclassified.maker,'Brilliance Shineray');
const staticFamilies=JSON.parse(fs.readFileSync(path.join(root,'data/generated/family-detail-index.json'),'utf8')).families.filter(row=>row.static_detail_path);
for(const family of staticFamilies){
  const html=fs.readFileSync(path.join(root,family.static_detail_path,'index.html'),'utf8'),nodes=[...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(match=>{const parsed=JSON.parse(match[1]);return parsed['@graph']||[parsed]}),vehicle=nodes.find(node=>node['@type']==='Vehicle'),crumbs=nodes.find(node=>node['@type']==='BreadcrumbList');
  assert.ok(vehicle?.additionalProperty?.length,`${family.static_detail_path} Vehicle values missing`);assert.ok(crumbs?.itemListElement?.some(item=>item.name===family.maker&&item.item),`${family.static_detail_path} maker breadcrumb URL missing`);
}

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[];
const routes=['','cars/','cars/hyundai/','cars/kia/','cars/genesis/','cars/hyundai/grandeur-gn7/','cars/kia/sorento-mq4/','cars/hyundai/tucson-nx4/','cars/hyundai/ioniq-5/','cars/kia/ev6/','cars/genesis/g80-rg3/','compare/','compare/sorento-vs-santafe/','compare/grandeur-vs-k8/','compare/ioniq5-vs-ev6/','compare/tucson-gasoline-vs-hybrid/','compare/ev3-vs-ev6/','rankings/','rankings/fuel-economy/','rankings/ev-efficiency/','rankings/car-tax/','rankings/annual-energy-cost/','tools/car-tax/','tools/fuel-cost/','tools/ev-charge-cost/','tools/annual-cost/','recalls/','guide/','about/','methodology/','data-sources/','terms/','privacy/','contact/'];
for(const route of routes){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('console',message=>{if(message.type()==='error')errors.push(`${route}: ${message.text()}`)});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${route}: HTTP ${response.status()} ${response.url()}`)});
  const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200,`${route} status`);
  assert.equal(await page.locator('h1').count(),1,`${route} H1 count`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,`${route} overflows by ${overflow}px`);
  await page.close();
}
for(const width of [360,375,390,430]){
  const page=await browser.newPage({viewport:{width,height:812}});
  await page.goto(new URL('cars/hyundai/grandeur-gn7/',base).href,{waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('.vehicle-keyline').isVisible(),`keyline hidden at ${width}`);
  assert.ok((await page.locator('.vehicle-keyline').innerText()).includes('11.7 km/L'),`efficiency missing at ${width}`);
  assert.ok(await page.locator('.vehicle-keyline').boundingBox().then(box=>box&&box.y<812),`keyline below fold at ${width}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,`detail overflows at ${width}`);
  await page.close();
}
const interactive=await browser.newPage({viewport:{width:1280,height:900}});
await interactive.goto(new URL('compare/',base).href,{waitUntil:'networkidle'});assert.match(await interactive.locator('#familyA').inputValue(),/쏘렌토/);assert.match(await interactive.locator('#familyB').inputValue(),/싼타페/);assert.ok(!/6DCT|GDI|빌트인캠 Off/.test(await interactive.locator('#rowA option:checked').innerText()),'compare exposes raw source label');
await interactive.goto(new URL('tools/annual-cost/',base).href,{waitUntil:'networkidle'});assert.match(await interactive.locator('#familySearch').inputValue(),/쏘렌토/);assert.ok(!/6DCT|GDI|빌트인캠 Off/.test(await interactive.locator('#sourceRow option:checked').innerText()),'calculator exposes raw source label');assert.notEqual(await interactive.locator('[data-benchmark-median]').innerText(),'—','calculator benchmark did not load');assert.ok(!/세대 미분류|1\.6T-GDI|6DCT/.test(await interactive.locator('body').innerText()),'calculator exposes internal or raw labels after rendering');
await interactive.goto(new URL('cars/',base).href,{waitUntil:'networkidle'});const chips=await interactive.locator('#catalogMakerChips').innerText();assert.ok(chips.indexOf('현대')<chips.indexOf('기아')&&chips.indexOf('기아')<chips.indexOf('제네시스'),'domestic maker order incorrect');assert.ok(!(await interactive.locator('#catalogGrid').innerText()).includes('unknown'),'unknown fuel label visible');
await interactive.close();
const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});const noJsPage=await noJs.newPage();
await noJsPage.goto(new URL('cars/',base).href,{waitUntil:'domcontentloaded'});
assert.ok(await noJsPage.locator('#catalogStatic li').count()>=24,'no-JS browser cannot read 24 cars');
await noJsPage.goto(new URL(`cars/family/?id=${encodeURIComponent(nexo.family_id)}`,base).href,{waitUntil:'domcontentloaded'});
assert.ok((await noJsPage.locator('.family-noscript').textContent()).includes('넥쏘'),'generic family no-JS data missing');
await noJs.close();
await browser.close();
assert.equal(errors.length,0,`console errors:\n${errors.join('\n')}`);
console.log(`PASS ${htmlFiles.length} HTML files; ${staticFamilies.length} vehicle schemas; ${routes.length} routes; mobile 360/375/390/430; defaults, benchmarks and no-JS fallbacks.`);

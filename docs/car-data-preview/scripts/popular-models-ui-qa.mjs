import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
const root=new URL('../',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('data/popular-models-reviewed.json',root))),models=data.models;
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
assert.equal(models.length,10);assert.equal(models.reduce((n,m)=>n+m.variants.length,0),117);
const ids=new Set();for(const m of models){assert.match(m.source_url,/^https:\/\/(www\.)?(hyundai|kia|genesis)\.com\//);assert.match(m.source_sha256,/^[a-f0-9]{64}$/);for(const v of m.variants){assert(!ids.has(v.id));ids.add(v.id);for(const k of ['combined','city','highway'])assert(v[k].length===2&&v[k][0]>0&&v[k][0]<=v[k][1]);if(v.fuel!=='electric')assert(Number.isInteger(v.cc)&&v.cc>0);if(v.combined[0]!==v.combined[1])assert(v.range_note);}}
assert.equal(models.find(m=>m.id==='avante-cn7').variants.find(v=>v.fuel==='hybrid').combined[0],21.1);
assert.equal(models.find(m=>m.id==='ev3-sv').variants[0].range,350);
assert.equal(models.find(m=>m.id==='gv70-jk1').variants[0].combined[0],9.7);
assert(!models.find(m=>m.id==='carnival-ka4').variants.some(v=>/하이루프/.test(v.label)));
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
 for(const width of [375,390,430,1280]){
  const page=await newQaPage(browser,{viewport:{width,height:900}});
  for(const m of models){await page.goto(base+'/'+m.path,{waitUntil:'networkidle'});assert.equal(await page.locator('#specs tbody tr').count(),m.variants.length);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width} ${m.id}`);assert.equal(await page.locator('h1').count(),1);assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);assert(await page.locator(`a[href="${m.source_url}"]`).count());for(const a of await page.locator('header nav a').all())assert(await a.isVisible());}
  if(width===390){fs.mkdirSync('output/playwright',{recursive:true});await page.screenshot({path:'output/playwright/popular-model-mobile.png',fullPage:true});}
  await page.close();
 }
 const page=await newQaPage(browser);
 await page.goto(base+'/cars/hyundai/avante-cn7/');await page.locator('#pm-distance').fill('10000');await page.locator('#pm-price').fill('1800');assert.equal(await page.locator('#pm-energy').textContent(),'1,200,000원');assert.equal(await page.locator('#pm-total').textContent(),'1,490,836원');
 const lpg=models.find(m=>m.id==='avante-cn7').variants.find(v=>v.fuel==='lpg');await page.locator('#pm-variant').selectOption(lpg.id);assert.equal(Number(await page.locator('#pm-price').inputValue()),JSON.parse(fs.readFileSync(new URL('data/fuel-price.json',root))).prices.lpg);
 await page.locator('#pm-distance').fill('-1');assert.match(await page.locator('#pm-energy').textContent(),/확인/);await page.locator('#pm-distance').fill('');assert.match(await page.locator('#pm-energy').textContent(),/확인/);
 await page.goto(base+'/cars/genesis/gv70-jk1/');await page.locator('#pm-distance').fill('10000');await page.locator('#pm-price').fill('1800');assert.equal(await page.locator('#pm-energy').textContent(),'1,836,735원–1,855,670원');
 await page.goto(base+'/cars/kia/ev3-sv/');assert.equal(await page.locator('#pm-price').inputValue(),'');await page.locator('#pm-price').fill('300');await page.locator('#pm-distance').fill('10000');assert.equal(await page.locator('#pm-energy').textContent(),'576,923원');assert.equal(await page.locator('#pm-total').textContent(),'706,923원');await page.locator('#pm-price').fill('0');assert.match(await page.locator('#pm-energy').textContent(),/확인/);
 await page.locator('main img').dispatchEvent('error');assert(await page.getByText('사진을 불러오지 못했습니다',{exact:true}).isVisible());
 const staticPage=await newQaPage(browser,{javaScriptEnabled:false});
 for(const m of models){await staticPage.goto(base+'/'+m.path);assert.equal(await staticPage.locator('#specs tbody tr').count(),m.variants.length);assert.equal(await staticPage.locator('[data-km]').count(),3);}
 for(const p of ['/','/cars/','/cars/models/']){await staticPage.goto(base+p);assert.equal(await staticPage.locator('.pm-model-link').count(),10);}
 console.log('PASS popular models: 10 sources / 117 specifications, static HTML, 4 widths, exact/range costs, LPG switching, EV input guard, photo fallback.');
}finally{await browser.close()}
await import('./model-editorial-qa.mjs');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import {normalizeFuelSnapshot} from './fuel-price-state.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const fuel=normalizeFuelSnapshot(read('data/fuel-price.json'),read('data/generated/opinet-status.json')),price=fuel.prices.gasoline;
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const fmt=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const slugs=fs.readdirSync(new URL('compare/',root)).filter(s=>fs.existsSync(new URL('compare/'+s+'/index.html',root))&&fs.readFileSync(new URL('compare/'+s+'/index.html',root),'utf8').includes('data-analysis-pair'));
assert.equal(slugs.length,10);
fs.mkdirSync('output/review/launch-audit',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await newQaPage(browser,{javaScriptEnabled:false,viewport:{width:390,height:1000}});
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:1000});
  for(const slug of slugs){await page.goto(base+'/compare/'+slug+'/');assert.equal(await page.locator('[data-analysis-pair]').count(),1);assert.equal(await page.locator('[data-analysis-km]').count(),3);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.match(await page.locator('.analysis-basis').innerText(),/고정한 예시/)}
  await page.goto(base+'/compare/grandeur-gasoline-vs-hybrid/');
  const t=await page.locator('[data-analysis-km="20000"] td').allTextContents();
  const energy=20000*(1/11.7-1/18)*price,tax=2497*200*1.3-1598*140*1.3;
  assert.deepEqual(t,[fmt(energy),fmt(tax),fmt(energy+tax)]);
  await page.locator('[data-analysis-pair]').scrollIntoViewIfNeeded();await page.screenshot({path:`output/review/launch-audit/cost-analysis-${width}.png`});
  await page.goto(base+'/guide/grandeur-wheel-fuel-cost/');
  assert.equal(await page.locator('[data-wheel-variant]').count(),6);
  assert.equal(await page.locator('[data-wheel-variant="gn7-g25-2wd-20"] td').last().innerText(),fmt(20000/11.2*price));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.match(await page.locator('body').innerText(),/영향이라고 단정할 수 없습니다/);
  await page.screenshot({path:`output/review/launch-audit/wheel-guide-${width}.png`});
  await page.goto(base+'/guide/hybrid-distance-savings/');assert.equal(await page.locator('[data-hybrid-analysis]').count(),7);
  assert.deepEqual(await page.locator('[data-hybrid-analysis="grandeur-gasoline-vs-hybrid"] td').allTextContents(),[10000,20000,30000].map(k=>fmt(k*(1/11.7-1/18)*price)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  const schemas=await page.locator('script[type="application/ld+json"]').allTextContents();assert.ok(schemas.some(s=>JSON.parse(s)['@graph']?.some(x=>x['@type']==='Article')));
 }
 const live=await newQaPage(browser);await live.goto(base+'/compare/tucson-gasoline-vs-hybrid/');const example=await live.locator('[data-analysis-pair]').innerText();await live.locator('#decision-km').fill('10000');await live.locator('#decision-price').fill('2000');assert.equal(await live.locator('[data-analysis-pair]').innerText(),example);assert.match(await live.locator('.analysis-basis').innerText(),/계산기 입력값과는 별도로/);
 console.log('PASS ten cost explanations, independent tax/energy arithmetic, six wheel variants, seven hybrid pairs, static data, mobile layout and fixed example labels.');
}finally{await browser.close()}

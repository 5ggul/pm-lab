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
const decisionSlugs=read('data/decision-comparisons.json').pairs.map(pair=>pair.slug);
const pilotSource=fs.readFileSync(new URL('scripts/build-reviewed-pilot.mjs',root),'utf8');
const pilotSlugs=[...pilotSource.matchAll(/\{slug:'([^']+)'/g)].map(match=>match[1]);
const expectedSlugs=[...new Set([...decisionSlugs,...pilotSlugs])].sort();
assert.deepEqual([...slugs].sort(),expectedSlugs,'Every configured comparison must include a cost analysis.');
fs.mkdirSync('output/review/launch-audit',{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
 const page=await newQaPage(browser,{javaScriptEnabled:false,viewport:{width:390,height:1000}});
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:1000});
  for(const slug of slugs){await page.goto(base+'/compare/'+slug+'/');assert.equal(await page.locator('[data-analysis-pair]').count(),1);assert.equal(await page.locator('[data-distance-km]').count(),3);assert.equal(await page.locator('#decision-scenarios tr').count(),3);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.metric-waterfall').count(),0)}
  await page.goto(base+'/compare/grandeur-gasoline-vs-hybrid/');
  const t=await page.locator('#decision-scenarios tr').nth(1).locator('td').allTextContents();
  const energy=20000*(1/11.7-1/18)*price,tax=2497*200*1.3-1598*140*1.3;
  assert.equal(Number(t[0].replace(/\D/g,''))-Number(t[1].replace(/\D/g,'')),Number(t[2].replace(/[^\d-]/g,'')));
  await page.locator('[data-analysis-pair]').scrollIntoViewIfNeeded();await page.screenshot({path:`output/review/launch-audit/cost-analysis-${width}.png`});
  await page.goto(base+'/guide/grandeur-wheel-fuel-cost/');
  assert.equal(await page.locator('[data-wheel-variant]').count(),6);
  assert.equal(await page.locator('[data-wheel-variant="gn7-g25-2wd-20"] td').last().innerText(),fmt(20000/11.2*price));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.match(await page.locator('body').innerText(),/영향이라고 단정할 수 없습니다/);
  await page.screenshot({path:`output/review/launch-audit/wheel-guide-${width}.png`});
  await page.goto(base+'/guide/hybrid-distance-savings/');assert.equal(await page.locator('[data-hybrid-analysis]').count(),9);
  assert.deepEqual(await page.locator('[data-hybrid-analysis="grandeur-gasoline-vs-hybrid"] td').allTextContents(),[10000,20000,30000].map(k=>fmt(k*(1/11.7-1/18)*price)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  const schemas=await page.locator('script[type="application/ld+json"]').allTextContents();assert.ok(schemas.some(s=>JSON.parse(s)['@graph']?.some(x=>x['@type']==='Article')));
 }
 const live=await newQaPage(browser);await live.goto(base+'/compare/tucson-gasoline-vs-hybrid/');const before=await live.locator('#decision-a').innerText();await live.locator('#decision-km').fill('10000');await live.locator('#decision-price').fill('2000');assert.notEqual(await live.locator('#decision-a').innerText(),before);assert.equal(await live.locator('[data-distance-value]').count(),6);
 console.log(`PASS ${slugs.length} comparison summaries, responsive distance charts, six wheel variants, nine hybrid pairs and live calculator updates.`);
}finally{await browser.close()}

import {chromium} from 'playwright';
import fs from 'node:fs';
import {newQaPage} from './qa-photo-fixture.mjs';
fs.mkdirSync('output/review/launch-audit',{recursive:true});
import assert from 'node:assert/strict';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const siteRoot=new URL('../',import.meta.url);
function publicHtml(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=new URL(entry.name+(entry.isDirectory()?'/':''),dir);return entry.isDirectory()&&!['assets','data','scripts'].includes(entry.name)?publicHtml(file):entry.name.endsWith('.html')?[file]:[]})}
for(const file of publicHtml(siteRoot))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/갈립니다|두 차이를 봅니다|가운데 막대는 비용이|1년 유지비/);
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{for(const width of [390,1280]){
 const page=await newQaPage(browser,{viewport:{width,height:1000}});
 for(const route of ['/','/cars/','/rankings/fuel-economy/','/recalls/']){
  await page.goto(base+route,{waitUntil:'networkidle'});
  assert.equal(await page.locator('a[href*="compare/dimensions"]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.doesNotMatch(await page.locator('body').innerText(),/검수상태|검수 상태|검수 세대|현행 세대 후보/);
 }
 const cards=page.locator('.decision-recall');assert.equal(await cards.count(),5);
 assert.equal(await page.locator('.recall-card-facts dt').count(),10);
 const boxes=await cards.evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,border:getComputedStyle(e).borderTopWidth})));
 for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].top-boxes[i-1].bottom>=17);
 assert.equal(boxes[0].border,'1px');
 await page.screenshot({path:`output/review/launch-audit/recall-readable-${width}.png`});
 await page.locator('#recall-q').fill('그랜저');assert.equal(await page.locator('.decision-recall:visible').count(),2);
 await page.locator('.decision-recall:visible h2 a').first().click();await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('body').getAttribute('data-decision-kind'),'recall-detail');
 assert.ok(await page.getByRole('heading',{name:'수리 방법',exact:true}).isVisible());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:`output/review/launch-audit/recall-detail-readable-${width}.png`});
 await page.goto(base+'/rankings/fuel-economy/',{waitUntil:'networkidle'});
 await page.locator('.rank-row').first().getByRole('link',{name:'이 사양 보기 →'}).click();await page.waitForSelector('.record-table, .dossier-table');
 assert.doesNotMatch(await page.locator('body').innerText(),/검수|현행 세대 후보|정규화/);
 assert.ok(await page.locator('.record-table th, .dossier-table th').count()>=8);
 await page.goto(base+'/compare/dimensions/');await page.waitForURL(base+'/compare/');
 console.log(`PASS ${width}: no size tool, clean efficiency labels, separated recalls, search, detail and retired URL`);
 await page.close();
}}finally{await browser.close()}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
const forbidden=/reviewed_override|raw_only|auto_high|auto_medium|confirmed_mapping|세대 미분류/;
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const initialMode of ['all','reviewed']) {
  let release;const pending=new Promise(resolve=>{release=resolve});
  await page.route('**/all-car-calc-bootstrap.json',async route=>{await pending;await route.continue()});
  await page.goto(base+'/tools/annual-cost/?mode='+initialMode);
  const panel=page.locator('.tool-panel').first();
  assert.equal(await panel.getAttribute('aria-busy'),'true');
  await page.locator('#generation').evaluate(e=>e.focus());
  assert.notEqual(await page.evaluate(()=>document.activeElement.id),'generation','loading controls must not capture focus');
  release();await page.waitForFunction(()=>document.documentElement.dataset.costMode);
  assert.equal(await panel.evaluate(e=>e.inert),false);
  assert.equal(await panel.getAttribute('aria-busy'),null);
  const target=initialMode==='all'?'#familySearch':'#car';
  await page.locator(target).focus();
  assert.equal(await page.evaluate(()=>document.activeElement.id),target.slice(1));
  await page.unroute('**/all-car-calc-bootstrap.json');
 }
 for(const mode of ['all','reviewed']) {
  await page.goto(base+`/tools/annual-cost/?mode=${mode}&calc=kea-display-3b682046fa635c7849&car=grandeur-gn7&variant=gn7-g25-2wd-18&reg=2021-07`);
  await page.waitForFunction(()=>document.querySelector('#tax')?.textContent==='535,607원');
  assert.equal(await page.locator('#discount').textContent(),'17.5%');
  for(const [month,rate,amount] of [['2021-01','20%','519,376원'],['2021-07','17.5%','535,607원'],['2023-07','7.5%','600,529원'],['2026-01','없음','649,220원']]) {
   await page.locator('#reg').fill(month);await page.locator('#reg').dispatchEvent('change');
   assert.equal(await page.locator('#discount').textContent(),rate);
   assert.equal(await page.locator('#tax').textContent(),amount);
  }
 }
 await page.goto(base+'/tools/car-tax/');
 await page.locator('#cc').fill('2497');await page.locator('#registration').fill('2021-07');await page.locator('#registration').dispatchEvent('input');
 assert.match(await page.locator('#costBreakdown').textContent(),/17\.5%/);
 assert.equal(await page.locator('#costResult').textContent(),'535,607원');
 await page.goto(base+'/cars/hyundai/grandeur-gn7/');
 await page.locator('#regDate').fill('2023-07');await page.locator('#regDate').dispatchEvent('change');
 assert.equal(await page.locator('#taxDiscount').textContent(),'7.5%');
 assert.match(await page.locator('.cost-basis').textContent(),/차령 경감을 반영/);
 assert.doesNotMatch(await page.locator('.cost-basis').textContent(),/차령 경감.*반영하지/);
 for(const query of ['쏘렌토','넥쏘','BMW','없는차량xyz']) {
  await page.goto(base+'/search/?q='+encodeURIComponent(query));
  await page.waitForFunction(()=>!document.body.innerText.includes('불러오는 중'));
  await page.waitForTimeout(150);
  assert.doesNotMatch(await page.locator('body').innerText(),forbidden);
  assert.doesNotMatch(await page.locator('body').innerText(),/정규화/);
  if(await page.locator('.search-row').count())assert.equal(await page.locator('.search-row').first().evaluate(e=>getComputedStyle(e).display),'grid','search results must retain their row layout');
 }
 await page.goto(base+'/compare/?km=31000');
 await page.waitForSelector('.compare-distance-values');
 const rows=await page.locator('.compare-distance-values').allTextContents();
 assert.equal(rows.length,5);
 for(const row of rows)assert.match(row,/A [\d,]+원B [\d,]+원/,'each distance must expose exact won values');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('Public consistency QA PASS: fractional tax rates in all calculators, dynamic scope, search copy and exact distance costs');
} finally {await browser.close()}

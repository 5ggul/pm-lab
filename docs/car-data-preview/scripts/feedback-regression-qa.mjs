import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
  const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/tools/annual-cost/?fa=hyundai-tucson');
  await page.waitForFunction(()=>document.querySelector('#sourceRow')?.options.length>0);
  assert.match(await page.locator('#familySearch').inputValue(),/투싼/,'fa must select the requested family');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  await page.locator('#price').fill('');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent==='—');
  await page.locator('#price').fill('1800');
  await page.locator('#reviewedMode').click();
  assert.equal(await page.locator('[data-cost-benchmark]').isHidden(),true);
  await page.locator('#allMode').click();
  assert.equal(await page.locator('[data-cost-benchmark]').isVisible(),true);
  assert.deepEqual(errors,[],'annual cost page must not throw');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'annual cost mobile overflow');

  await page.goto(base+'/cars/hyundai/grandeur-gn7/');
  await page.locator('#wheelSelect').selectOption('20');
  await page.locator('#annualKm').selectOption('10000');
  assert.equal(await page.locator('#answerWheel').textContent(),'20인치');
  assert.match(await page.locator('#answerDistance').textContent(),/10,000km/);
  assert.match(await page.locator('#mFuelLabel').textContent(),/10,000 km/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Grandeur mobile overflow');

  await page.goto(base+'/compare/ev3-vs-ev6/');
  const payload=JSON.parse(await page.locator('#decision-data').textContent()),ev6=payload.pairs[0].right;
  assert.equal(ev6.combined,5.5);assert.equal(ev6.range,395);assert.equal(ev6.year,'2026');

  await page.goto(base+'/rankings/ev-efficiency/');
  assert.equal(await page.locator('.rank-row a[href*="/cars/"]').count(),0,'historical ranking rows must not link to current detail pages');
  const casper=page.locator('.rank-row[data-family-id="hyundai-casper"]');
  if(await casper.count()){assert.equal(await casper.locator('.rank-photo-empty').count(),1);assert.equal(await casper.locator('img').count(),0)}
  assert.deepEqual(errors,[]);
  console.log('PASS annual-cost initialization, fa handoff, benchmark reset, reviewed toggle, dynamic Grandeur labels, EV6 comparison scope and ranking photo/link safeguards.');
}finally{await browser.close()}

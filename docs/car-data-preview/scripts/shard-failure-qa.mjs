import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try {
  for(const [route,input,result] of [['tools/annual-cost/','#familySearch','#total'],['compare/','#familyA','#compareTable']]) {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/'+route+'?mode=all');
    await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('원'),result);
    const before=await page.locator(result).textContent();
    let reject=true;
    await page.route('**/all-car-calc-shards/**',r=>reject?r.fulfill({status:503,body:'Temporary outage'}):r.continue());
    await page.locator(input).fill('현대 넥쏘');
    await page.waitForFunction(()=>document.querySelector('main').textContent.includes('차량을 다시 선택하세요.'));
    assert.notEqual(await page.locator(result).textContent(),before,'old vehicle costs must disappear on loading failure');
    reject=false;
    await page.locator(input).fill('');await page.locator(input).fill('현대 넥쏘');
    await page.waitForFunction(()=>document.querySelector('main').textContent.includes('130,000원'));
    assert.deepEqual(errors,[],'shard failure must not escape as an unhandled rejection');
    await page.close();
  }
  console.log('Shard failure QA PASS: stale costs cleared and same-family retry recovers in comparison and calculator');
} finally {await browser.close()}

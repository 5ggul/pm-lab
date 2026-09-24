import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/tools/annual-cost/?mode=all&calc=kea-display-3b682046fa635c7849&reg=2021-03&km=20000');
 await page.waitForFunction(()=>document.querySelector('#tax')?.textContent==='519,376원');
 assert.equal(await page.locator('#reg').inputValue(),'2021-03');
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#tax')?.textContent==='519,376원');
 await page.locator('#reviewedMode').click();
 assert.equal(await page.locator('#reg').inputValue(),'2021-03');
 await page.locator('#allMode').click();
 assert.equal(await page.locator('#tax').textContent(),'519,376원');
 for(const value of ['', '2027-01']) {
   await page.locator('#reg').fill(value);await page.locator('#reg').dispatchEvent('change');
   assert(!/원$/.test(await page.locator('#total').textContent()),'invalid registration must clear the previous total');
   assert.match(await page.locator('#calcWarning').textContent(),/참고월/);
 }
 await page.locator('#reg').fill('2021-03');await page.locator('#reg').dispatchEvent('change');
 assert.equal(await page.locator('#tax').textContent(),'519,376원');
 await page.goto(base+'/cars/hyundai/grandeur-gn7/');
 await page.locator('#regDate').fill('2018-01');await page.locator('#regDate').dispatchEvent('change');
 assert.equal(await page.locator('#regDate').inputValue(),'2018-01','do not silently replace registration');
 assert.equal(await page.locator('#taxTotal').textContent(),'입력 확인');
 assert.match(await page.locator('#registrationError').textContent(),/2022년 11월/);
 await page.locator('#regDate').fill('2023-01');await page.locator('#regDate').dispatchEvent('change');
 assert.equal(await page.locator('#registrationError').count(),0);
 assert.match(await page.locator('#taxTotal').textContent(),/원$/);
 await page.goto(base+'/compare/?km=31000');
 await page.waitForSelector('.compare-distance svg');
 const positions=await page.locator('.compare-distance svg circle.side-0').evaluateAll(es=>es.map(e=>Number(e.getAttribute('cx'))));
 assert(Math.abs((positions[3]-positions[2])/(positions[4]-positions[3])-1/19)<1e-9,'distance axis must use km proportions');
 const labels=await page.locator('.compare-distance svg text[y="194"]').evaluateAll(es=>es.map(e=>Number(e.getAttribute('x'))));
 for(let i=1;i<labels.length;i++)assert(labels[i]-labels[i-1]>=48,'nearby distance labels must not overlap');
 for(const width of [360,375,390,430]) {
   await page.setViewportSize({width,height:844});await page.goto(base+'/');
   assert.match(await page.locator('.home-car').first().innerText(),/약 65만/);
   await page.locator('.home-car h3').first().evaluate(e=>e.textContent='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(3));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'long names must wrap');
 }
 assert.deepEqual(errors,[]);
 console.log('review state QA passed: registration restore, validation, mode switch, detail boundary, distance scale and long names');
} finally {await browser.close()}

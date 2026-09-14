import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const root=fileURLToPath(new URL('../',import.meta.url));
JSON.parse(fs.readFileSync(path.join(root,'data/decision-comparisons.json'),'utf8'));
const k5Html=fs.readFileSync(path.join(root,'cars/kia/k5-dl3/index.html'),'utf8');
assert.match(k5Html,/빌트인캠 미장착[^>]*>1\.6T 휘발유 · 17인치 · 캠 없음</,'K5 must preserve the no-camera condition');
const k5Widths=[...k5Html.matchAll(/dossier-track[^>]*>[\s\S]*?width:([\d.]+)%/g)].map(match=>Number(match[1]));
assert(k5Widths.length>=3&&new Set(k5Widths).size>1,'same-unit efficiency meters must show different values with different widths');
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
  const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/tools/annual-cost/?fa=hyundai-tucson');
  await page.waitForFunction(()=>document.querySelector('#sourceRow')?.options.length>0);
  assert.match(await page.locator('#familySearch').inputValue(),/투싼/,'fa must select the requested family');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  const validFamily=await page.locator('#familySearch').inputValue();
  await page.locator('#price').fill('');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent==='—');
  await page.locator('#price').fill('1800');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  await page.locator('#km').fill('500');
  await page.waitForFunction(()=>document.querySelector('#total')?.textContent==='—'&&document.querySelector('[data-benchmark-current]')?.textContent==='—');
  await page.locator('#km').fill('20000');
  await page.waitForFunction(()=>document.querySelector('#total')?.textContent!=='—'&&document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  await page.locator('#price').fill('-1800');
  await page.waitForFunction(()=>document.querySelector('#energy')?.textContent==='가격 입력'&&document.querySelector('[data-benchmark-current]')?.textContent==='—');
  await page.locator('#price').fill('1800');
  await page.locator('#familySearch').fill('존재하지 않는 차량');
  await page.locator('#familySearch').press('Tab');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent==='—');
  await page.locator('#familySearch').fill(validFamily);
  await page.locator('#familySearch').press('Tab');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  await page.locator('#reviewedMode').click();
  assert.equal(await page.locator('[data-cost-benchmark]').isHidden(),true);
  await page.locator('#price').fill('-1800');
  await page.waitForFunction(()=>['가격 입력','충전단가 입력'].includes(document.querySelector('#energy')?.textContent));
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
  assert.match(await page.locator('#compareDistanceTitle').textContent(),/10,000 km/);
  assert.match(await page.locator('#compare').innerText(),/2WD · 18인치 사양끼리 비교합니다/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Grandeur mobile overflow');

  await page.goto(base+'/compare/ev3-vs-ev6/');
  const payload=JSON.parse(await page.locator('#decision-data').textContent()),ev6=payload.pairs[0].right;
  assert.equal(ev6.combined,5.5);assert.equal(ev6.range,395);assert.equal(ev6.year,'2026');

  await page.goto(base+'/rankings/ev-efficiency/');
  assert.equal(await page.locator('.rank-row a[href*="/cars/"]').count(),0,'historical ranking rows must not link to current detail pages');
  const casper=page.locator('.rank-row[data-family-id="hyundai-casper"]');
  if(await casper.count()){assert.equal(await casper.locator('.rank-photo-empty').count(),1);assert.equal(await casper.locator('img').count(),0)}
  assert.deepEqual(errors,[]);
  console.log('PASS JSON rebuild input, readable K5 camera state and metric scale, annual-cost state/input synchronization, dynamic Grandeur comparison labels, EV6 comparison scope and ranking photo/link safeguards.');
}finally{await browser.close()}

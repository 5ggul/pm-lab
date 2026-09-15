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
for(const [file,efficiency,tax] of [['cars/kia/sorento-mq4/index.html','10.8',649220],['cars/genesis/g80-rg3/index.html','9.8',649220],['cars/hyundai/tucson-nx4/index.html','12.5',290836]]){
  const html=fs.readFileSync(path.join(root,file),'utf8'),schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1])),vehicle=schemas.flatMap(schema=>schema['@graph']||[schema]).find(node=>node['@type']==='Vehicle'),props=Object.fromEntries((vehicle?.additionalProperty||[]).map(prop=>[prop.name,prop.value]));
  assert.equal(String(props['복합 효율']),efficiency,`${file} schema efficiency must match the visible default`);assert.equal(Number(props['연간 자동차세']),tax,`${file} schema tax must match the visible default`);
}
for(const slug of ['fuel-economy','ev-efficiency','car-tax','annual-energy-cost']){
  const html=fs.readFileSync(path.join(root,'rankings',slug,'index.html'),'utf8'),schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1])),list=schemas.flatMap(schema=>schema['@graph']||[schema]).find(node=>node['@type']==='ItemList');
  assert(list?.itemListElement?.length,`${slug} ItemList must exist`);for(const item of list.itemListElement){assert(!/[<>]/.test(item.name),`${slug} ItemList name must be plain text`);assert(!item.url||!/wikimedia|creativecommons/i.test(item.url),`${slug} ItemList url must not point to photo credits`)}
}
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
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent==='—');
  assert.equal(await page.locator('#detailLink').getAttribute('href'),'../../cars/','invalid vehicle must clear the stale detail target');
  await page.locator('#familySearch').fill(validFamily);
  await page.locator('#familySearch').press('Tab');
  await page.waitForFunction(()=>document.querySelector('[data-benchmark-current]')?.textContent!=='—');
  await page.locator('#reviewedMode').click();
  await page.locator('#car').selectOption('g80-rg3');
  const reviewedLink=await page.locator('#detailLink').getAttribute('href');
  await page.locator('#allMode').click();
  await page.locator('#reviewedMode').click();
  assert.equal(await page.locator('#detailLink').getAttribute('href'),reviewedLink,'returning to reviewed mode must restore its vehicle detail link');
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
  assert.match(await page.locator('#compare').innerText(),/위에서 선택한 휠과 별개입니다/);
  await page.locator('#fuelPrice').fill('-1000');
  await page.waitForFunction(()=>document.querySelector('#mFuel')?.textContent==='가격 입력'&&document.querySelector('#mTotal')?.textContent==='가격 입력'&&document.querySelector('#cDiff')?.textContent==='가격 입력');
  assert(!/-[\d,]+원/.test(await page.locator('main').innerText()),'Grandeur must not show negative costs');
  assert(!/가격 입력원/.test(await page.locator('main').innerText()),'invalid prices must not receive a currency suffix');
  for(const invalid of ['', '0']){await page.locator('#fuelPrice').fill(invalid);assert.equal(await page.locator('#answerFuelUnit').textContent(),'');}
  await page.locator('#fuelPrice').fill('1800');
  await page.waitForFunction(()=>/원$/.test(document.querySelector('#mTotal')?.textContent||'')&&document.querySelector('#mTotal')?.textContent!=='가격 입력');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Grandeur mobile overflow');
  await page.locator('a[href*="annual-cost/?car=grandeur-gn7"]').click();
  await page.waitForFunction(()=>document.querySelector('#km')?.value==='10000'&&document.querySelector('#price')?.value==='1800');
  assert.match(await page.locator('#assumption').textContent(),/10,000km/);
  assert.equal(await page.locator('[data-cost-reset]').count(),1);
  await page.locator('[data-cost-reset]').click();
  await page.waitForFunction(()=>document.querySelector('#km')?.value==='20000');

  await page.goto(base+'/cars/kia/sorento-mq4/');
  const initialTop=await page.locator('[data-field="annual-total"]').first().textContent();
  await page.locator('#annualKm').selectOption('10000');
  await page.waitForFunction(before=>document.querySelector('[data-field="annual-total"]')?.textContent!==before,initialTop);
  assert.equal(await page.locator('[data-field="annual-total"]').first().textContent(),await page.locator('#totalValue').textContent(),'model-lite top and calculator totals must stay synchronized');
  await page.locator('#energyPrice').fill('-1000');
  await page.waitForFunction(()=>document.querySelector('[data-field="annual-total"]')?.textContent==='계산 불가');
  assert(!/-[\d,]+원/.test(await page.locator('main').innerText()),'model-lite must not show negative costs');
  for(const slug of ['kia/sorento-mq4','genesis/g80-rg3']){
    await page.goto(base+'/cars/'+slug+'/');
    for(const invalid of ['', '0', '-1000']){await page.locator('#energyPrice').fill(invalid);assert.equal(await page.locator('#totalValue').textContent(),'연료가격 입력');assert.equal(await page.locator('[data-field="annual-total"]').first().textContent(),'계산 불가');}
    await page.locator('#energyPrice').fill('1800');assert.match(await page.locator('#totalValue').textContent(),/원$/);
  }
  for(const slug of ['kia/ev6','hyundai/ioniq-5']){
    await page.goto(base+'/cars/'+slug+'/');
    const vehicle=await page.evaluate(()=>Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(s=>{const j=JSON.parse(s.textContent);return j['@graph']||[j]}).find(n=>n['@type']==='Vehicle'));
    assert.equal(vehicle.fuelType,'전기');assert.equal(vehicle.additionalProperty.find(p=>p.name==='복합 효율').unitText,'km/kWh');assert.equal(Number(vehicle.additionalProperty.find(p=>p.name==='연간 자동차세').value),130000);
  }
  await page.goto(base+'/compare/k5-vs-sonata/');assert.match(await page.locator('main').innerText(),/캠 없음/);assert(!/빌트인\s*캠 미적용/.test(await page.locator('main').innerText()));
  await page.goto(base+'/cars/kia/k5-dl3/');
  const k5Schema=await page.evaluate(()=>Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(s=>{const j=JSON.parse(s.textContent);return j['@graph']||[j]}).find(n=>n['@type']==='Vehicle'));
  const tax=k5Schema.additionalProperty.find(p=>p.name==='연간 자동차세').value,eff=k5Schema.additionalProperty.find(p=>p.name==='복합 효율').value;
  assert(await page.locator('.dossier-table tbody tr').evaluateAll((rows,values)=>rows.some(row=>row.textContent.includes(Number(values.tax).toLocaleString('ko-KR')+'원')&&row.textContent.includes(values.eff+' km/L')),{tax,eff}),'K5 schema values must appear together in one visible row');
  await page.goto(base+'/compare/ev3-vs-ev6/?km=15000&cprice_gasoline=1800');
  assert.equal(await page.locator('#decision-km').inputValue(),'15000');assert.equal(await page.locator('#decision-price').inputValue(),await page.locator('#decision-price').getAttribute('value'),'per-litre prices must never replace the EV charging preset');

  await page.goto(base+'/compare/');
  await page.waitForFunction(()=>document.querySelector('#compareTable')?.textContent?.includes('세금 + 선택 주행거리 에너지비'));
  await page.locator('#gas').fill('-1000');
  await page.waitForFunction(()=>document.querySelector('#compareTable')?.textContent?.includes('계산 제외'));
  assert(!/-[\d,]+원/.test(await page.locator('main').innerText()),'comparison hub must not show negative costs');
  await page.locator('#gas').fill('1800');
  await page.waitForFunction(()=>!document.querySelector('#compareTable')?.textContent?.includes('-1,')&&/원/.test(document.querySelector('#compareAnswer')?.textContent||''));

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

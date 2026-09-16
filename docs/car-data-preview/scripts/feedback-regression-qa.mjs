import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import '../assets/spec-label.js';
for(const token of ['X','무','없음','미장착','미적용','비장착','제외','Off'])assert.equal(globalThis.CAR_SPEC_LABELS.cameraLabel('싼타페 2WD 빌트인캠'+token),'캠 없음',token+' must be a camera-negative token');
assert.equal(globalThis.CAR_SPEC_LABELS.cameraLabel('빌트인캠 적용'),'빌트인 캠');assert.equal(globalThis.CAR_SPEC_LABELS.cameraLabel('2WD 18인치'),'');

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const root=fileURLToPath(new URL('../',import.meta.url));
JSON.parse(fs.readFileSync(path.join(root,'data/decision-comparisons.json'),'utf8'));
const fuelSnapshot=JSON.parse(fs.readFileSync(path.join(root,'data/fuel-price.json'),'utf8'));
const grandeurHtml=fs.readFileSync(path.join(root,'cars/hyundai/grandeur-gn7/index.html'),'utf8');
assert.deepEqual([...grandeurHtml.matchAll(/오피넷 (\d{4}\.\d{2}\.\d{2}) 유가/g)].map(match=>match[1]),[fuelSnapshot.price_as_of.replaceAll('-','.')],'Grandeur must show one current fuel-price date');
assert.match(fs.readFileSync(path.join(root,'assets/page-design.css'),'utf8'),/\.cost-ranking\[data-reference-page=ranking\] \.page-hero h1\{[^}]*color:#f7f4ec/,'dark ranking hero needs an explicit light H1');
const allCarCatalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-catalog.json'),'utf8')),nexoGroup=allCarCatalog.groups.find(group=>group.records.some(row=>row.family_id==='hyundai-nexo'));
assert(nexoGroup?.records.length,'Nexo raw records must exist');assert(nexoGroup.records.every(row=>row.efficiency_unit==='km/kg'),'Nexo raw records must keep km/kg');
assert.match(fs.readFileSync(path.join(root,'cars/record/index.html'),'utf8'),/eff\(r\.combined_efficiency,r\.efficiency_unit\)/,'raw records must render an efficiency unit in every efficiency cell');
const hyundaiHub=fs.readFileSync(path.join(root,'cars/hyundai/index.html'),'utf8');assert.match(hyundaiHub,/href="\.\.\/family\/\?id=hyundai-nexo"[^>]*>신고 사양 7개/,'Nexo must be reachable from the Hyundai hub');
const familyHtml=fs.readFileSync(path.join(root,'cars/family/index.html'),'utf8');assert.doesNotMatch(familyHtml,/아직 이 없는 상태/);assert.match(familyHtml,/아직 세대를 확정하지 못한 상태/);
const annualHtml=fs.readFileSync(path.join(root,'tools/annual-cost/index.html'),'utf8');assert.doesNotMatch(annualHtml,/family_id===requested&&f\.full_ready_count>0/);assert.match(annualHtml,/수소 단가 자동 계산 제외/);
const ioniq6Html=fs.readFileSync(path.join(root,'cars/hyundai/ioniq-6-ce1/index.html'),'utf8');assert.match(ioniq6Html,/전기 · 기본형 · 2WD · 18인치/);assert.match(ioniq6Html,/전기 · 항속형 · 2WD · 20인치/);
assert.match(fs.readFileSync(path.join(root,'assets/catalog-consumer.js'),'utf8'),/state\.q=params\.get\('q'\)\|\|''/,'catalog must consume the homepage q parameter');
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
  await page.goto(base+'/compare/?mode=reviewed&a=grandeur-gn7&b=k8-gl3&km=10000&cprice_gasoline=1800');
  await page.waitForFunction(()=>document.querySelector('#gas')?.value==='1800');
  await page.locator('#carB').selectOption('sorento-mq4');
  await page.locator('[data-cost-reset]').click();
  await page.waitForFunction(()=>document.querySelector('#gas')?.value!=='1800'&&document.querySelector('#km')?.value==='20000');
  assert.equal(await page.locator('#carA').inputValue(),'grandeur-gn7');assert.equal(await page.locator('#carB').inputValue(),'sorento-mq4','reset must preserve the latest comparison selection');
  assert(!new URL(page.url()).searchParams.has('cprice_gasoline'));
  await page.goto(base+'/rankings/annual-energy-cost/');
  for(const key of ['gasoline','diesel','lpg'])assert((await page.locator('main').innerText()).includes(Number(fuelSnapshot.prices[key]).toLocaleString('ko-KR',{minimumFractionDigits:2})+'원/L'));
  const calcRows=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-calc-index.json'),'utf8')).rows;
  const nexoCalcRows=calcRows.filter(row=>row.family_id==='hyundai-nexo');
  assert(nexoCalcRows.length&&nexoCalcRows.every(row=>row.powertrain==='hydrogen'),'all Nexo rows must share the reviewed hydrogen classification');
  for(const row of await page.locator('.rank-row').evaluateAll(rows=>rows.map(r=>({id:r.dataset.calcId,text:r.textContent})))){const source=calcRows.find(r=>r.calc_id===row.id);if(source&&globalThis.CAR_SPEC_LABELS.cameraLabel(source.raw_model)==='캠 없음')assert(row.text.includes('캠 없음'),'negative camera ranking must not be positive');}
  for(const slug of ['hyundai/casper-ax1','hyundai/staria-us4']){await page.goto(base+'/cars/'+slug+'/');const label=await page.locator('[data-representative-label]').textContent();const configuration=await page.evaluate(()=>Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(s=>{const j=JSON.parse(s.textContent);return j['@graph']||[j]}).find(n=>n['@type']==='Vehicle').vehicleConfiguration);assert(label.includes(configuration));}

  await page.goto(base+'/compare/ev3-vs-ev6/');
  const payload=JSON.parse(await page.locator('#decision-data').textContent()),ev6=payload.pairs[0].right;
  assert.equal(ev6.combined,5.5);assert.equal(ev6.range,395);assert.equal(ev6.year,'2026');

  await page.goto(base+'/rankings/ev-efficiency/');
  const staticScopes=new Map(JSON.parse(fs.readFileSync(path.join(root,'data/static-model-pages.json'),'utf8')).records.map(row=>[row.family_id,row]));
  for(const linked of await page.locator('.rank-row').evaluateAll(rows=>rows.flatMap(row=>{const link=row.querySelector('a[href*="/cars/"]');return link?[{family:row.dataset.familyId,calc:row.dataset.calcId,href:link.getAttribute('href')}]:[]}))){
    const scope=staticScopes.get(linked.family),source=calcRows.find(row=>row.calc_id===linked.calc);
    assert(scope?.generation_labels?.includes(source?.generation_label),'historical ranking rows must not link to a different generation');
    assert.equal(linked.href,'../../'+scope.path,'ranking detail link must match the verified static model scope');
  }
  const casper=page.locator('.rank-row[data-family-id="hyundai-casper"]');
  if(await casper.count()){assert.equal(await casper.locator('.rank-photo-empty').count(),1);assert.equal(await casper.locator('img').count(),0)}
  await page.goto(base+'/tools/annual-cost/?fa=hyundai-nexo');await page.waitForFunction(()=>document.querySelector('#sourceRow')?.options.length>0);
  assert.match(await page.locator('#familySearch').inputValue(),/넥쏘/);assert.equal(await page.locator('#priceLabelText').textContent(),'수소 단가 자동 계산 제외');assert.equal(await page.locator('#price').isDisabled(),true);assert.match(await page.locator('#sourceRow option').first().textContent(),/km\/kg/);assert.match(await page.locator('#detailLink').getAttribute('href'),/family\/\?id=hyundai-nexo/);
  await page.goto(base+'/cars/?q=넥쏘');await page.waitForFunction(()=>document.querySelectorAll('.vehicle-card').length>0);assert.equal(await page.locator('.vehicle-card').count(),1);assert.match(await page.locator('.vehicle-card').innerText(),/넥쏘/);assert.match(await page.locator('.vehicle-card-actions').innerText(),/신고 사양[\s\S]*계산 조건 확인/);
  await page.goto(base+'/cars/record/?id='+encodeURIComponent(nexoGroup.catalog_id));await page.waitForFunction(()=>document.querySelector('.record-table tbody tr'));assert.match(await page.locator('.record-table tbody').innerText(),/km\/kg/);
  await page.goto(base+'/rankings/annual-energy-cost/');assert.equal(await page.locator('.page-hero h1').evaluate(el=>getComputedStyle(el).color),'rgb(247, 244, 236)');
  assert.deepEqual(errors,[]);
  console.log('PASS JSON rebuild input, readable K5 camera state and metric scale, annual-cost state/input synchronization, dynamic Grandeur comparison labels, EV6 comparison scope and ranking photo/link safeguards.');
}finally{await browser.close()}

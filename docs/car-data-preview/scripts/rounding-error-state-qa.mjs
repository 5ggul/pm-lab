import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import '../assets/cost-math.js';
const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const data=JSON.parse(fs.readFileSync(new URL('../data/generated/all-car-calc-index.json',import.meta.url)));
const math=globalThis.CAR_COST_MATH;
let checked=0;
for(const cc of new Set(data.rows.filter(r=>r.tax_ready&&Number(r.displacement_cc)>0).map(r=>Number(r.displacement_cc)))) {
 for(const month of ['2015-07','2021-01','2021-07','2022-11','2023-07','2026-01']) {
  const raw=math.annualTax(cc,false,month,2026),shown=math.roundedTax(raw);
  assert.equal(shown.total,Math.round(raw.auto)+Math.round(raw.education));
  assert.equal(shown.discount,raw.discount);checked++;
 }
}
assert.equal(math.roundedTax(math.annualTax(1591,false,'2015-07',2026)).total,152021);
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
const money=s=>Number(s.replace(/[^\d-]/g,''));
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/cars/hyundai/grandeur-gn7/');
 await page.locator('#regDate').fill('2022-11');await page.locator('#regDate').dispatchEvent('change');
 await page.locator('#annualKm').selectOption('10000');
 await page.locator('#fuelPrice').fill('1856.05');await page.locator('#fuelPrice').dispatchEvent('input');
 const values=await page.locator('#mTax,#mFuel,#totalCost').allTextContents();
 assert.equal(money(values[0])+money(values[1]),money(values[2]));
 assert.equal(money(values[2]),2154436);
 for(const prefix of ['cGas','cHev']) {
  const tax=money(await page.locator('#'+prefix+'Tax').textContent()),fuel=money(await page.locator('#'+prefix+'Fuel').textContent());
  assert.equal(tax+fuel,money(await page.locator('#'+prefix+'Total').textContent()));
 }
 await page.goto(base+'/tools/car-tax/');
 await page.locator('#cc').fill('1591');await page.locator('#registration').fill('2015-07');await page.locator('#registration').dispatchEvent('input');
 assert.equal(money(await page.locator('#costResult').textContent()),152021);
 const row=data.rows.find(r=>r.tax_ready&&r.powertrain==='gasoline'&&Number(r.displacement_cc)===1591);
 assert(row,'tax rounding fixture must exist');
 await page.goto(base+`/tools/annual-cost/?mode=all&fa=${row.family_id}&calc=${row.calc_id}&reg=2015-07`);
 await page.waitForFunction(()=>document.querySelector('#reg').value==='2015-07'&&document.documentElement.dataset.costMode==='all');
 assert.equal(money(await page.locator('#autoTax').textContent())+money(await page.locator('#eduTax').textContent()),money(await page.locator('#tax').textContent()));
 assert.equal(money(await page.locator('#tax').textContent()),152021);
 for(const unit of ['km/kWh','km/L']) {
  const phev=data.rows.find(r=>r.powertrain==='phev'&&r.efficiency_unit===unit);
  assert(phev);
  await page.goto(base+`/tools/annual-cost/?mode=all&fa=${phev.family_id}&calc=${phev.calc_id}`);
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='all');
  assert.equal(await page.locator('#priceLabelText').textContent(),'연료·충전비 자동 계산 제외');
  assert(await page.locator('#price').isDisabled());
 }
 await page.route('**/all-car-calc-shards/*.json',r=>r.abort());
 await page.goto(base+'/tools/annual-cost/?mode=all');
 await page.waitForFunction(()=>document.documentElement.dataset.costMode==='all');
 assert.match(await page.locator('#calcWarning').textContent(),/불러오지 못했습니다.*다시 선택/);
 assert.equal(await page.locator('#total').textContent(),'—');
 await page.locator('#reviewedMode').click();await page.locator('#allMode').click();
 assert.match(await page.locator('#calcWarning').textContent(),/불러오지 못했습니다/);
 await page.unroute('**/all-car-calc-shards/*.json');
 await page.locator('#familySearch').dispatchEvent('change');
 await page.waitForFunction(()=>/원$/.test(document.querySelector('#total').textContent));
 assert.doesNotMatch(await page.locator('#calcWarning').textContent(),/불러오지 못했습니다/);
 assert.deepEqual(errors,[]);
 console.log(`PASS ${checked} tax component sums; GN7 totals, standalone/all-mode tax, PHEV units and initial shard error/retry`);
} finally {await browser.close()}

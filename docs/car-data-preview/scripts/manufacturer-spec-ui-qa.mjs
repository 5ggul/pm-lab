import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const errors=[];
const pass=m=>console.log('PASS',m);
const fail=m=>{errors.push(m);console.error('FAIL',m)};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:900}});

async function familyText(id){
  await page.goto(`${base}/cars/family/?id=${encodeURIComponent(id)}`,{waitUntil:'networkidle'});
  const text=await page.locator('.spec-panel').textContent();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  overflow>1?fail(`390px ${id} horizontal overflow ${overflow}px`):pass(`390px ${id} no horizontal overflow`);
  return text||'';
}

const status=await fetch(`${base}/data/generated/manufacturer-specs-status.json`).then(r=>r.json());
status.records===16?pass('manufacturer UI QA uses current 16-family snapshot'):fail(`manufacturer UI QA snapshot count ${status.records}`);
status.coverage?.dimensions===16&&status.coverage?.power===16&&status.coverage?.torque===16
  ?pass('manufacturer UI QA snapshot has 16 dimension/power/torque families')
  :fail(`manufacturer UI QA coverage ${JSON.stringify(status.coverage)}`);
status.source_states?.probe_skipped_for_local_qa===16
  ?pass('manufacturer UI QA is deterministic and skips only live probes')
  :fail(`manufacturer UI QA probe mode ${JSON.stringify(status.source_states)}`);

let text=await familyText('kia-ev3');
/58\.3 kWh/.test(text)?pass('EV3 standard 58.3 kWh battery visible'):fail(`EV3 58.3 kWh missing: ${text}`);
/81\.4 kWh/.test(text)?pass('EV3 long-range 81.4 kWh battery visible'):fail(`EV3 81.4 kWh missing: ${text}`);
/385 Nm/.test(text)?pass('EV3 4WD 385 Nm torque visible'):fail(`EV3 385 Nm missing: ${text}`);
/4300 \(GT-Line 4310\) mm/.test(text)?pass('EV3 variant-dependent official length visible'):fail(`EV3 variant length missing: ${text}`);
let href=await page.locator('.spec-source a').getAttribute('href');
/^https:\/\/(?:www\.)?kia\.com\//.test(href||'')?pass('EV3 source points to Kia official domain'):fail(`EV3 source unexpected: ${href}`);

text=await familyText('hyundai-palisade');
/334 PS 시스템/.test(text)?pass('Palisade hybrid 334 PS system output visible'):fail(`Palisade system output missing: ${text}`);
/5060 \(캘리그래피 5065\) mm/.test(text)?pass('Palisade variant-dependent official length visible'):fail(`Palisade variant length missing: ${text}`);
href=await page.locator('.spec-source a').getAttribute('href');
/^https:\/\/(?:www\.)?hyundai\.com\//.test(href||'')?pass('Palisade source points to Hyundai official domain'):fail(`Palisade source unexpected: ${href}`);

text=await familyText('genesis-gv80');
/4,940 mm/.test(text)?pass('GV80 official 4,940 mm length visible'):fail(`GV80 length missing: ${text}`);
/2,955 mm/.test(text)?pass('GV80 official 2,955 mm wheelbase visible'):fail(`GV80 wheelbase missing: ${text}`);
/380 PS/.test(text)?pass('GV80 official 380 PS output visible'):fail(`GV80 380 PS missing: ${text}`);
href=await page.locator('.spec-source a').getAttribute('href');
/^https:\/\/(?:www\.)?genesis\.com\//.test(href||'')?pass('GV80 source points to Genesis official domain'):fail(`GV80 source unexpected: ${href}`);

await page.close();
await browser.close();
if(errors.length){
  console.error(`Manufacturer spec UI QA failed: ${errors.length}`);
  process.exit(1);
}
console.log('Manufacturer spec UI QA passed');

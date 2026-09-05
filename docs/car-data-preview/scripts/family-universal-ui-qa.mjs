import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const errors=[];
const pass=m=>console.log('PASS',m);
const fail=m=>{errors.push(m);console.error('FAIL',m)};

const status=await fetch(`${base}/data/generated/family-detail-coverage-status.json`).then(r=>r.json());
status.ok?pass('family detail coverage status ok'):fail('family detail coverage status not ok');
status.official_kea_detail_families===status.families?pass(`universal official detail coverage ${status.families}/${status.families}`):fail(`family detail coverage ${status.official_kea_detail_families}/${status.families}`);
status.missing_family_ids?.length===0?pass('no family missing universal detail data'):fail(`missing family details: ${status.missing_family_ids?.slice(0,10).join(', ')}`);

const hierarchy=await fetch(`${base}/data/generated/service-hierarchy.json`).then(r=>r.json());
const families=(hierarchy.families||[]).filter(f=>f.active_record_count>0);
const sampleCount=Math.min(12,families.length);
const sample=[];
for(let i=0;i<sampleCount;i++)sample.push(families[Math.floor(i*(families.length-1)/Math.max(1,sampleCount-1))]);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:900}});
for(const family of sample){
  await page.goto(`${base}/cars/family/?id=${encodeURIComponent(family.family_id)}`,{waitUntil:'networkidle'});
  const panel=page.locator('[data-family-universal="ready"]');
  await panel.waitFor({state:'visible',timeout:12000}).catch(()=>{});
  (await panel.count())?pass(`${family.family_id}: universal detail panel visible`):fail(`${family.family_id}: universal detail panel missing`);
  const rows=await page.locator('.official-powertrain-row:not(.head)').count();
  rows>0?pass(`${family.family_id}: ${rows} powertrain summary rows`):fail(`${family.family_id}: no powertrain summary rows`);
  const text=await panel.textContent().catch(()=>null);
  /한국에너지공단 공식 신고 제원/.test(text||'')?pass(`${family.family_id}: official source label visible`):fail(`${family.family_id}: official source label missing`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  overflow>1?fail(`${family.family_id}: 390px overflow ${overflow}px`):pass(`${family.family_id}: 390px no overflow`);
}
await page.close();
await browser.close();
if(errors.length){console.error(`Universal family UI QA failed: ${errors.length}`);process.exit(1)}
console.log('Universal family UI QA passed');

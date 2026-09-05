import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const errors=[];
const pass=m=>console.log('PASS',m);
const fail=m=>{errors.push(m);console.error('FAIL',m)};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:900}});

const hierarchy=await fetch(`${base}/data/generated/service-hierarchy.json`).then(r=>r.json());
const families=(hierarchy.families||[]).filter(f=>f.active_record_count>0);
families.length===592?pass('recall lookup covers current 592 vehicle families'):fail(`unexpected active family count ${families.length}`);
const sample=families.find(f=>String(f.family_name).toUpperCase()==='K5')||families.find(f=>/^[0-9A-Za-z가-힣 ]{2,15}$/.test(String(f.family_name)))||families[0];
if(!sample)throw new Error('No sample family');

await page.goto(`${base}/cars/family/?id=${encodeURIComponent(sample.family_id)}`,{waitUntil:'networkidle'});
await page.locator('[data-family-universal="ready"]').waitFor();
const recallHref=await page.locator('.official-recall-link').getAttribute('href');
const serviceHref=await page.locator('.official-service-link').getAttribute('href');
try{
  const u=new URL(recallHref);
  u.hostname==='www.car.go.kr'?pass('family recall link uses official car.go.kr host'):fail(`family recall host ${u.hostname}`);
  u.pathname==='/ri/stat/list.do'?pass('family recall link uses official recall list'):fail(`family recall path ${u.pathname}`);
  u.searchParams.get('ctype')==='O'?pass('family recall link selects automobile recalls'):fail('family recall ctype missing');
  u.searchParams.get('searchProductName')===sample.family_name?pass(`family recall query carries ${sample.family_name}`):fail(`family recall query ${u.searchParams.get('searchProductName')}`);
}catch{fail(`invalid family recall URL ${recallHref}`)}
try{
  const u=new URL(serviceHref);
  u.hostname==='www.car.go.kr'?pass('family free-repair link uses official car.go.kr host'):fail(`family free-repair host ${u.hostname}`);
  u.pathname==='/ri/grts/list.do'?pass('family free-repair link uses official repair list'):fail(`family free-repair path ${u.pathname}`);
  u.searchParams.get('searchWord')===sample.family_name?pass(`family free-repair query carries ${sample.family_name}`):fail(`family free-repair query ${u.searchParams.get('searchWord')}`);
}catch{fail(`invalid family free-repair URL ${serviceHref}`)}
let overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
overflow>1?fail(`390px family recall block overflow ${overflow}px`):pass('390px family recall block no overflow');

await page.goto(`${base}/recalls/?q=${encodeURIComponent(sample.family_name)}`,{waitUntil:'networkidle'});
const cards=page.locator('.recall-family-card');
(await cards.count())>0?pass(`recall page finds ${sample.family_name}`):fail(`recall page did not find ${sample.family_name}`);
const official=page.locator('.official-recall-search').first();
if(await official.count()){
  const href=await official.getAttribute('href');
  const u=new URL(href);
  u.hostname==='www.car.go.kr'&&u.searchParams.get('searchProductName')?pass('recall page provides official model search link'):fail(`recall page official URL ${href}`);
}else fail('recall page missing official model search link');
const freeRepair=page.locator('.official-service-search').first();
(await freeRepair.count())?pass('recall page provides official free-repair search link'):fail('recall page missing free-repair search link');
const inputs=await page.locator('input').evaluateAll(els=>els.map(el=>({id:el.id,name:el.getAttribute('name'),placeholder:el.getAttribute('placeholder')})));
inputs.length===1&&inputs[0].id==='q'?pass('recall page collects only vehicle-name search text'):fail(`unexpected recall inputs ${JSON.stringify(inputs)}`);
overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
overflow>1?fail(`390px recall page overflow ${overflow}px`):pass('390px recall page no overflow');

await page.close();
await browser.close();
if(errors.length){console.error(`Recall all-vehicle UI QA failed: ${errors.length}`);process.exit(1)}
console.log('Recall all-vehicle UI QA passed');

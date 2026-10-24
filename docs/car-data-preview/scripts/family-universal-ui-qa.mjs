import { newQaPage } from './qa-photo-fixture.mjs';
import { chromium } from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
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
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{headless:true});
// A partially rendered family must not expose navigation that is pushed away
// when the async detail arrives. Keep the same CLS release threshold in a
// deliberately delayed load, including any header or footer shifts.
for(const [width,height] of [[375,812],[390,844],[430,932],[768,1024],[1280,900],[1440,900]]){
  const probe=await newQaPage(browser,{viewport:{width,height},reducedMotion:'reduce'});
  let release;const gate=new Promise(resolve=>release=resolve);
  let seen;const intercepted=new Promise(resolve=>seen=resolve);
  await probe.route('**/family-page-bootstrap.json',async route=>{seen();await gate;await route.continue();});
  await probe.addInitScript(()=>{
    window.__familyLoadShifts=[];
    new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__familyLoadShifts.push({value:entry.value,sources:entry.sources.map(source=>source.node?.className||source.node?.nodeName)});}).observe({type:'layout-shift',buffered:true});
  });
  try{
    await probe.goto(`${base}/cars/family/?id=family-018d643a22b2de5c`,{waitUntil:'domcontentloaded'});
    await intercepted;await probe.waitForTimeout(80);
    const initial=await probe.evaluate(()=>{
      const visible=element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&getComputedStyle(element).visibility!=='hidden';};
      return {header:visible(document.querySelector('.db-header')),loading:document.body.classList.contains('family-page-loading'),exposed:[...document.querySelectorAll('main h1,main h2,main nav,main summary')].filter(visible).map(element=>element.textContent.slice(0,80))};
    });
    initial.header&&initial.loading&&initial.exposed.length===0?pass(`${width}px delayed family load keeps the header and reserves the complete main`):fail(`${width}px partial family content exposed: ${JSON.stringify(initial)}`);
    release();await probe.waitForSelector('[data-family-universal="ready"]');
    await probe.waitForFunction(()=>!document.body.classList.contains('family-page-loading'));
    await probe.waitForTimeout(180);
    const result=await probe.evaluate(()=>({cls:window.__familyLoadShifts.reduce((total,entry)=>total+entry.value,0),shifts:window.__familyLoadShifts,h1:document.querySelectorAll('main h1').length,overflow:document.documentElement.scrollWidth-innerWidth}));
    result.cls<0.1?pass(`${width}px delayed family CLS ${result.cls}`):fail(`${width}px delayed family CLS ${JSON.stringify(result)}`);
    result.h1===1&&result.overflow<=1?pass(`${width}px completed family remains readable and within the viewport`):fail(`${width}px completed family layout ${JSON.stringify(result)}`);
    const actions=probe.locator('.mobile-car-cta');
    if(width<=700){
      (await actions.getAttribute('aria-label'))==='차량 도구'&&(await actions.locator('a[href]').count())>=1?pass(`${width}px completed family retains labelled navigation actions`):fail(`${width}px family navigation actions missing`);
    }
  }finally{release();await probe.close();}
}
const page=await newQaPage(browser,{viewport:{width:390,height:900}});
for(const family of sample){
  await page.goto(`${base}/cars/family/?id=${encodeURIComponent(family.family_id)}`,{waitUntil:'networkidle'});
  const panel=page.locator('[data-family-universal="ready"]');
  await panel.waitFor({state:'visible',timeout:12000}).catch(()=>{});
  (await panel.count())?pass(`${family.family_id}: universal detail panel visible`):fail(`${family.family_id}: universal detail panel missing`);
  const rows=await page.locator('.official-powertrain-row:not(.head)').count();
  rows>0?pass(`${family.family_id}: ${rows} powertrain summary rows`):fail(`${family.family_id}: no powertrain summary rows`);
  const text=await panel.textContent().catch(()=>null);
  /공식 연비·전비 정보/.test(text||'')&&/한국에너지공단/.test(text||'')?pass(`${family.family_id}: consumer source label visible`):fail(`${family.family_id}: consumer source label missing`);
  /사양 수|등록 사양|세부 모델|자동차세 계산\s*\d+개|연료·충전비 계산\s*\d+개/.test(text||'')?fail(`${family.family_id}: internal count-oriented copy still visible`):pass(`${family.family_id}: count-oriented copy removed`);
  const note=await panel.locator('.official-note').textContent().catch(()=>null);
  /출처:\s*한국에너지공단/.test(note||'')?pass(`${family.family_id}: source note visible`):fail(`${family.family_id}: source note missing`);
  const summary=await page.locator('.family-stats').textContent().catch(()=>null);
  /연료·동력/.test(summary||'')&&/세금·연료·충전비/.test(summary||'')&&/제조사 제원/.test(summary||'')?pass(`${family.family_id}: consumer decision summary visible`):fail(`${family.family_id}: consumer decision summary missing`);
  /공식 사양|상세 사양|세금 계산 가능|연료·충전비 계산 가능/.test(summary||'')?fail(`${family.family_id}: database counters still visible in top summary`):pass(`${family.family_id}: database counters removed from top summary`);
  const strip=await page.locator('.calc-strip').textContent().catch(()=>null);
  (/(?:자동차세·연료·충전비|자동차세 계산 가능|연료·충전비 계산 가능|계산 항목 없음)/.test(strip||'')&&!/공식 신고 사양\s*\d+개|자동차세 산출 불가/.test(strip||''))?pass(`${family.family_id}: cost action states availability clearly`):fail(`${family.family_id}: cost action copy is unclear`);
  const cta=page.locator('.mobile-car-cta');
  const ctaVisible=await cta.isVisible().catch(()=>false);
  ctaVisible?pass(`${family.family_id}: mobile action bar visible`):fail(`${family.family_id}: mobile action bar missing`);
  if(ctaVisible){
    const labels=await cta.locator('a,span').allTextContents();
    (labels.includes('세금·연료·충전비')||labels.includes('계산 가능한 사양 없음'))&&labels.includes('차량 비교')?pass(`${family.family_id}: mobile actions labeled`):fail(`${family.family_id}: mobile action labels missing`);
    const small=await cta.locator('a,span').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().height<44).length);
    small===0?pass(`${family.family_id}: mobile actions touch-friendly`):fail(`${family.family_id}: mobile actions too small`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  overflow>1?fail(`${family.family_id}: 390px overflow ${overflow}px`):pass(`${family.family_id}: 390px no overflow`);
}
await page.close();
await browser.close();
if(errors.length){console.error(`Universal family UI QA failed: ${errors.length}`);process.exit(1)}
console.log('Universal family UI QA passed');

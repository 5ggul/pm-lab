import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const widths=[375,390,430];
const pages=['/','/cars/','/search/?q=쏘렌토','/compare/','/tools/annual-cost/','/cars/kia/sorento-mq4/'];
const errors=[];const pass=m=>console.log('PASS',m),fail=m=>{errors.push(m);console.error('FAIL',m)};
const browser=await chromium.launch({headless:true});

for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:900}});
  for(const p of pages){
    await page.goto(base+p,{waitUntil:'networkidle'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    overflow>1?fail(`${width}px ${p}: horizontal overflow ${overflow}px`):pass(`${width}px ${p}: no horizontal overflow`);
    const small=await page.evaluate(()=>[...document.querySelectorAll('input:not([type=hidden]),select,button')].filter(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&r.height<44}).length);
    small?fail(`${width}px ${p}: ${small} touch targets under 44px`):pass(`${width}px ${p}: touch targets`);
  }
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});
  const countText=await page.locator('#resultCount').textContent();
  const total=Number(String(countText||'').replace(/,/g,'').match(/\d+/)?.[0]||0);
  total>=500?pass(`public vehicle catalog ${total} vehicles visible`):fail(`public vehicle catalog unexpectedly small: ${countText}`);
  (await page.locator('#rawView').count())===0?pass('public catalog has no internal mode toggle'):fail('public catalog exposes internal mode toggle');
  const first=page.locator('.allcar-model').first();
  if(await first.count()){
    const href=await first.getAttribute('href');
    await page.goto(new URL(href,page.url()).toString(),{waitUntil:'networkidle'});
    (await page.locator('.generation').count())>0?pass('vehicle detail has generation data'):fail('vehicle detail has no generation data');
    (await page.locator('[data-family-universal="ready"]').count())>0?pass('vehicle detail has official specification summary'):fail('vehicle detail missing official specification summary');
  }else fail('public vehicle catalog has no vehicle links');
  await page.goto(base+'/cars/?view=raw',{waitUntil:'networkidle'});
  const rawParamCount=Number(String(await page.locator('#resultCount').textContent()||'').replace(/,/g,'').match(/\d+/)?.[0]||0);
  rawParamCount>=500&&rawParamCount<1000?pass('legacy view parameter stays on consumer vehicle catalog'):fail(`legacy view parameter exposed another catalog: ${rawParamCount}`);
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/family/?id=kia-ev6',{waitUntil:'networkidle'});
  let spec=await page.locator('.spec-panel').textContent();
  /84(?:\.0)? kWh/.test(spec||'')?pass('EV6 84 kWh battery visible'):fail('EV6 battery missing');
  /605 Nm/.test(spec||'')?pass('EV6 605 Nm torque visible'):fail('EV6 torque missing');
  let sourceHref=await page.locator('.spec-source a').getAttribute('href');
  /^https:\/\/(?:www\.)?kia\.com\//.test(sourceHref||'')?pass('EV6 official Kia source'):fail(`EV6 source unexpected: ${sourceHref}`);
  await page.goto(base+'/cars/family/?id=hyundai-grandeur',{waitUntil:'networkidle'});
  spec=await page.locator('.spec-panel').textContent();
  /5,035 mm/.test(spec||'')&&/2,895 mm/.test(spec||'')?pass('Grandeur official dimensions visible'):fail('Grandeur dimensions missing');
  const hierarchy=await fetch(base+'/data/generated/service-hierarchy.json').then(r=>r.json());
  const specData=await fetch(base+'/data/generated/manufacturer-specs.json').then(r=>r.json());
  const enriched=new Set((specData.records||[]).map(r=>r.family_id));
  const unEnriched=(hierarchy.families||[]).find(f=>f.active_record_count>0&&!enriched.has(f.family_id));
  if(unEnriched){
    await page.goto(base+'/cars/family/?id='+encodeURIComponent(unEnriched.family_id),{waitUntil:'networkidle'});
    const universal=page.locator('[data-family-universal="ready"]');await universal.waitFor({state:'visible',timeout:12000}).catch(()=>{});
    /한국에너지공단/.test(await universal.textContent().catch(()=>''))?pass('vehicle without manufacturer dimensions still has official specification data'):fail('official specification data missing');
  }
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/search/?q=쏘렌토',{waitUntil:'networkidle'});
  (await page.locator('.search-row a').count())>0?pass('search returns Sorento results'):fail('search has no Sorento results');
  await page.goto(base+'/cars/kia/sorento-mq4/',{waitUntil:'networkidle'});
  const diesel=page.getByRole('button',{name:'2.2 디젤'});
  if(await diesel.count()){
    await diesel.click();await page.waitForTimeout(100);
    const energy=await page.locator('#energyValue').textContent(),total=await page.locator('#totalValue').textContent();
    !/NaN|null|0원|계산 불가/.test(energy||'')?pass(`Sorento energy ${energy}`):fail(`Sorento energy ${energy}`);
    !/NaN|null|0원|계산 불가/.test(total||'')?pass(`Sorento total ${total}`):fail(`Sorento total ${total}`);
  }else fail('Sorento diesel selector not found');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/compare/',{waitUntil:'networkidle'});
  (await page.locator('#rowA option').count())>0&&(await page.locator('#rowB option').count())>0?pass('compare vehicle options available'):fail('compare vehicle options missing');
  await page.locator('#km').fill('15000');await page.locator('#km').dispatchEvent('input');await page.waitForTimeout(80);
  new URL(page.url()).searchParams.get('km')==='15000'?pass('compare distance persists in URL'):fail('compare distance missing from URL');
  await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
  (await page.locator('#sourceRow option').count())>0?pass('annual cost vehicle options available'):fail('annual cost vehicle options missing');
  await page.goto(base+'/tools/annual-cost/?car=ev6-cv',{waitUntil:'networkidle'});
  /충전단가 입력/.test(await page.locator('#total').textContent()||'')?pass('EV total waits for charge price'):fail('EV charge-price guard missing');
  await page.close();
}

await browser.close();
if(errors.length){console.error(`Mobile QA failed: ${errors.length}`);process.exit(1)}
console.log('Mobile QA passed');

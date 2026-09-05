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
    const smallControls=await page.evaluate(()=>[...document.querySelectorAll('input:not([type=hidden]),select,button')].filter(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0&&r.height<44}).map(el=>`${el.tagName}#${el.id||''}.${el.className||''}:${Math.round(el.getBoundingClientRect().height)}`));
    if(smallControls.length)fail(`${width}px ${p}: touch targets <44px ${smallControls.slice(0,5).join(', ')}`);else pass(`${width}px ${p}: touch targets`);
  }
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});
  let countText=await page.locator('#resultCount').textContent();
  let total=Number(String(countText||'').replace(/,/g,'').match(/\d+/)?.[0]||0);
  total>=500?pass(`vehicle catalog ${total} vehicles visible`):fail(`vehicle catalog unexpectedly small: ${countText}`);
  const firstFamily=page.locator('.allcar-model').first();
  if(await firstFamily.count()){
    const href=await firstFamily.getAttribute('href');
    await page.goto(new URL(href,page.url()).toString(),{waitUntil:'networkidle'});
    const generations=await page.locator('.generation').count();
    generations>0?pass(`vehicle detail ${generations} generation groups`):fail('vehicle detail has no generations');
    const rawLinks=await page.locator('.raw-model').count();
    rawLinks>0?pass(`vehicle detail ${rawLinks} source model links`):fail('vehicle detail has no source model links');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    overflow>1?fail(`390px vehicle detail horizontal overflow ${overflow}px`):pass('390px vehicle detail no document overflow');
  }else fail('vehicle catalog has no links');
  await page.goto(base+'/cars/?view=raw',{waitUntil:'networkidle'});
  countText=await page.locator('#resultCount').textContent();
  total=Number(String(countText||'').replace(/,/g,'').match(/\d+/)?.[0]||0);
  total>=3000?pass(`source car catalog ${total} model groups visible`):fail(`source car catalog unexpectedly small: ${countText}`);
  const firstRaw=page.locator('.allcar-model').first();
  if(await firstRaw.count()){
    const href=await firstRaw.getAttribute('href');
    await page.goto(new URL(href,page.url()).toString(),{waitUntil:'networkidle'});
    const rows=await page.locator('.record-table tbody tr').count();
    rows>0?pass(`all-car record detail ${rows} source rows`):fail('all-car record detail has no source rows');
  }else fail('source all-car catalog has no model links');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/family/?id=kia-ev6',{waitUntil:'networkidle'});
  let spec=await page.locator('.spec-panel').textContent();
  /제조사 공식 상세제원/.test(spec||'')?pass('EV6 manufacturer spec panel visible'):fail('EV6 manufacturer spec panel missing');
  /84(?:\.0)? kWh/.test(spec||'')?pass('EV6 official 84 kWh battery visible'):fail(`EV6 battery value missing: ${spec}`);
  /605 Nm/.test(spec||'')?pass('EV6 official 605 Nm torque visible'):fail(`EV6 torque value missing: ${spec}`);
  let sourceHref=await page.locator('.spec-source a').getAttribute('href');
  /^https:\/\/(?:www\.)?kia\.com\//.test(sourceHref||'')?pass('EV6 spec source points to Kia official domain'):fail(`EV6 spec source unexpected: ${sourceHref}`);
  let overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  overflow>1?fail(`390px EV6 spec vehicle horizontal overflow ${overflow}px`):pass('390px EV6 spec vehicle no document overflow');

  await page.goto(base+'/cars/family/?id=hyundai-grandeur',{waitUntil:'networkidle'});
  spec=await page.locator('.spec-panel').textContent();
  /5,035 mm/.test(spec||'')?pass('Grandeur official 5,035 mm length visible'):fail(`Grandeur length value missing: ${spec}`);
  /2,895 mm/.test(spec||'')?pass('Grandeur official 2,895 mm wheelbase visible'):fail(`Grandeur wheelbase value missing: ${spec}`);

  const hierarchy=await fetch(base+'/data/generated/service-hierarchy.json').then(r=>r.json());
  const specData=await fetch(base+'/data/generated/manufacturer-specs.json').then(r=>r.json());
  const enrichedIds=new Set((specData.records||[]).map(r=>r.family_id));
  const unEnriched=(hierarchy.families||[]).find(f=>f.active_record_count>0&&!enrichedIds.has(f.family_id));
  if(unEnriched){
    await page.goto(base+'/cars/family/?id='+encodeURIComponent(unEnriched.family_id),{waitUntil:'networkidle'});
    const universal=page.locator('[data-family-universal="ready"]');
    await universal.waitFor({state:'visible',timeout:12000}).catch(()=>{});
    const universalText=await universal.textContent().catch(()=>null);
    /한국에너지공단 공식 신고 제원/.test(universalText||'')?pass(`vehicle ${unEnriched.family_id} has official KEA universal details`):fail(`vehicle ${unEnriched.family_id} missing universal KEA details`);
    const fallback=await page.locator('.spec-panel').textContent();
    /제조사 상세제원 확인 중/.test(fallback||'')?pass(`vehicle ${unEnriched.family_id} clearly separates manufacturer-only fields`):fail(`vehicle ${unEnriched.family_id} missing manufacturer spec pending state`);
  }else fail('no vehicle without manufacturer specs available for no-inference regression test');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/search/?q=쏘렌토',{waitUntil:'networkidle'});
  const sections=await page.locator('.search-section').count(),links=await page.locator('.search-row a').count();
  sections>=2?pass(`search shows vehicle + source sections ${sections}`):fail(`search sections ${sections}`);
  links>0?pass(`full search 쏘렌토 results ${links}`):fail('full search has no 쏘렌토 results');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/kia/sorento-mq4/',{waitUntil:'networkidle'});
  const groups=await page.locator('.variant-selector-group').count();
  groups>=3?pass(`Sorento stepped selectors ${groups}`):fail(`Sorento stepped selectors missing: ${groups}`);
  const diesel=page.getByRole('button',{name:'2.2 디젤'});
  if(await diesel.count()){await diesel.click();await page.waitForTimeout(100);const assumption=await page.locator('#assumptionLine').textContent(),energy=await page.locator('#energyValue').textContent(),total=await page.locator('#totalValue').textContent();/경유/.test(assumption||'')?pass('Sorento diesel label 경유'):fail(`Sorento diesel label: ${assumption}`);!/NaN|null|0원|충전단가 입력|계산 불가/.test(energy||'')?pass(`Sorento diesel energy ${energy}`):fail(`Sorento diesel energy ${energy}`);!/NaN|null|0원|충전단가 입력|계산 불가/.test(total||'')?pass(`Sorento diesel total ${total}`):fail(`Sorento diesel total ${total}`)}else fail('Sorento diesel selector not found');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/compare/',{waitUntil:'networkidle'});
  const allActive=await page.locator('#allMode').evaluate(el=>el.classList.contains('active'));
  allActive?pass('compare defaults to full official database'):fail('compare full-database mode not active');
  const rowA=await page.locator('#rowA option').count(),rowB=await page.locator('#rowB option').count();
  rowA>0&&rowB>0?pass(`compare full rows A=${rowA} B=${rowB}`):fail(`compare full rows missing A=${rowA} B=${rowB}`);
  await page.locator('#km').fill('15000');await page.locator('#km').dispatchEvent('input');await page.waitForTimeout(80);
  let u=new URL(page.url());for(const k of ['fa','ra','fb','rb','km'])u.searchParams.get(k)?pass(`full compare URL ${k}=${u.searchParams.get(k)}`):fail(`full compare URL missing ${k}`);
  u.searchParams.get('km')==='15000'?pass('full compare custom km shared'):fail(`full compare km ${u.searchParams.get('km')}`);
  let visible=await page.locator('#compareTable').textContent();/\b(?:gasoline|diesel|hybrid|electric)\b/i.test(visible||'')?fail('full compare raw fuel enum visible'):pass('full compare fuel labels localized');
  await page.goto(base+'/compare/?a=grandeur-gn7&av=gn7-g25-2wd-18&b=k8-gl3&bv=k8-g25-2wd-17&km=20000',{waitUntil:'networkidle'});
  const reviewedActive=await page.locator('#reviewedMode').evaluate(el=>el.classList.contains('active'));
  reviewedActive?pass('legacy compare URL restores reviewed mode'):fail('legacy compare URL did not restore reviewed mode');
  await page.locator('#km').fill('15000');await page.locator('#km').dispatchEvent('input');await page.waitForTimeout(80);u=new URL(page.url());for(const k of ['a','av','b','bv','km'])u.searchParams.get(k)?pass(`reviewed compare URL ${k}=${u.searchParams.get(k)}`):fail(`reviewed compare URL missing ${k}`);
  visible=await page.locator('#compareTable').textContent();/\b(?:gas|gasoline|diesel|hybrid|electric)\b/i.test(visible||'')?fail('reviewed compare raw fuel enum visible'):pass('reviewed compare fuel labels localized');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
  const allActive=await page.locator('#allMode').evaluate(el=>el.classList.contains('active'));
  allActive?pass('annual cost defaults to full official database'):fail('annual cost full-database mode not active');
  const sourceOptions=await page.locator('#sourceRow option').count(),readyText=await page.locator('#readiness').textContent();
  sourceOptions>0?pass(`annual cost full source options ${sourceOptions}`):fail('annual cost full source options missing');
  /계산 가능|확인 필요|계산 제외/.test(readyText||'')?pass(`annual cost readiness ${readyText}`):fail(`annual cost readiness missing: ${readyText}`);
  await page.goto(base+'/tools/annual-cost/?car=ev6-cv',{waitUntil:'networkidle'});
  const reviewedActive=await page.locator('#reviewedMode').evaluate(el=>el.classList.contains('active'));
  reviewedActive?pass('annual cost curated URL restores reviewed mode'):fail('annual cost curated URL did not restore reviewed mode');
  const hidden=await page.locator('#regLabel').evaluate(el=>el.hidden),disabled=await page.locator('#reg').isDisabled();
  hidden&&disabled?pass('EV registration month hidden/disabled'):fail(`EV registration month hidden=${hidden} disabled=${disabled}`);
  const total=await page.locator('#total').textContent();/충전단가 입력/.test(total||'')?pass('EV total waits for charge price'):fail(`EV total before price: ${total}`);
  await page.close();
}

await browser.close();
if(errors.length){console.error(`Mobile QA failed: ${errors.length}`);process.exit(1)}
console.log('Mobile QA passed');

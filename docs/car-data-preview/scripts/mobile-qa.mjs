import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const widths=[375,390,430];
const pages=['/','/compare/','/tools/annual-cost/','/cars/kia/sorento-mq4/'];
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
  await page.locator('#km').fill('15000');await page.locator('#km').dispatchEvent('input');await page.waitForTimeout(50);
  const u=new URL(page.url());for(const k of ['a','av','b','bv','km'])u.searchParams.get(k)?pass(`compare URL ${k}=${u.searchParams.get(k)}`):fail(`compare URL missing ${k}`);
  u.searchParams.get('km')==='15000'?pass('compare custom km shared'):fail(`compare km ${u.searchParams.get('km')}`);
  const rawEnums=await page.locator('#compareTable').textContent();/\b(?:gas|gasoline|diesel|hybrid|electric)\b/i.test(rawEnums||'')?fail('compare raw fuel enum visible'):pass('compare fuel labels localized');
  await page.close();
}

{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/tools/annual-cost/?car=ev6-cv',{waitUntil:'networkidle'});
  const hidden=await page.locator('#regLabel').evaluate(el=>el.hidden),disabled=await page.locator('#reg').isDisabled();
  hidden&&disabled?pass('EV registration month hidden/disabled'):fail(`EV registration month hidden=${hidden} disabled=${disabled}`);
  const total=await page.locator('#total').textContent();/충전단가 입력/.test(total||'')?pass('EV total waits for charge price'):fail(`EV total before price: ${total}`);
  await page.close();
}

await browser.close();
if(errors.length){console.error(`Mobile QA failed: ${errors.length}`);process.exit(1)}
console.log('Mobile QA passed');

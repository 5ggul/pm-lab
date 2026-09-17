import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.CAR_PREVIEW_CHROME_PATH?{executablePath:process.env.CAR_PREVIEW_CHROME_PATH}:{});
try{
  const page=await browser.newPage({viewport:{width:375,height:812}});
  await page.goto(base+'/cars/family/?id=kia-niro',{waitUntil:'networkidle'});
  await page.locator('.official-powertrain-row').filter({hasText:'플러그인 하이브리드 · 전기 전비'}).waitFor();
  const phev=await page.locator('.official-powertrain-row').filter({hasText:'플러그인 하이브리드 · 전기 전비'}).textContent();
  assert.match(phev,/5\.1 km\/kWh/);
  assert.doesNotMatch(phev,/5\.1 km\/L/);

  await page.goto(base+'/compare/?fa=kia-niro',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#genA')?.options.length>1);
  await page.locator('#genA').selectOption({index:1});
  await page.waitForFunction(()=>[...document.querySelectorAll('#rowA option')].some(option=>option.textContent.includes('플러그인')));
  const phevOption=page.locator('#rowA option').filter({hasText:'플러그인'}).first();
  await page.locator('#rowA').selectOption(await phevOption.getAttribute('value'));
  await page.waitForFunction(()=>document.querySelector('#compareTable')?.textContent?.includes('5.1 km/kWh'));
  assert.doesNotMatch(await page.locator('#compareTable').textContent(),/5\.1 km\/L/);

  await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='all');
  await page.locator('#reviewedMode').click();
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='reviewed');
  await page.locator('#car').selectOption('g80-rg3');
  await page.locator('#km').fill('15000');
  await page.locator('#price').fill('1900');
  await page.waitForFunction(()=>{const q=new URLSearchParams(location.search);return q.get('mode')==='reviewed'&&q.get('car')==='g80-rg3'&&q.get('km')==='15000'&&q.get('cprice_gasoline')==='1900'});
  await page.waitForFunction(()=>/원/.test(document.querySelector('#total')?.textContent||''));
  const reviewedTotal=await page.locator('#total').textContent();
  const reviewedUrl=page.url();
  await page.goto(reviewedUrl,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='reviewed'&&document.querySelector('#car')?.value==='g80-rg3'&&document.querySelector('#price')?.value==='1900');
  assert.equal(await page.locator('#km').inputValue(),'15000');
  await page.waitForFunction(()=>/원/.test(document.querySelector('#total')?.textContent||''));
  assert.equal(await page.locator('#total').textContent(),reviewedTotal);

  await page.locator('#allMode').click();
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='all'&&document.querySelector('#sourceRow')?.value);
  await page.locator('#familySearch').fill('현대 그랜저');
  await page.waitForFunction(()=>document.querySelector('#familySearch')?.value==='현대 그랜저'&&document.querySelector('#sourceRow')?.value);
  await page.waitForFunction(()=>{const q=new URLSearchParams(location.search);return q.get('mode')==='all'&&!!q.get('calc')&&!q.has('car')&&!q.has('variant')});
  const calc=await page.locator('#sourceRow').inputValue();
  const allUrl=page.url();
  await page.goto(allUrl,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.costMode==='all'&&document.querySelector('#sourceRow')?.value===new URLSearchParams(location.search).get('calc'));
  assert.equal(await page.locator('#sourceRow').inputValue(),calc);
  assert.equal(await page.locator('#familySearch').inputValue(),'현대 그랜저');
  await page.close();

  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});
  const staticPage=await noJs.newPage();
  await staticPage.goto(base+'/compare/',{waitUntil:'domcontentloaded'});
  const fallback=await staticPage.locator('.comparison-static').textContent();
  assert.match(fallback,/쏘렌토/);assert.match(fallback,/싼타페/);
  assert.match(fallback,/km\/L/);assert.match(fallback,/자동차세/);
  assert.equal(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await noJs.close();
  console.log('PASS feedback units/share: PHEV electric efficiency, calculator mode and car round trip, no-JS comparison.');
}finally{await browser.close()}

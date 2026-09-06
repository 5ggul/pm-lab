import { newQaPage } from './qa-photo-fixture.mjs';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/car-data-preview';
const errors=[];
const pass=m=>console.log('PASS',m);
const fail=m=>{errors.push(m);console.error('FAIL',m)};
const browser=await chromium.launch({headless:true});

async function waitReady(page){await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready',{timeout:12000}).catch(()=>{});}
async function mobileQa(url='/cars/'){
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+url,{waitUntil:'networkidle'});await waitReady(page);
  const ready=await page.evaluate(()=>document.documentElement.dataset.consumerCatalog==='ready');
  ready?pass(`${url}: consumer catalog ready`):fail(`${url}: consumer catalog not ready`);
  const count=await page.locator('#catalogCount').textContent().catch(()=>null);
  /592/.test(count||'')?pass(`${url}: all 592 vehicles represented`):fail(`${url}: unexpected catalog count ${count}`);
  const cards=await page.locator('.vehicle-card').count();
  cards===24?pass(`${url}: first page renders 24 cards`):fail(`${url}: expected 24 cards, got ${cards}`);
  const oldVisible=await page.locator('#tableHost').isVisible().catch(()=>false);
  !oldVisible?pass(`${url}: legacy table hidden`):fail(`${url}: legacy table still visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  overflow<=1?pass(`${url}: 390px no horizontal overflow`):fail(`${url}: 390px overflow ${overflow}px`);
  const small=await page.locator('.consumer-catalog button,.consumer-catalog input,.consumer-catalog select,.vehicle-card-actions a').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.height<44}).length);
  small===0?pass(`${url}: catalog controls are touch-friendly`):fail(`${url}: ${small} catalog controls under 44px`);
  const cardText=await page.locator('.vehicle-card').first().textContent().catch(()=>null);
  /1년 유지비/.test(cardText||'')&&/제조사 제원/.test(cardText||'')?pass(`${url}: decision fields visible on cards`):fail(`${url}: decision fields missing from cards`);
  const actions=await page.locator('.vehicle-card').first().locator('.vehicle-card-actions a').allTextContents();
  actions.includes('차량 보기')&&actions.includes('유지비')&&actions.includes('비교')?pass(`${url}: card actions available`):fail(`${url}: card actions missing`);
  await page.close();
}

await mobileQa('/cars/');
await mobileQa('/cars/?view=raw');

{
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});await waitReady(page);
  const options=await page.locator('#catalogMaker option').count();
  options>10?pass(`manufacturer filter has ${options} options`):fail(`manufacturer filter unexpectedly small: ${options}`);
  const kia=page.locator('#catalogMaker');
  const hasKia=await kia.locator('option[value="기아"]').count();
  if(hasKia){
    await kia.selectOption('기아');await page.waitForTimeout(100);
    const makerCards=await page.locator('.vehicle-card').count();
    makerCards>0?pass(`manufacturer filter returns ${makerCards} Kia cards on page`):fail('manufacturer filter returned no Kia cards');
    const makerMismatch=await page.locator('.vehicle-card-maker').evaluateAll(els=>els.filter(el=>!(el.textContent||'').includes('기아')).length);
    makerMismatch===0?pass('manufacturer filter limits visible cards to Kia'):fail(`manufacturer filter has ${makerMismatch} mismatched cards`);
  }else fail('Kia manufacturer option missing');
  await kia.selectOption('');
  await page.locator('#catalogSearch').fill('쏘렌토');await page.waitForTimeout(250);
  const searchCards=await page.locator('.vehicle-card').count();
  const searchText=(await page.locator('.vehicle-card h2').allTextContents()).join(' ');
  searchCards>0&&/쏘렌토/.test(searchText)?pass(`search returns Sorento cards (${searchCards})`):fail(`search failed for Sorento: ${searchText}`);
  const qParam=new URL(page.url()).searchParams.get('q');
  qParam==='쏘렌토'?pass('search state persists in URL'):fail(`search URL state unexpected: ${qParam}`);
  await page.close();
}

{
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});await waitReady(page);
  const ev=page.locator('[data-fuel="electric"]');
  if(await ev.count()){
    await ev.click();await page.waitForTimeout(120);
    const cardCount=await page.locator('.vehicle-card').count();
    const missingEv=await page.locator('.vehicle-card-pills').evaluateAll(els=>els.filter(el=>!(el.textContent||'').includes('전기')).length);
    cardCount>0&&missingEv===0?pass(`electric filter returns ${cardCount} EV cards on page`):fail(`electric filter mismatch cards=${cardCount} missing=${missingEv}`);
    new URL(page.url()).searchParams.get('fuel')==='electric'?pass('fuel filter persists in URL'):fail('fuel filter missing from URL');
  }else fail('electric filter chip missing');
  await page.close();
}

{
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});await waitReady(page);
  await page.locator('.catalog-extra summary').click();
  const domestic=page.locator('[data-origin="domestic"]');
  const overseas=page.locator('[data-origin="overseas"]');
  if(await domestic.count()&&await overseas.count()){
    await domestic.click();await page.waitForTimeout(100);
    const cards=await page.locator('.vehicle-card').count();
    const mismatches=await page.locator('.vehicle-card-pills').evaluateAll(els=>els.filter(el=>!(el.textContent||'').includes('국내 브랜드')).length);
    cards>0&&mismatches===0?pass(`domestic brand filter returns ${cards} matching cards`):fail(`domestic brand filter mismatch cards=${cards} mismatches=${mismatches}`);
    new URL(page.url()).searchParams.get('origin')==='domestic'?pass('brand filter persists in URL'):fail('brand filter missing from URL');
  }else fail('brand origin filter chips missing');
  await page.close();
}

{
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});await waitReady(page);
  await page.locator('.catalog-extra summary').click();
  const passenger=page.locator('[data-class="승용차"]');
  if(await passenger.count()){
    await passenger.click();await page.waitForTimeout(100);
    const cards=await page.locator('.vehicle-card').count();
    const mismatches=await page.locator('.vehicle-card-maker').evaluateAll(els=>els.filter(el=>!(el.textContent||'').includes('승용차')).length);
    cards>0&&mismatches===0?pass(`official vehicle-class filter returns ${cards} passenger cards`):fail(`vehicle-class filter mismatch cards=${cards} mismatches=${mismatches}`);
    new URL(page.url()).searchParams.get('class')==='승용차'?pass('vehicle-class filter persists in URL'):fail('vehicle-class filter missing from URL');
  }else fail('passenger vehicle-class chip missing');
  await page.close();
}

{
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/?q=EV3',{waitUntil:'networkidle'});await waitReady(page);
  const mapped=Number(await page.evaluate(()=>document.documentElement.dataset.vehicleImages||'0'));
  mapped>=50?pass(`licensed image manifest exposes ${mapped} vehicle images`):fail(`licensed image manifest unexpectedly small: ${mapped}`);
  const card=page.locator('.vehicle-card').filter({hasText:'EV3'}).first();
  if(await card.count()){
    const image=card.locator('.vehicle-card-media img');
    const credit=card.locator('.vehicle-card-credit');
    (await image.count())===1?pass('EV3 card uses a verified vehicle photo'):fail('EV3 card photo missing');
    const src=await image.getAttribute('src').catch(()=>null);
    /(?:thumb|upload)\.wikimedia\.org/.test(src||'')?pass('vehicle photo is served from reviewed Wikimedia thumbnail'):fail(`unexpected vehicle image source ${src}`);
    const creditText=await credit.textContent().catch(()=>null);
    /CC0|CC BY-SA/.test(creditText||'')?pass('vehicle photo attribution and license visible'):fail(`vehicle photo license credit missing: ${creditText}`);
  }else fail('EV3 card missing for image QA');
  await page.close();
}

{
  const page=await newQaPage(browser,{viewport:{width:1280,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});await waitReady(page);
  const cols=await page.locator('.vehicle-card-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  cols===3?pass('desktop catalog uses 3-column card grid'):fail(`desktop grid column count ${cols}`);
  const visibleText=await page.locator('.consumer-catalog').innerText();
  !/정규화|raw_only|신고행|원문 모델|API 제공/.test(visibleText)?pass('catalog UI contains no internal terminology'):fail('catalog UI exposes internal terminology');
  await page.close();
}

await browser.close();
if(errors.length){console.error(`Catalog card UI QA failed: ${errors.length}`);process.exit(1)}
console.log('Catalog card UI QA passed');

import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const manifest=await fetch(base+'/data/vehicle-image-sources.json').then(r=>r.json());
const families=(await fetch(base+'/data/generated/family-detail-index.json').then(r=>r.json())).families;
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{headless:true});
const context=await browser.newContext({viewport:{width:390,height:900}});
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#ddd"/></svg>';
// Verify our integration, not an external image host's availability.
await context.route(/https:\/\/(thumb|upload|commons)\.wikimedia\.org\//,r=>r.fulfill({contentType:'image/svg+xml',body:fixture}));
const page=await context.newPage();
const ready=async()=>page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
const detailReady=async()=>page.locator('.family-photo-host[data-photos-ready="true"]').waitFor();
async function checkCredit(host,r){
  assert.equal(await host.locator('img').getAttribute('src'),r.image_url);
  assert.equal(await host.locator('.vehicle-card-credit').getAttribute('href'),r.source_page);
  assert.equal(await host.locator('.vehicle-photo-license').getAttribute('href'),r.license_url);
  const credit=await host.locator('figcaption').innerText();assert.ok(credit.includes(r.author)&&credit.includes(r.license)&&credit.includes(r.generation));
  assert.ok(Number(await host.locator('img').getAttribute('width'))>0&&Number(await host.locator('img').getAttribute('height'))>0);
}
try{
  await page.goto(base+'/cars/');await ready();
  assert.equal(await page.locator('.vehicle-card img').count(),24,'Default first page should expose 24 reviewed photos');
  assert.equal(await page.locator('#catalogSort').inputValue(),'photos');
  await page.locator('#catalogSort').selectOption('name');
  assert.equal(new URL(page.url()).searchParams.get('sort'),'name');
  await page.reload();await ready();assert.equal(await page.locator('#catalogSort').inputValue(),'name');
  const photoIds=new Set(manifest.records.map(r=>r.family_id));
  const missing=families.find(f=>!photoIds.has(f.family_id));
  assert.ok(missing,'The fixture must retain at least one family without a reviewed photo');
  await page.goto(base+'/cars/?q='+encodeURIComponent(missing.family_name));await ready();
  const missingCard=page.locator(`[data-family-id="${missing.family_id}"] .vehicle-photo-empty`);
  assert.equal(await missingCard.count(),1);
  assert.ok((await missingCard.locator('.vehicle-card-media').boundingBox()).height<=80);
  await page.locator('#catalogReset').click();assert.equal(await page.locator('#catalogSort').inputValue(),'photos');
  assert.equal(new URL(page.url()).searchParams.get('sort'),null);
  const seen=new Set();let photoTotal=0;
  for(let number=1;number<=Math.ceil(families.length/24);number++){
    await page.goto(base+'/cars/?page='+number);await ready();
    const ids=await page.locator('.vehicle-card').evaluateAll(es=>es.map(e=>e.dataset.familyId));
    for(const id of ids){assert.ok(!seen.has(id),'Duplicate after photo sorting: '+id);seen.add(id);}
    photoTotal+=await page.locator('.vehicle-card img').count();
    for(const id of ids){const r=manifest.records.find(r=>r.family_id===id);if(r)await checkCredit(page.locator(`[data-family-id="${id}"] .vehicle-photo`),r);}
  }
  assert.equal(seen.size,families.length);assert.equal(photoTotal,manifest.records.length);
  await context.route('**/assets/catalog-consumer.js*',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.continue();});
  const lastPage=Math.ceil(families.length/24);
  await page.goto(base+'/cars/?page='+lastPage);await ready();
  assert.equal(new URL(page.url()).searchParams.get('page'),String(lastPage),'Legacy table must not clamp consumer URL');
  assert.match(await page.locator('#catalogPageInfo').innerText(),new RegExp(`^${lastPage} \/ ${lastPage}`));
  await context.unroute('**/assets/catalog-consumer.js*');
  await page.goto(base+'/cars/?maker='+encodeURIComponent('BMW'));await ready();
  assert.ok(await page.locator('.vehicle-card img').count()>0);
  assert.ok((await page.locator('.vehicle-card-maker').allTextContents()).every(t=>t.includes('BMW')));
  console.log(`PASS photo-first sorting, all ${families.length} unique vehicles across pages, sort reload/reset and compact unknown photos`);
  // Keep complete mapping coverage as the photo collection grows, using four isolated pages.
  let photoIndex=0;
  await Promise.all(Array.from({length:4},async()=>{
    const photoPage=await context.newPage();
    try{while(photoIndex<manifest.records.length){
      const r=manifest.records[photoIndex++],f=families.find(f=>f.family_id===r.family_id);
      await photoPage.goto(base+'/cars/family/?id='+r.family_id);
      await photoPage.locator('.family-photo-host[data-photos-ready="true"]').waitFor();
      await checkCredit(photoPage.locator('.family-photo'),r);
      assert.equal(await photoPage.locator('[data-family-universal="ready"]').count(),1);
    }}finally{await photoPage.close()}
  }));
  console.log(`PASS all ${manifest.records.length} catalog/detail photo mappings and credits`);
  for(const width of [375,390,430,1280]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/cars/?q=EV3','/cars/family/?id=hyundai-grandeur']){
      await page.goto(base+path);path.includes('family')?await detailReady():await ready();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`${width} ${path} overflow`);
      if(path.includes('family')){
        assert.ok((await page.locator('.family-actions').boundingBox()).y<450);
        assert.ok((await page.locator('.family-photo .vehicle-card-media').boundingBox()).height<=160);
        if(width<700)assert.ok(await page.locator('.mobile-car-cta').isVisible());
      }
    }
  }
  console.log('PASS responsive photo dimensions, no overflow, primary actions stay near top');
  await page.goto(base+'/cars/?q=does-not-exist&maker='+encodeURIComponent('기아')+'&fuel=electric&origin=domestic&class='+encodeURIComponent('승용차')+'&page=2');await ready();
  assert.equal(await page.locator('.vehicle-card').count(),0);assert.match(await page.locator('.catalog-empty').innerText(),/조건에 맞는 차량/);
  assert.match(await page.locator('#catalogActiveFilters').innerText(),/does-not-exist.*기아.*전기/);
  await page.reload();await ready();assert.equal(await page.locator('.vehicle-card').count(),0);
  await page.locator('#catalogReset').click();assert.match(await page.locator('#catalogCount').innerText(),new RegExp(String(families.length)));assert.equal(await page.locator('.vehicle-card').count(),24);
  for(const key of ['q','maker','fuel','origin','class','page'])assert.equal(new URL(page.url()).searchParams.get(key),null);
  await page.locator('#catalogSearch').fill('쏘렌토');await page.locator('#catalogReset').click();await page.waitForTimeout(250);assert.match(await page.locator('#catalogCount').innerText(),new RegExp(String(families.length)));
  for(const bad of ['NaN','Infinity','1.5','-3']){await page.goto(base+'/cars/?page='+bad);await ready();assert.equal(await page.locator('.vehicle-card').count(),24);}
  console.log('PASS empty results, filter summary, reset, debounce cancellation and invalid pagination');
  await context.unroute(/https:\/\/(thumb|upload|commons)\.wikimedia\.org\//);
  await context.route(/https:\/\/(thumb|upload|commons)\.wikimedia\.org\//,r=>r.abort());
  await context.route('**/assets/vehicle-images/**',r=>r.abort());
  for(const path of ['/cars/?q=EV3','/cars/family/?id=kia-ev3']){
    await page.goto(base+path);path.includes('family')?await detailReady():await ready();
    await page.locator('[data-photo-error="true"]').waitFor();
    assert.ok(await page.locator('.vehicle-card-credit').first().isVisible());
    assert.ok(await page.locator('.vehicle-photo img').first().isHidden());
  }
  await context.unroute('**/assets/vehicle-images/**');
  const unknown=families.find(f=>!manifest.records.some(r=>r.family_id===f.family_id));
  await page.goto(base+'/cars/family/?id='+unknown.family_id);await detailReady();assert.equal(await page.locator('.family-photo img').count(),0);assert.match(await page.locator('.family-photo').innerText(),/대표 사진 없음/);
  for(const failure of ['abort','invalid-json','500']){
    await context.route('**/vehicle-photo-index.json',r=>failure==='abort'?r.abort():r.fulfill({status:failure==='500'?500:200,contentType:'application/json',body:'invalid'}));
    await page.goto(base+'/cars/');await ready();assert.match(await page.locator('#catalogCount').innerText(),new RegExp(String(families.length)));assert.equal(await page.locator('.vehicle-card').count(),24);
    await page.goto(base+'/cars/family/?id=kia-ev3');await detailReady();assert.equal(await page.locator('[data-family-universal="ready"]').count(),1);assert.equal(await page.locator('.family-photo img').count(),0);
    await context.unroute('**/vehicle-photo-index.json');
  }
  console.log('PASS image failure, unknown photo, missing/invalid/500 manifest preserve vehicle detail and catalog');
  let release;
  const held=new Promise(r=>release=r);
  await context.route('**/vehicle-photo-index.json',async r=>{await held;await r.fulfill({json:manifest});});
  await page.goto(base+'/cars/family/?id=kia-ev3');await page.locator('.family-photo').waitFor();
  const before=await page.locator('.family-stats').boundingBox();release();await detailReady();
  const after=await page.locator('.family-stats').boundingBox();assert.ok(Math.abs(before.y-after.y)<=1,'Photo metadata changed summary layout');
  console.log('PASS delayed photo metadata causes no summary layout shift');
}finally{await browser.close();}
console.log('Reviewed media UI QA passed');

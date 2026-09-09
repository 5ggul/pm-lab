import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{headless:true});
const catalog=await fetch(base+'/data/generated/catalog.json').then(r=>r.json());
const paths=['/','/cars/','/compare/','/tools/annual-cost/',...catalog.cars.map(c=>c.path.slice(1))];
try{
  for(const width of [375,390,430,1280]){
    const page=await newQaPage(browser,{viewport:{width,height:900}});
    for(const p of paths){
      await page.goto(base+p,{waitUntil:'networkidle'});
      assert(await page.locator('meta[name="robots"]').getAttribute('content').then(s=>s.includes('noindex')));
      const nav=page.locator('header nav');
      for(const link of await nav.locator('a').all())assert(await link.isVisible(),`Hidden nav: ${width} ${p} ${await link.textContent()}`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${width} ${p}`);
      if(width===390&&p==='/'){
        await page.getByRole('link',{name:'비교',exact:true}).first().click();
        assert(new URL(page.url()).pathname.endsWith('/compare/'),'Mobile nav did not navigate');
      }
    }
    await page.close();
  }
  const page=await newQaPage(browser,{viewport:{width:390,height:900}});
  await page.goto(base+'/cars/family/?id=family-f0963420190512cd',{waitUntil:'networkidle'});
  assert.match(await page.locator('h1').textContent(),/K7 3.3GDI/);
  assert.match(await page.locator('.generation').first().textContent(),/YG/);
  for(const c of catalog.cars){
    await page.goto(base+c.path.slice(1),{waitUntil:'networkidle'});
    const img=page.locator('main img').first();
    assert.equal(await img.getAttribute('src'),c.image,`${c.id}: inconsistent shared photo`);
    assert(!c.image.includes('Special:Redirect'));
    assert(await img.getAttribute('width'));assert(await img.getAttribute('height'));
    assert(await page.locator(`a[href="${c.imageMeta.sourceUrl}"]`).count());
    assert(await page.locator(`a[href="${c.imageMeta.licenseUrl}"]`).count());
    if(c.indexable)assert.match(await page.locator('.pilot-trust').textContent(),/감가상각/);
  }
  for(const slug of ['grandeur-vs-k8','ioniq5-vs-ev6','sorento-gasoline-vs-hybrid','grandeur-gasoline-vs-hybrid','k8-gasoline-vs-hybrid']){
    await page.goto(`${base}/compare/${slug}/`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('h1').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const cards=await page.locator('[data-pilot-car]').evaluateAll(els=>els.map(e=>({id:e.dataset.pilotCar,vid:e.dataset.pilotVariant,text:e.textContent})));
    assert.equal(cards.length,2);
    for(const card of cards){const c=catalog.cars.find(c=>c.id===card.id),v=c.variants.find(v=>v.id===card.vid);assert(card.text.includes(String(v.combined)));assert(card.text.includes(v.label));}
    await page.locator('[data-pilot-calculate]').click();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#carA').inputValue(),cards[0].id);
    assert.equal(await page.locator('#varA').inputValue(),cards[0].vid);
    assert.equal(await page.locator('#carB').inputValue(),cards[1].id);
    assert.equal(await page.locator('#varB').inputValue(),cards[1].vid);
    if(slug==='ioniq5-vs-ev6'){
      assert.equal(await page.locator('#elec').inputValue(),'');
      assert.match(await page.locator('#compareTable').textContent(),/충전단가|계산 제외|입력/);
      await page.locator('#elec').fill('300');
      await page.locator('#km').fill('10000');
      await page.locator('#km').dispatchEvent('input');
      assert.equal(new URL(page.url()).searchParams.get('elec'),'300');
      assert.equal(new URL(page.url()).searchParams.get('km'),'10000');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('#elec').inputValue(),'300');
    }
  }
  await page.goto(base+'/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('img[src*="Special:Redirect"]').count(),0);
  await page.locator('.home-car img').first().dispatchEvent('error');
  assert(await page.getByText('사진을 불러오지 못했습니다',{exact:true}).first().isVisible());
  if(process.env.CAR_QA_SCREENSHOTS){
    fs.mkdirSync('output/playwright',{recursive:true});
    await page.goto(base+'/compare/ioniq5-vs-ev6/',{waitUntil:'networkidle'});
    await page.screenshot({path:'output/playwright/car-pilot-mobile.png',fullPage:true});
  }
  console.log('PASS reviewed pilot: navigation at 4 widths, shared photos, 5 exact variant comparison flows, EV guard, noindex and fallback.');
}finally{await browser.close();}

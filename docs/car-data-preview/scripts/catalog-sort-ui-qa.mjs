import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url)));
const families=read('generated/catalog-list-index.json').families;
const photos=new Set(read('vehicle-image-sources.json').records.map(r=>r.family_id));
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
 for(const width of [390,1280]){
  const page=await newQaPage(browser,{viewport:{width,height:900}});
  await page.goto(base+'/cars/');
  await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
  const firstPages=[];
  for(const mode of ['photos','name','model']){
   await page.selectOption('#catalogSort',mode);
   const visible=await page.locator('.vehicle-card').evaluateAll(es=>es.map(e=>e.dataset.familyId));
   firstPages.push(visible.join(','));
   const ordered=await page.evaluate(({families,photoIds,mode})=>{
    const collator=new Intl.Collator('ko'),ids=new Set(photoIds);
    const key=f=>mode==='name'?[f.maker,f.family_name,f.family_id]:[f.family_name,f.maker,f.family_id];
    return [...families].sort((a,b)=>{
     if(mode==='photos'&&ids.has(a.family_id)!==ids.has(b.family_id))return ids.has(a.family_id)?-1:1;
     const ka=key(a),kb=key(b);for(let i=0;i<ka.length;i++){const result=collator.compare(ka[i],kb[i]);if(result)return result;}return 0;
    }).map(f=>f.family_id);
   },{families,photoIds:[...photos],mode});
   assert.deepEqual(visible,ordered.slice(0,24));
   await page.locator('#catalogPager button').filter({hasText:/^2$/}).click();
   assert.deepEqual(await page.locator('.vehicle-card').evaluateAll(es=>es.map(e=>e.dataset.familyId)),ordered.slice(24,48));
   await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
   assert.equal(await page.locator('#catalogSort').inputValue(),mode);
   assert.deepEqual(await page.locator('.vehicle-card').evaluateAll(es=>es.map(e=>e.dataset.familyId)),ordered.slice(24,48));
  }
  assert.equal(new Set(firstPages).size,3,'All three sorting choices must produce distinct first pages');
  await page.selectOption('#catalogMaker','기아');
  await page.selectOption('#catalogSort','model');
  assert((await page.locator('.vehicle-card-maker').allTextContents()).every(s=>s.startsWith('기아')));
  assert.match(await page.locator('#catalogPageInfo').textContent(),/^1 \//);
  await page.locator('#catalogReset').click();
  assert.equal(await page.locator('#catalogSort').inputValue(),'photos');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`PASS ${width}: distinct photo/maker/model order, pagination, URL reload, filter and reset`);
  await page.close();
 }
}finally{await browser.close()}

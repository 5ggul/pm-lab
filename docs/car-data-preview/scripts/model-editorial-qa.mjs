import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import '../assets/cost-math.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const model=read('data/popular-models-reviewed.json').models.find(m=>m.id==='santafe-mx5');
// Independently transcribed from the visually checked source table, page 25.
const officialCombined=[10.1,9.7,9.4,9.7,9.4,10.8,11,10.4,10.6,10.4,10,10,14,13.6,13,15.5,15,14.4];
assert.deepEqual(model.variants.map(v=>v.combined),officialCombined.map(n=>[n,n]));
assert.deepEqual(model.variants.map(v=>v.cc),officialCombined.map((_,i)=>i<12?2497:1598));
const price=read('data/fuel-price.json').prices.gasoline;
const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
 for(const width of [320,375,390,430,1280]){
  const page=await newQaPage(browser,{viewport:{width,height:900},javaScriptEnabled:false});
  await page.goto(base+'/'+model.path);
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('#specs tbody tr').count(),18);
  assert.equal(await page.locator('[data-editorial-variant]').count(),4);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);
  for(const v of model.variants.filter(v=>[1,7,16,18].some(n=>v.id===`santafe-mx5-${n}`))){
   const cells=await page.locator(`[data-editorial-variant="${v.id}"] td`).allTextContents();
   const tax=CAR_COST_MATH.annualTax(v.cc,false,'2026-01',2026).total,energy=CAR_COST_MATH.energyCost(20000,v.combined[0],price);
   assert.deepEqual(cells,[won(tax),'약 '+won(energy),'약 '+won(tax+energy)]);
  }
  assert.equal(await page.locator('#model-questions details').count(),5);
  assert.match(await page.locator('#editorial-sources').textContent(),new RegExp(read('data/fuel-price.json').price_as_of));
  assert(!/TODO|준비 중|2026년형/.test(await page.locator('.model-editorial').allTextContents().then(x=>x.join(''))));
  if([390,1280].includes(width)){fs.mkdirSync('output/review/model-editorial',{recursive:true});await page.screenshot({path:`output/review/model-editorial/santafe-${width}.png`,fullPage:true});}
  await page.close();
 }
 const page=await newQaPage(browser);await page.goto(base+'/'+model.path);
 await page.locator('#pm-variant').selectOption('santafe-mx5-7');
 const a=model.variants.find(v=>v.id==='santafe-mx5-7');
 assert.equal(await page.locator('#pm-energy').textContent(),won(20000/a.combined[0]*price));
 console.log('PASS Santa Fe editorial: 4 exact rows, source date, 18 retained specs, no-JS, 5 widths, calculator agreement.');
}finally{await browser.close();}

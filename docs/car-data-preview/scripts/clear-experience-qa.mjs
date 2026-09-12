import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import '../assets/cost-math.js';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const data=await fetch(base+'/data/generated/all-car-calc-index.json').then(r=>r.json());
const source=new Map(data.rows.map(r=>[r.calc_id,r]));
const rankTypes=[['fuel-economy','gasoline'],['hybrid-fuel-economy','hybrid'],['ev-efficiency','electric']];
const costRankTypes=['annual-energy-cost','car-tax'];
const bodyStyleData=JSON.parse(fs.readFileSync(new URL('../data/body-style-reviewed.json',import.meta.url),'utf8'));
const bodyStyles=new Map(bodyStyleData.records.map(record=>[record.family_id,record.body_style]));
const segmentRankTypes=[
  ['suv-fuel-economy','suv',new Set(['gasoline','diesel','lpg','hybrid'])],
  ['sedan-fuel-economy','sedan',new Set(['gasoline','diesel','lpg','hybrid'])],
  ['electric-suv-efficiency','suv',new Set(['electric'])]
];
for(const [slug,fuel] of rankTypes){
  const response=await fetch(`${base}/rankings/${slug}/`);assert(response.ok);
  const html=await response.text(),ids=[...html.matchAll(/data-calc-id="([^"]+)"/g)].map(m=>m[1]);
  assert(ids.length>10);assert.equal(new Set(ids).size,ids.length);assert.match(html,/과거 연식 포함/);assert.match(html,/noindex/);
  const eligible=data.rows.filter(r=>r.normalization_status==='reviewed_override'&&r.vehicle_class==='승용차'&&r.powertrain===fuel&&r.energy_cost_ready&&Number.isFinite(r.combined_efficiency)&&r.combined_efficiency>0);
  const maxima=new Map();for(const r of eligible)maxima.set(r.family_id,Math.max(maxima.get(r.family_id)||0,r.combined_efficiency));
  assert.equal(ids.length,maxima.size);
  const selected=ids.map(id=>source.get(id));assert(selected.every(Boolean));assert.equal(new Set(selected.map(r=>r.family_id)).size,selected.length);
  for(const [i,r] of selected.entries()){assert.equal(r.combined_efficiency,maxima.get(r.family_id));if(i)assert(selected[i-1].combined_efficiency>=r.combined_efficiency);}
  const ranks=[...html.matchAll(/data-rank="(\d+)"/g)].map(m=>Number(m[1]));
  selected.forEach((r,i)=>assert.equal(ranks[i],1+selected.filter(other=>other.combined_efficiency>r.combined_efficiency).length));
}
for(const [slug,style,fuels] of segmentRankTypes){
  const response=await fetch(`${base}/rankings/${slug}/`);assert(response.ok);
  const html=await response.text(),ids=[...html.matchAll(/data-calc-id="([^"]+)"/g)].map(match=>match[1]);
  assert(ids.length>1);assert.equal(new Set(ids).size,ids.length);assert.match(html,/제조사 공식 분류/);assert.match(html,/noindex/);
  assert.equal((html.match(/rank-body-sources/g)||[]).length,1);
  const selected=ids.map(id=>source.get(id));assert(selected.every(Boolean));
  for(const [index,row] of selected.entries()){
    assert.equal(bodyStyles.get(row.family_id),style);assert(fuels.has(row.powertrain));
    const classification=bodyStyleData.records.find(record=>record.family_id===row.family_id);assert(classification);assert(html.includes(classification.source_url.replaceAll('&','&amp;')));
    if(index)assert(selected[index-1].combined_efficiency>=row.combined_efficiency);
  }
}
for(const slug of costRankTypes){
  const response=await fetch(`${base}/rankings/${slug}/`);assert(response.ok);
  const html=await response.text(),articles=[...html.matchAll(/<article class="rank-row"[^>]+>/g)].map(m=>m[0]),ids=articles.map(a=>a.match(/data-calc-id="([^"]+)"/)[1]),values=articles.map(a=>Number(a.match(/data-metric-value="([^"]+)"/)[1]));
  assert(ids.length>10);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,values.length);assert(values.every(v=>Number.isFinite(v)&&v>0));
  for(let i=1;i<values.length;i++)assert(values[i-1]<=values[i]);
  ids.forEach((id,i)=>{const r=source.get(id);assert(r);const expected=slug==='annual-energy-cost'?20000/r.combined_efficiency*data.fuel_price.prices[r.powertrain==='hybrid'?'gasoline':r.powertrain]:CAR_COST_MATH.annualTax(r.displacement_cc,false,'2026-01',2026).total;assert(Math.abs(values[i]-expected)<.01);});
  assert.match(html,/과거 연식 포함/);assert.match(html,/noindex/);assert.match(html,/cost-ranking/);
}
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{headless:true});
try{
  for(const width of [375,390,430,1280]){
    const page=await newQaPage(browser,{viewport:{width,height:900}});
    const paths=['/','/cars/','/cars/family/?id=kia-sorento','/recalls/?q=그랜저%20GN7',...rankTypes.map(([s])=>'/rankings/'+s+'/'),...costRankTypes.map(s=>'/rankings/'+s+'/'),...segmentRankTypes.map(([s])=>'/rankings/'+s+'/')];
    for(const p of paths){
      await page.goto(base+p,{waitUntil:'networkidle'});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${p}: overflow`);
      assert.equal(await page.locator('h1').count(),1);
      const text=await page.locator('body').innerText();
      for(const term of ['연결 공지','검수 완료 계산 상세','내 차가 실제 대상인지','차량번호·VIN 공식 확인','같은 20,000km로'])assert(!text.includes(term),`${p}: ${term}`);
      assert.equal(await page.locator('.recall-aside').count(),0);
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    }
    await page.goto(base+'/cars/',{waitUntil:'networkidle'});
    if(width<1000){
      assert.equal(await page.locator('.catalog-extra').getAttribute('open'),null);
      await page.locator('.catalog-extra summary').click();
      await page.locator('[data-origin="domestic"]').click();
      assert.equal(new URL(page.url()).searchParams.get('origin'),'domestic');
    }else{
      const sidebar=await page.locator('.catalog-toolbar').boundingBox(),grid=await page.locator('#catalogGrid').boundingBox();assert(sidebar.x+sidebar.width<grid.x);
    }
    await page.goto(base+'/cars/family/?id=kia-sorento',{waitUntil:'networkidle'});
    const generations=page.locator('details.generation');assert(await generations.count()>0);
    assert.equal(await generations.first().getAttribute('open'),null);await generations.first().locator('summary').click();assert(await generations.first().locator('.raw-row').first().isVisible());
    await page.goto(base+'/',{waitUntil:'networkidle'});
    assert.equal(await page.locator('.home-car').count(),6);
    await page.getByRole('searchbox',{name:'차종 또는 제조사'}).fill('쏘렌토');await page.getByRole('button',{name:'검색',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');assert.equal(await page.locator('#catalogSearch').inputValue(),'쏘렌토');
    if(process.env.CAR_QA_SCREENSHOTS){fs.mkdirSync('output/playwright',{recursive:true});await page.goto(base+'/rankings/hybrid-fuel-economy/',{waitUntil:'networkidle'});await page.screenshot({path:`output/playwright/clear-ranking-${width}.png`,fullPage:false});}
    await page.close();
  }
  console.log('PASS clear experience: eight rankings; ties, official body-style segments and coverage; concise copy; four-width layouts, search, filters, generation panels and noindex.');
}finally{await browser.close();}

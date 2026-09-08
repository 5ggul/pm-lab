import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import '../assets/metric-charts.js';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const photos=read('data/vehicle-image-sources.json').records,calc=read('data/generated/all-car-calc-index.json').rows;
for(const value of [null,-1,Infinity])assert.equal(CAR_METRIC_CHARTS.bars({title:'x',rows:[{label:'A',values:[value]},{label:'B',values:[1]}]}),'');
const zero=CAR_METRIC_CHARTS.bars({title:'x',rows:[{label:'A',values:[0]},{label:'B',values:[0]}]});assert(zero.includes('연간 비용이 같습니다')&&!zero.includes('NaN'));
const crossing=CAR_METRIC_CHARTS.bars({title:'x',stacked:true,rows:[{label:'A',values:[100,200]},{label:'B',values:[150,100]}]});assert(crossing.includes('data-metric-max="350"')&&crossing.includes('data-change="50"')&&crossing.includes('data-change="-100"'));
fs.mkdirSync('output/review/metric-visuals',{recursive:true});
const browser=await chromium.launch();
async function geometry(page){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
 for(const chart of await page.locator('.metric-chart').all()){
  const max=Number(await chart.getAttribute('data-metric-max'));assert(max>0);
  for(const row of await chart.locator('.metric-row').all()){
   const total=Number(await row.getAttribute('data-metric-total'));
   const parts=await row.locator('.metric-fill').evaluateAll(nodes=>nodes.map(n=>({value:Number(n.dataset.value),width:parseFloat(n.style.height)})));
   assert(Math.abs(parts.reduce((s,p)=>s+p.value,0)-total)<.001);
   for(const p of parts)assert(Math.abs(p.width-p.value/max*100)<.001);
  }
  for(const bridge of await chart.locator('.metric-change').all()){
   const before=Number(await bridge.getAttribute('data-before')),after=Number(await bridge.getAttribute('data-after'));
   const delta=Number(await bridge.getAttribute('data-change'));assert(Math.abs(after-before-delta)<.001);
   const size=await bridge.locator('.metric-bridge').evaluate(e=>({height:parseFloat(e.style.height),bottom:parseFloat(e.style.bottom)}));
   assert(Math.abs(size.height-Math.abs(delta)/max*100)<.001);assert(Math.abs(size.bottom-Math.min(before,after)/max*100)<.001);
  }
 }
}
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const slug of ['fuel-economy','hybrid-fuel-economy','ev-efficiency']){
   await page.goto(`${base}/rankings/${slug}/`);
   const rows=page.locator('.rank-row');assert(await rows.count()>0);
   for(const row of await rows.all()){
    const id=await row.getAttribute('data-calc-id'),r=calc.find(r=>r.calc_id===id),p=photos.find(p=>p.family_id===r.family_id);
    const img=row.locator('.rank-photo img');await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());
    assert.equal(await img.getAttribute('src'),p.image_url);assert(await row.locator(`a[href="${p.license_url}"]`).count());
    assert.equal(Number(await row.locator('.rank-meter').getAttribute('data-efficiency')),r.combined_efficiency);
    assert.match(await img.evaluate(i=>i.currentSrc),/vehicle-images\/.*\.webp/);
   }
   await geometry(page);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`output/review/metric-visuals/${slug}-${width}.png`});
  }
  for(const slug of ['tucson-gasoline-vs-hybrid','ioniq5-vs-ev6','grandeur-vs-k8']){
   await page.goto(`${base}/compare/${slug}/`);assert.equal(await page.locator('.metric-chart').count(),slug.startsWith('tucson')?3:2);await geometry(page);
   if(slug.startsWith('tucson')){
    await page.locator('#decision-km').fill('10000');await page.locator('#decision-price').fill('1800');
    const totals=await page.locator('.metric-live .metric-row').evaluateAll(rs=>rs.map(r=>Number(r.dataset.metricTotal)));
    assert(Math.abs(totals[0]-(10000/12.5*1800+290836))<.01);assert(Math.abs(totals[1]-(10000/16.2*1800+290836))<.01);
    await page.locator('#decision-price').fill('');assert.equal(await page.locator('.metric-live .metric-chart').count(),0);
    await page.locator('#decision-price').fill('1800');assert.equal(await page.locator('.metric-live .metric-chart').count(),1);
   }
   await page.locator('.metric-chart').first().scrollIntoViewIfNeeded();await page.screenshot({path:`output/review/metric-visuals/${slug}-${width}.png`});
  }
  await page.goto(`${base}/compare/?mode=reviewed&a=grandeur-gn7&av=gn7-g25-2wd-18&b=k8-gl3&bv=k8-g25-2wd-17`);
  await page.locator('.metric-live .metric-chart').waitFor();await page.locator('#km').fill('10000');await page.locator('#gas').fill('1800');await geometry(page);
  assert.equal(await page.locator('.metric-live .metric-row').count(),2);
  await page.locator('#km').fill('');assert.equal(await page.locator('.metric-live .metric-chart').count(),0);
  await page.locator('#km').fill('20000');await page.locator('#carB').selectOption('ioniq5-ne');assert.equal(await page.locator('.metric-live .metric-chart').count(),0);
  await page.locator('#elec').fill('300');assert.equal(await page.locator('.metric-live .metric-chart').count(),1);
  assert.equal(await page.locator('.metric-live [data-metric-unit="km/L"]').count(),0,'mixed energy must not share an efficiency axis');
  const partial=calc.find(r=>r.family_id==='kia-morning'&&r.energy_cost_ready&&!r.tax_ready&&r.powertrain==='gasoline');
  await page.goto(`${base}/compare/?fa=${partial.family_id}&fb=${partial.family_id}&ra=${encodeURIComponent(partial.calc_id)}&rb=${encodeURIComponent(partial.calc_id)}&km=20000&gas=1800`);
  await page.locator('.metric-live .metric-chart').waitFor();assert.match(await page.locator('.metric-live .metric-chart').textContent(),/자동차세는 계산 조건이 부족해 제외/);
  assert.equal(await page.locator('.metric-live .metric-part-1').count(),0,'missing tax must not become a zero tax segment');
  assert.deepEqual(errors,[]);await page.close();
 }
 const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await nojs.goto(base+'/rankings/fuel-economy/');await nojs.locator('.rank-photo img').first().evaluate(i=>i.decode());assert(await nojs.locator('.rank-meter').count()>0);
 await nojs.goto(base+'/compare/tucson-gasoline-vs-hybrid/');assert.equal(await nojs.locator('.metric-chart').count(),2);await geometry(nojs);await nojs.close();
 const broken=await browser.newPage();await broken.route('**/assets/vehicle-images/**',r=>r.abort());await broken.route(/https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//,r=>r.abort());await broken.goto(base+'/rankings/fuel-economy/');await broken.locator('.rank-photo .pilot-photo-failed').first().waitFor();assert(await broken.locator('.rank-value').count()>0);await broken.close();
 console.log('PASS 54 licensed ranking photos; zero-baseline charts; exact costs; live edits, missing prices, mixed energy, no-JS and mobile.');
}finally{await browser.close()}

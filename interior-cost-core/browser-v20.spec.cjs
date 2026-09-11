const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const ready=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-readiness-v20.json'),'utf8'));
const stats=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-material-stats-v20.json'),'utf8'));
const compare=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-quote-compare-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-browser');fs.mkdirSync(outDir,{recursive:true});
const route=p=>p.replace(/index\.html$/,'');
const url=p=>`${BASE}/${route(p)}`;
async function inspect(browser,vp){
  const issues=[],rows=[];
  for(const p of ready.browser_routes){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
    try{
      const started=Date.now(),response=await page.goto(url(p),{waitUntil:'domcontentloaded',timeout:8000});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1',null,{timeout:3000});
      const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,main:Boolean(document.querySelector('main#main-content')),skip:Boolean(document.querySelector('a[href="#main-content"]')),v20:document.body?.dataset?.v20Ready==='1'}));
      const row={viewport:vp.name,path:p,status:response?.status()||0,elapsed_ms:Date.now()-started,...m,errors};rows.push(row);
      if(row.status>=400||row.overflow||row.h1!==1||!row.main||!row.skip||!row.v20||errors.length)issues.push(row);
    }catch(e){issues.push({viewport:vp.name,path:p,type:'exception',message:e.message})}finally{await context.close()}
  }
  fs.writeFileSync(path.join(outDir,`${vp.name}-audit.json`),JSON.stringify({version:'20.2.0',checked:rows.length,issues,rows},null,2));return {rows,issues};
}
test('v20 material pages pass mobile Chromium audit',async({browser})=>{test.setTimeout(120000);const x=await inspect(browser,{name:'mobile',width:390,height:844});expect(x.rows).toHaveLength(ready.browser_routes.length);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});
test('v20 material pages pass desktop Chromium audit',async({browser})=>{test.setTimeout(120000);const x=await inspect(browser,{name:'desktop',width:1440,height:900});expect(x.rows).toHaveLength(ready.browser_routes.length);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});
test('official material calculator uses selected distribution and user quantity',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:390,height:844});await page.goto(url('data/g2b-materials/calculator/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const g=stats.groups.find(x=>x.term==='타일'&&x.normalized_unit==='㎡')||stats.groups[0];expect(g).toBeTruthy();
  await page.locator('[data-v20-group]').selectOption(`${g.term}|${g.normalized_unit}`);await page.locator('[data-v20-qty]').fill('10');
  const expected=(g.median_price_krw*10).toLocaleString('ko-KR');await expect(page.locator('[data-v20-median]')).toHaveText(`${expected}원`);await expect(page.locator('[data-v20-calc-note]')).toContainText(`N=${g.record_count}`);
  fs.writeFileSync(path.join(outDir,'calculator-audit.json'),JSON.stringify({version:'20.2.0',passed:true,group:`${g.term}|${g.normalized_unit}`,quantity:10,median_total:g.median_price_krw*10},null,2));
});
test('official reference quote comparison filters by unit and makes no price judgment',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:390,height:844});await page.goto(url('data/g2b-quote-compare/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const unitRow=compare.units.find(x=>x.unit_key==='㎡'&&x.source_count>=2)||compare.units.find(x=>x.source_count>=2)||compare.units[0];expect(unitRow).toBeTruthy();
  await page.locator('[data-v20-compare-unit]').selectOption(unitRow.unit_key);await page.locator('[data-v20-user-price]').fill('50000');await page.locator('[data-v20-compare-qty]').fill('10');
  const chosen={};
  for(const source of ['material','market','standard']){
    const ref=compare.references.find(x=>x.source===source&&x.unit_key===unitRow.unit_key);if(!ref)continue;
    chosen[source]=ref;await page.locator(`[data-v20-ref-${source}]`).selectOption(ref.id);
  }
  expect(Object.keys(chosen).length).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-v20-compare-output]')).toContainText('500,000원');
  await expect(page.locator('[data-v20-compare-note]')).toContainText('가격 적정성 판정이 아닙니다');
  await expect(page.locator('[data-v20-quote-compare]')).toHaveAttribute('data-v20-compare-judgment','none');
  await expect(page.locator('[data-v20-compare-row="user"]')).toHaveCount(1);
  for(const [source,ref] of Object.entries(chosen)){
    await expect(page.locator(`[data-v20-compare-row="${source}"]`)).toContainText(ref.label);
    expect(ref.unit_key).toBe(unitRow.unit_key);
  }
  fs.writeFileSync(path.join(outDir,'quote-compare-audit.json'),JSON.stringify({version:'20.2.0',passed:true,unit:unitRow.unit_key,user_unit_price:50000,quantity:10,chosen:Object.fromEntries(Object.entries(chosen).map(([k,v])=>[k,v.id])),same_unit_only:true,automatic_price_judgment:false},null,2));
});
test('representative v20 screenshots are captured',async({browser})=>{test.setTimeout(60000);const shots=[['data/g2b-materials/index.html','mobile-g2b-hub.png',390,844],['data/g2b-materials/tile/index.html','mobile-tile.png',390,844],['data/g2b-materials/calculator/index.html','mobile-g2b-calculator.png',390,844],['data/g2b-materials/calculator/index.html','desktop-g2b-calculator.png',1440,900],['data/g2b-quote-compare/index.html','mobile-g2b-quote-compare.png',390,844],['data/g2b-quote-compare/index.html','desktop-g2b-quote-compare.png',1440,900]];for(const [p,name,w,h] of shots){const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');await page.screenshot({path:path.join(outDir,name),fullPage:true});await c.close()}for(const [,name] of shots)expect(fs.existsSync(path.join(outDir,name))).toBeTruthy()});

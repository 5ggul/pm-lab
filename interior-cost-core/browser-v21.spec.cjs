const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'data','v21-browser-contract.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(ROOT,'data','reference-compare-config-v21.json'),'utf8'));
const outDir=path.resolve('artifacts/v21-browser');fs.mkdirSync(outDir,{recursive:true});
const route=p=>p.replace(/index\.html$/,'');
const url=p=>`${BASE}/${route(p)}`;

async function inspect(browser,vp){
  const issues=[],rows=[];
  for(const p of contract.routes){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
    page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
    try{
      const started=Date.now();const response=await page.goto(url(p),{waitUntil:'domcontentloaded',timeout:8000});
      await page.waitForFunction(()=>document.body?.dataset?.v21Ready==='1',null,{timeout:3000});
      const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,main:Boolean(document.querySelector('main#main-content')),skip:Boolean(document.querySelector('a[href="#main-content"]')),v21:document.body?.dataset?.v21Ready==='1'}));
      const row={viewport:vp.name,path:p,status:response?.status()||0,elapsed_ms:Date.now()-started,...m,errors};rows.push(row);
      if(row.status>=400||row.overflow||row.h1!==1||!row.main||!row.skip||!row.v21||errors.length)issues.push(row);
    }catch(e){issues.push({viewport:vp.name,path:p,type:'exception',message:e.message})}finally{await context.close()}
  }
  fs.writeFileSync(path.join(outDir,`${vp.name}-audit.json`),JSON.stringify({version:'21.0.0',checked:rows.length,issues,rows},null,2));
  return {rows,issues};
}

test('v21 routes pass mobile Chromium audit',async({browser})=>{test.setTimeout(150000);const x=await inspect(browser,{name:'mobile',width:390,height:844});expect(x.rows).toHaveLength(contract.routes.length);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});
test('v21 routes pass desktop Chromium audit',async({browser})=>{test.setTimeout(150000);const x=await inspect(browser,{name:'desktop',width:1440,height:900});expect(x.rows).toHaveLength(contract.routes.length);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});

test('reference-layer difference remains locked until comparison conditions are confirmed',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:390,height:844});await page.goto(url('compare/reference-layers/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v21Ready==='1');
  const trade=config.trades.find(x=>Array.isArray(x.public_refs)&&x.public_refs.length)||config.trades[0];expect(trade).toBeTruthy();expect(trade.public_refs.length).toBeGreaterThan(0);
  await page.locator('[data-v21-trade]').selectOption(trade.id);await page.locator('[data-v21-qty]').fill('10');await page.locator('[data-v21-quote-rate]').fill(String(trade.public_refs[0].price+1000));
  await page.locator('[data-v21-reference]').selectOption(trade.public_refs[0].code);
  await expect(page.locator('[data-v21-diff]')).toHaveAttribute('data-state','blocked');
  await page.locator('[data-v21-same-unit]').check();await page.locator('[data-v21-same-scope]').check();await page.locator('[data-v21-same-material]').check();
  await expect(page.locator('[data-v21-diff]')).toHaveAttribute('data-state','ready');await expect(page.locator('[data-v21-diff]')).not.toContainText('잠금');
  fs.writeFileSync(path.join(outDir,'reference-interaction.json'),JSON.stringify({version:'21.0.0',passed:true,trade:trade.id,reference_code:trade.public_refs[0].code,quote_rate:trade.public_refs[0].price+1000},null,2));
});

test('32-pyeong wallpaper route calculates only from entered work area',async({page})=>{
  test.setTimeout(30000);const p='interior-cost/matrix/32-pyeong/wallpaper/index.html';await page.setViewportSize({width:390,height:844});await page.goto(url(p),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v21Ready==='1');
  await expect(page.locator('[data-v21-route-note]')).toContainText('실제 작업면적');await page.locator('[data-v21-route-qty]').fill('10');
  const result=page.locator('[data-v21-route-results]');await expect(result).toContainText('REFERENCE');await expect(result).toContainText('OFFICIAL MATERIAL');await expect(page.locator('[data-v21-route-note]')).toContainText('입력 수량 10');
  fs.writeFileSync(path.join(outDir,'matrix-interaction.json'),JSON.stringify({version:'21.0.0',passed:true,path:p,quantity:10,does_not_infer_from_pyeong:true},null,2));
});

test('representative v21 screenshots are captured',async({browser})=>{test.setTimeout(60000);const shots=[['interior-cost/matrix/index.html','mobile-matrix.png',390,844],['compare/reference-layers/index.html','mobile-reference-tool.png',390,844],['interior-cost/matrix/32-pyeong/wallpaper/index.html','mobile-32-wallpaper.png',390,844],['compare/reference-layers/index.html','desktop-reference-tool.png',1440,900]];for(const [p,name,w,h] of shots){const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v21Ready==='1');await page.screenshot({path:path.join(outDir,name),fullPage:true});await c.close()}for(const [,name] of shots)expect(fs.existsSync(path.join(outDir,name))).toBeTruthy()});

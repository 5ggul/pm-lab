const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'data','v22-browser-contract.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(ROOT,'data','v22-quote-lines-config.json'),'utf8'));
const outDir=path.resolve('artifacts/v22-browser');fs.mkdirSync(outDir,{recursive:true});
const route=p=>p.replace(/index\.html$/,'');
const url=p=>`${BASE}/${route(p)}`;

async function audit(browser,name,width,height){
  const issues=[],rows=[];
  for(const p of contract.routes){
    const c=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await c.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
    try{
      const started=Date.now(),response=await page.goto(url(p),{waitUntil:'domcontentloaded',timeout:8000});await page.waitForFunction(()=>document.body?.dataset?.v22Ready==='1',null,{timeout:3000});
      const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,main:Boolean(document.querySelector('main#main-content')),skip:Boolean(document.querySelector('a[href="#main-content"]')),ready:document.body?.dataset?.v22Ready==='1',lines:document.querySelectorAll('[data-v22-line]').length}));
      const row={viewport:name,path:p,status:response?.status()||0,elapsed_ms:Date.now()-started,...m,errors};rows.push(row);if(row.status>=400||row.overflow||row.h1!==1||!row.main||!row.skip||!row.ready||row.lines!==3||errors.length)issues.push(row);
    }catch(e){issues.push({viewport:name,path:p,type:'exception',message:e.message})}finally{await c.close()}
  }
  fs.writeFileSync(path.join(outDir,`${name}-audit.json`),JSON.stringify({version:'22.0.0',rows,issues},null,2));return {rows,issues};
}

test('v22 multi-line page passes mobile Chromium audit',async({browser})=>{const x=await audit(browser,'mobile',390,844);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});
test('v22 multi-line page passes desktop Chromium audit',async({browser})=>{const x=await audit(browser,'desktop',1440,900);expect(x.issues,JSON.stringify(x.issues,null,2)).toEqual([])});

test('v22 narrows official candidates by trade and same unit across multiple quote lines',async({page})=>{
  test.setTimeout(40000);await page.setViewportSize({width:390,height:844});await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v22Ready==='1');
  await page.locator('[data-v22-pyeong]').selectOption('32');
  const lines=page.locator('[data-v22-line]');expect(await lines.count()).toBe(3);
  const wallpaper=config.trades.find(x=>x.id==='wallpaper'),carpentry=config.trades.find(x=>x.id==='carpentry');expect(wallpaper).toBeTruthy();expect(carpentry).toBeTruthy();expect(wallpaper.units).toContain('㎡');expect(carpentry.units).toContain('㎡');

  const line1=lines.nth(0);await line1.locator('[data-v22-item-name]').fill('거실 벽지');await line1.locator('[data-v22-trade]').selectOption('wallpaper');await expect(line1.locator('[data-v22-unit]')).toHaveValue('㎡');await line1.locator('[data-v22-qty]').fill('10');await line1.locator('[data-v22-price]').fill('50000');
  const wMaterial=(wallpaper.candidate_ids.material||[]).map(id=>config.references[id]).find(r=>r&&r.unit_key==='㎡');expect(wMaterial).toBeTruthy();await line1.locator('[data-v22-ref-material]').selectOption(wMaterial.id);await expect(line1.locator('[data-v22-line-result]')).toContainText('조건 확인 전');await line1.locator('[data-v22-confirm]').check();await expect(line1.locator('[data-v22-line-result]')).not.toContainText('조건 확인 전');await expect(line1.locator('[data-v22-line-route]')).toContainText('32평 도배');

  const line2=lines.nth(1);await line2.locator('[data-v22-item-name]').fill('석고보드 가벽');await line2.locator('[data-v22-trade]').selectOption('carpentry');await line2.locator('[data-v22-unit]').selectOption('㎡');await line2.locator('[data-v22-qty]').fill('5');await line2.locator('[data-v22-price]').fill('30000');
  const cStd=(carpentry.candidate_ids.standard||[]).map(id=>config.references[id]).find(r=>r&&r.unit_key==='㎡');expect(cStd).toBeTruthy();await line2.locator('[data-v22-ref-standard]').selectOption(cStd.id);await line2.locator('[data-v22-confirm]').check();

  await expect(page.locator('[data-v22-user-sum]')).toHaveText('650,000원');await expect(page.locator('[data-v22-user-coverage]')).toHaveText('2개 행');
  const selectedUnits=await page.evaluate(()=>[...document.querySelectorAll('[data-v22-line]')].slice(0,2).map(line=>({unit:line.querySelector('[data-v22-unit]')?.value,material:line.querySelector('[data-v22-ref-material]')?.value,standard:line.querySelector('[data-v22-ref-standard]')?.value})));
  for(const x of selectedUnits){for(const id of [x.material,x.standard].filter(Boolean))expect(config.references[id].unit_key).toBe(x.unit)}
  await page.locator('[data-v22-add-line]').click();expect(await page.locator('[data-v22-line]').count()).toBe(4);await page.locator('[data-v22-line]').nth(3).locator('[data-v22-remove-line]').click();expect(await page.locator('[data-v22-line]').count()).toBe(3);
  fs.writeFileSync(path.join(outDir,'multi-line-interaction.json'),JSON.stringify({version:'22.0.0',passed:true,pyeong:32,user_total:650000,wallpaper_reference:wMaterial.id,carpentry_reference:cStd.id,same_unit_verified:true,no_pyeong_quantity_inference:true},null,2));
});

test('v22 representative screenshots are captured',async({browser})=>{test.setTimeout(60000);for(const [name,w,h] of [['mobile-quote-lines.png',390,844],['desktop-quote-lines.png',1440,900]]){const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v22Ready==='1');await page.locator('[data-v22-pyeong]').selectOption('32');const line=page.locator('[data-v22-line]').first();await line.locator('[data-v22-trade]').selectOption('wallpaper');await line.locator('[data-v22-qty]').fill('10');await line.locator('[data-v22-price]').fill('50000');const t=config.trades.find(x=>x.id==='wallpaper');const r=(t.candidate_ids.material||[]).map(id=>config.references[id]).find(x=>x&&x.unit_key==='㎡');if(r)await line.locator('[data-v22-ref-material]').selectOption(r.id);await page.screenshot({path:path.join(outDir,name),fullPage:true});await c.close()}for(const n of ['mobile-quote-lines.png','desktop-quote-lines.png'])expect(fs.existsSync(path.join(outDir,n))).toBeTruthy()});

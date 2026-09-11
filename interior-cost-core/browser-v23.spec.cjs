const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const outDir=path.resolve('artifacts/v23-browser');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${p.replace(/index\.html$/,'')}`;

test('v23 quote import page passes mobile and desktop audit',async({browser})=>{
  test.setTimeout(60000);
  for(const vp of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
    const c=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await c.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    const r=await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
    const meta=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,importer:Boolean(document.querySelector('[data-v23-import]')),noindex:(document.querySelector('meta[name="robots"]')?.content||'').includes('noindex')}));
    expect(r.status()).toBeLessThan(400);expect(meta.overflow).toBeFalsy();expect(meta.h1).toBe(1);expect(meta.importer).toBeTruthy();expect(meta.noindex).toBeTruthy();expect(errors).toEqual([]);await c.close();
  }
});

test('CSV paste fills two quote lines without auto-selecting official references',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:390,height:844});await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
  await page.locator('[data-v22-pyeong]').selectOption('32');
  const csv='항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드 목공,목공,㎡,5,30000';
  await page.locator('[data-v23-import-text]').fill(csv);await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-status]')).toContainText('2개 행 분석');await expect(page.locator('[data-v23-preview] tbody tr')).toHaveCount(2);
  await page.locator('[data-v23-apply]').click();
  const lines=page.locator('[data-v22-line]');await expect(lines).toHaveCount(2);
  await expect(lines.nth(0).locator('[data-v22-trade]')).toHaveValue('wallpaper');await expect(lines.nth(1).locator('[data-v22-trade]')).toHaveValue('carpentry');
  await expect(lines.nth(0).locator('[data-v22-unit]')).toHaveValue('㎡');await expect(lines.nth(1).locator('[data-v22-unit]')).toHaveValue('㎡');
  await expect(lines.nth(0).locator('[data-v22-confirm]')).not.toBeChecked();await expect(lines.nth(1).locator('[data-v22-confirm]')).not.toBeChecked();
  for(const line of [lines.nth(0),lines.nth(1)])for(const sel of ['[data-v22-ref-material]','[data-v22-ref-market]','[data-v22-ref-standard]'])await expect(line.locator(sel)).toHaveValue('');
  await expect(page.locator('[data-v22-user-sum]')).toHaveText('650,000원');
  fs.writeFileSync(path.join(outDir,'csv-import.json'),JSON.stringify({passed:true,rows:2,pyeong:'32',user_sum:650000,official_reference_auto_selected:false,scope_auto_confirmed:false},null,2));
});

test('CSV total column derives unit price only when quantity is present',async({page})=>{
  await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
  await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,금액\n타일 시공,욕실,㎡,10,600000');await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-preview]')).toContainText('총액÷수량 단가');await page.locator('[data-v23-apply]').click();
  await expect(page.locator('[data-v22-line]').first().locator('[data-v22-price]')).toHaveValue('60000');
});

test('representative v23 screenshots are captured',async({browser})=>{test.setTimeout(60000);for(const [name,w,h] of [['mobile-import.png',390,844],['desktop-import.png',1440,900]]){const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();await page.goto(url('compare/quote-lines/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드,목공,㎡,5,30000');await page.locator('[data-v23-parse]').click();await page.screenshot({path:path.join(outDir,name),fullPage:true});await c.close()}expect(fs.existsSync(path.join(outDir,'mobile-import.png'))).toBeTruthy();expect(fs.existsSync(path.join(outDir,'desktop-import.png'))).toBeTruthy()});

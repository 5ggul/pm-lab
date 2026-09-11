const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE=process.env.V24_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const outDir=path.resolve('artifacts/v24-browser');fs.mkdirSync(outDir,{recursive:true});
const pyeongs=[24,30,32,34,40];

async function auditPage(page,url,ready){
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
  const res=await page.goto(url,{waitUntil:'domcontentloaded'});
  if(ready)await page.waitForFunction(key=>document.body?.dataset?.[key]==='1',ready);
  const meta=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
    h1:document.querySelectorAll('h1').length,
    robots:document.querySelector('meta[name="robots"]')?.content||''
  }));
  expect(res&&res.ok()).toBeTruthy();
  expect(meta.overflow).toBeFalsy();
  expect(meta.h1).toBe(1);
  expect(meta.robots).toContain('noindex');
  expect(errors).toEqual([]);
}

for(const viewport of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
  test.describe(`v24 integrated insulation ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    for(const p of pyeongs){
      test(`${p}p insulation keeps editorial/reference layer`,async({page})=>{
        const url=`${BASE}/interior-cost/matrix/${p}-pyeong/insulation/`;
        await auditPage(page,url);
        await expect(page.locator('[data-v23-insulation]')).toBeVisible();
        await expect(page.locator('[data-v23-faq-list] article')).toHaveCount(3);
        await expect(page.locator('table.v21-ownership').first().locator('tbody tr')).toHaveCount(8);
        const cfg=await page.locator('script[data-v21-route-config]').evaluate(n=>JSON.parse(n.textContent));
        expect(cfg.public_refs).toHaveLength(8);
        expect(cfg.materials.length).toBeGreaterThan(0);
      });
    }
  });
}

test('v24 matrix hub keeps all 25 routes and quote entry',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await auditPage(page,`${BASE}/interior-cost/matrix/`);
  await expect(page.locator('[data-v23-release-note]')).toBeVisible();
  await expect(page.locator('body')).toContainText('25개 모두 데이터·편집 검수 후보');
  await expect(page.locator('a.v21-route-link')).toHaveCount(25);
  await expect(page.locator('a.v21-route-link.v21-hold')).toHaveCount(0);
  await expect(page.locator('[data-v22-quote-lines-entry]')).toBeVisible();
  await expect(page.locator('[data-v22-quote-lines-entry] a[href*="/compare/quote-lines/"]')).toHaveCount(1);
});

test('v24 quote importer passes mobile and desktop shell audit',async({browser})=>{
  for(const vp of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
    const c=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await c.newPage();
    await auditPage(page,`${BASE}/compare/quote-lines/`,'v23Ready');
    await expect(page.locator('[data-v23-import]')).toBeVisible();
    await expect(page.locator('[data-v22-line]')).toHaveCount(3);
    await c.close();
  }
});

test('v24 CSV import retains safe official-reference boundary',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}/compare/quote-lines/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
  await page.locator('[data-v22-pyeong]').selectOption('32');
  await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드 목공,목공,㎡,5,30000');
  await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-preview] tbody tr')).toHaveCount(2);
  await page.locator('[data-v23-apply]').click();
  const lines=page.locator('[data-v22-line]');
  await expect(lines).toHaveCount(2);
  await expect(page.locator('[data-v22-user-sum]')).toHaveText('650,000원');
  await expect(lines.nth(0).locator('[data-v22-trade]')).toHaveValue('wallpaper');
  await expect(lines.nth(1).locator('[data-v22-trade]')).toHaveValue('carpentry');
  for(const line of [lines.nth(0),lines.nth(1)]){
    await expect(line.locator('[data-v22-confirm]')).not.toBeChecked();
    for(const sel of ['[data-v22-ref-material]','[data-v22-ref-market]','[data-v22-ref-standard]'])await expect(line.locator(sel)).toHaveValue('');
  }
  const route=lines.nth(0).locator('[data-v22-line-route] a');
  await expect(route).toHaveAttribute('href',/32-pyeong\/wallpaper/);
});

test('v24 plain text and 12-row reset stay functional',async({page})=>{
  await page.goto(`${BASE}/compare/quote-lines/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
  const add=page.locator('[data-v22-add-line]');
  for(let i=3;i<12;i++)await add.click();
  await expect(page.locator('[data-v22-line]')).toHaveCount(12);
  await expect(add).toBeDisabled();
  await page.locator('[data-v23-import-text]').fill('거실 실크벽지 도배 10㎡ 50,000원');
  await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-status]')).toContainText('PLAIN · 1개 행 분석');
  await page.locator('[data-v23-apply]').click();
  await expect(page.locator('[data-v22-line]')).toHaveCount(1);
  const line=page.locator('[data-v22-line]').first();
  await expect(line.locator('[data-v22-trade]')).toHaveValue('wallpaper');
  await expect(line.locator('[data-v22-unit]')).toHaveValue('㎡');
  await expect(line.locator('[data-v22-qty]')).toHaveValue('10');
  await expect(line.locator('[data-v22-price]')).toHaveValue('50000');
  await expect(page.locator('[data-v22-user-sum]')).toHaveText('500,000원');
  await expect(add).toBeEnabled();
});

test('v24 13-row input truncates visibly at 12',async({page})=>{
  await page.goto(`${BASE}/compare/quote-lines/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
  const rows=Array.from({length:13},(_,i)=>`항목${i+1},도배,㎡,1,1000`).join('\n');
  await page.locator('[data-v23-import-text]').fill(`항목,공종,단위,수량,단가\n${rows}`);
  await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-preview] tbody tr')).toHaveCount(12);
  await expect(page.locator('[data-v23-status]')).toContainText('1개는 최대 행 수 초과로 제외');
});

test('v24 representative screenshots',async({browser})=>{
  const targets=[
    ['matrix-mobile.png',390,844,`${BASE}/interior-cost/matrix/`],
    ['insulation-desktop.png',1440,900,`${BASE}/interior-cost/matrix/32-pyeong/insulation/`],
    ['quote-mobile.png',390,844,`${BASE}/compare/quote-lines/`]
  ];
  for(const [name,w,h,url] of targets){
    const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    if(name==='quote-mobile.png'){
      await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
      await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드,목공,㎡,5,30000');
      await page.locator('[data-v23-parse]').click();
    }
    await page.screenshot({path:path.join(outDir,name),fullPage:true});
    await c.close();
  }
  for(const name of ['matrix-mobile.png','insulation-desktop.png','quote-mobile.png'])expect(fs.existsSync(path.join(outDir,name))).toBeTruthy();
});

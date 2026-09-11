const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE=process.env.V25_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const outDir=path.resolve('artifacts/v25-browser');fs.mkdirSync(outDir,{recursive:true});
const forbidden=/\bV(?:1[0-9]|2[0-9])\b|\bHOLD\b|\bRELEASE\b|프리뷰|\bPREVIEW\b|noindex|Search Console|출시 후보|검수 후보|production 전환|광고 활성화/i;

async function baseAudit(page,url,ready){
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
  const res=await page.goto(url,{waitUntil:'domcontentloaded'});
  if(ready)await page.waitForFunction(key=>document.body?.dataset?.[key]==='1',ready);
  const state=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
    h1:document.querySelectorAll('h1').length,
    robots:document.querySelector('meta[name="robots"]')?.content||'',
    bodyText:document.body.innerText
  }));
  expect(res&&res.ok()).toBeTruthy();
  expect(state.overflow).toBeFalsy();
  expect(state.h1).toBe(1);
  expect(state.robots).toContain('noindex');
  expect(state.bodyText).not.toMatch(forbidden);
  expect(errors).toEqual([]);
}

test('v25 visitor surfaces contain no release-engineering copy',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const p of ['', '/data/','/quote-check/','/quote-compare/','/calculator/','/compare/reference-layers/']){
    await baseAudit(page,`${BASE}${p}`);
  }
});

test('v25 matrix becomes readable mobile cards and filters to one route',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await baseAudit(page,`${BASE}/interior-cost/matrix/`);
  await expect(page.locator('a.v21-route-link')).toHaveCount(25);
  const first=page.locator('[data-v21-matrix-row]').first();
  const layout=await first.evaluate(el=>({
    display:getComputedStyle(el).display,
    width:el.getBoundingClientRect().width,
    font:parseFloat(getComputedStyle(el.querySelector('th')).fontSize)
  }));
  expect(layout.display).toBe('grid');
  expect(layout.width).toBeLessThanOrEqual(365);
  expect(layout.font).toBeGreaterThanOrEqual(17);
  await page.locator('[data-v21-filter-pyeong]').selectOption('32');
  await page.locator('[data-v21-filter-trade]').selectOption('insulation');
  await expect(page.locator('[data-v21-matrix-row]:visible')).toHaveCount(1);
  const link=page.locator('[data-v21-matrix-row]:visible a.v21-route-link');
  await expect(link).toHaveAttribute('href',/32-pyeong\/insulation/);
  await expect(link).toContainText('견적 기준 보기');
});

test('v25 matrix route preserves evidence and removes implementation labels',async({browser})=>{
  for(const vp of [{width:390,height:844},{width:1440,height:900}]){
    const c=await browser.newContext({viewport:vp}),page=await c.newPage();
    await baseAudit(page,`${BASE}/interior-cost/matrix/32-pyeong/insulation/`);
    await expect(page.locator('[data-v23-insulation]')).toBeVisible();
    await expect(page.locator('[data-v23-faq-list] article')).toHaveCount(3);
    await expect(page.locator('table.v21-ownership').first().locator('tbody tr')).toHaveCount(8);
    await expect(page.locator('body')).toContainText('공법·규격 확인');
    await c.close();
  }
});

test('v25 quote importer stays compact and functional on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await baseAudit(page,`${BASE}/compare/quote-lines/`,'v23Ready');
  await page.locator('[data-v22-pyeong]').selectOption('32');
  await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드 목공,목공,㎡,5,30000');
  await page.locator('[data-v23-parse]').click();
  await expect(page.locator('[data-v23-preview] tbody tr')).toHaveCount(2);
  await page.locator('[data-v23-apply]').click();
  await expect(page.locator('[data-v22-line]')).toHaveCount(2);
  await expect(page.locator('[data-v22-user-sum]')).toHaveText('650,000원');
  const grid=await page.locator('.v22-line-grid').first().evaluate(el=>({
    columns:getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
    width:el.getBoundingClientRect().width,
    inputHeight:el.querySelector('input')?.getBoundingClientRect().height||0
  }));
  expect(grid.columns).toBeGreaterThanOrEqual(2);
  expect(grid.width).toBeLessThanOrEqual(365);
  expect(grid.inputHeight).toBeGreaterThanOrEqual(40);
  const line=page.locator('[data-v22-line]').first();
  await expect(line.locator('[data-v22-confirm]')).not.toBeChecked();
  for(const sel of ['[data-v22-ref-material]','[data-v22-ref-market]','[data-v22-ref-standard]'])await expect(line.locator(sel)).toHaveValue('');
});

test('v25 fixes legacy undefined answer links',async({page})=>{
  await page.goto(`${BASE}/data/answers-v11/`,{waitUntil:'domcontentloaded'});
  expect(await page.locator('a[href="undefined"]').count()).toBe(0);
  expect(await page.locator('[href="undefined"]').count()).toBe(0);
});

test('v25 representative screenshots',async({browser})=>{
  const targets=[
    ['home-mobile-v25.png',390,844,`${BASE}/`],
    ['matrix-mobile-v25.png',390,844,`${BASE}/interior-cost/matrix/`],
    ['insulation-desktop-v25.png',1440,900,`${BASE}/interior-cost/matrix/32-pyeong/insulation/`],
    ['quote-mobile-v25.png',390,844,`${BASE}/compare/quote-lines/`]
  ];
  for(const [name,w,h,url] of targets){
    const c=await browser.newContext({viewport:{width:w,height:h}}),page=await c.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    if(name==='quote-mobile-v25.png'){
      await page.waitForFunction(()=>document.body?.dataset?.v23Ready==='1');
      await page.locator('[data-v23-import-text]').fill('항목,공종,단위,수량,단가\n실크벽지,도배,㎡,10,50000\n석고보드,목공,㎡,5,30000');
      await page.locator('[data-v23-parse]').click();
    }
    await page.screenshot({path:path.join(outDir,name),fullPage:true});
    await c.close();
  }
  for(const [name] of targets)expect(fs.existsSync(path.join(outDir,name))).toBeTruthy();
});

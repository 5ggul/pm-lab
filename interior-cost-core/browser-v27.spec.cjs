const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE=process.env.V27_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const outDir=path.resolve('artifacts/v27-browser');fs.mkdirSync(outDir,{recursive:true});

async function audit(page,url){
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
  const res=await page.goto(url,{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,h1:document.querySelectorAll('h1').length,robots:document.querySelector('meta[name="robots"]')?.content||''}));
  expect(res&&res.ok()).toBeTruthy();
  expect(state.scrollWidth).toBeLessThanOrEqual(state.width+2);
  expect(state.h1).toBe(1);
  expect(state.robots).toContain('noindex');
  expect(errors).toEqual([]);
  return state;
}

test('home has one clear senior-first task hierarchy',async({browser})=>{
  for(const vp of [{width:390,height:844},{width:1440,height:900}]){
    const ctx=await browser.newContext({viewport:vp});const page=await ctx.newPage();
    await audit(page,`${BASE}/`);
    await expect(page.locator('h1')).toHaveText('받은 인테리어 견적서, 빠진 비용부터 확인하세요');
    await expect(page.locator('.v27-home-actions a')).toHaveCount(3);
    await expect(page.locator('.v27-main-action')).toHaveText('내 견적서 확인하기');
    await expect(page.locator('.v27-quick-browse')).toContainText('어떤 정보가 필요하세요?');
    const primary=await page.locator('.v27-main-action').boundingBox();
    expect(primary&&primary.height).toBeGreaterThanOrEqual(50);
    await ctx.close();
  }
});

test('desktop header exposes three tasks and one more menu',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await audit(page,`${BASE}/`);
  const nav=page.locator('.v27-desktop-nav');
  await expect(nav.locator(':scope > a')).toHaveCount(3);
  await expect(nav.locator(':scope > details > summary')).toHaveText('더보기');
  await expect(page.locator('.header-search')).toHaveCount(0);
});

test('quote check shows all 12 statuses but hides advanced fields by default',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const state=await audit(page,`${BASE}/quote-check/`);
  await expect(page.locator('h1')).toHaveText('견적서 확인');
  const rows=page.locator('.quote-check-table .qrow');
  await expect(rows).toHaveCount(12);
  const visible=await rows.evaluateAll(rs=>rs.filter(r=>getComputedStyle(r).display!=='none').length);
  expect(visible).toBe(12);
  await expect(page.locator('.wizard-head')).toBeHidden();
  await expect(page.locator('.wizard-actions')).toBeHidden();
  await expect(page.locator('.v27-q-details')).toHaveCount(12);
  expect(await page.locator('.v27-q-details[open]').count()).toBe(0);
  await expect(rows.first()).toContainText('포함되어 있음');
  await expect(rows.first()).toContainText('별도 비용');
  await expect(rows.first()).toContainText('적혀 있지 않음');
  await page.locator('.v27-q-details summary').first().click();
  await expect(page.locator('.v27-q-details').first()).toHaveAttribute('open','');
  expect(state.height).toBeLessThan(8000);
});

test('quote compare defaults to two vendors and reveals differences before chart',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const state=await audit(page,`${BASE}/quote-compare/`);
  await expect(page.locator('h1')).toHaveText('견적 비교');
  await expect(page.locator('[data-v27-count="2"]')).toHaveAttribute('aria-pressed','true');
  const firstGrid=page.locator('.vendor-grid').first();
  const visible2=await firstGrid.locator('.vendor-cell').evaluateAll(xs=>xs.filter(x=>getComputedStyle(x).display!=='none').length);
  expect(visible2).toBe(2);
  await expect(page.locator('.v6-compare-chart')).toBeHidden();
  await expect(page.locator('.compare-top')).toBeHidden();
  await page.locator('[data-compare-row="demolition"] [data-vendor="a"][data-state]').selectOption('included');
  await expect(page.locator('[data-v27-diff-summary]')).toContainText('철거');
  await expect(page.locator('.v6-compare-chart')).toBeVisible();
  await expect(page.locator('.compare-top')).toBeVisible();
  await page.locator('[data-v27-count="3"]').click();
  const visible3=await firstGrid.locator('.vendor-cell').evaluateAll(xs=>xs.filter(x=>getComputedStyle(x).display!=='none').length);
  expect(visible3).toBe(3);
  expect(state.height).toBeLessThan(11000);
});

test('calculator asks trade first and only opens relevant rows',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await audit(page,`${BASE}/calculator/`);
  await expect(page.locator('h1')).toHaveText('인테리어 비용 계산기');
  await expect(page.locator('.v27-calc-start')).toContainText('어떤 공사를 계산하시나요?');
  const rows=page.locator('[data-budget-row]');
  expect(await rows.evaluateAll(xs=>xs.filter(x=>getComputedStyle(x).display!=='none').length)).toBe(0);
  await page.locator('[data-v27-calc-mode="bathroom"]').click();
  expect(await rows.evaluateAll(xs=>xs.filter(x=>getComputedStyle(x).display!=='none').length)).toBe(5);
  await expect(page.locator('[data-v27-calc-help]')).toContainText('욕실');
  await page.locator('[data-v27-calc-mode="all"]').click();
  expect(await rows.evaluateAll(xs=>xs.filter(x=>getComputedStyle(x).display!=='none').length)).toBe(11);
});

test('key senior pages have no horizontal overflow',async({browser})=>{
  for(const route of ['/','/quote-check/','/quote-compare/','/calculator/','/interior-cost/32-pyeong/','/cost/bathroom/']){
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
    await audit(page,`${BASE}${route}`);await ctx.close();
  }
});

test('capture v27 senior review screenshots',async({browser})=>{
  const targets=[
    ['home-mobile-v27.png',390,844,`${BASE}/`],
    ['home-desktop-v27.png',1440,900,`${BASE}/`],
    ['quote-check-mobile-v27.png',390,844,`${BASE}/quote-check/`],
    ['quote-compare-mobile-v27.png',390,844,`${BASE}/quote-compare/`],
    ['calculator-mobile-v27.png',390,844,`${BASE}/calculator/`]
  ];
  for(const [name,w,h,url] of targets){
    const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.screenshot({path:path.join(outDir,name),fullPage:true});await ctx.close();
  }
  for(const [name] of targets)expect(fs.existsSync(path.join(outDir,name))).toBeTruthy();
});

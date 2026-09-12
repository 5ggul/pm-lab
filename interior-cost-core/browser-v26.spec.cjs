const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE=process.env.V26_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const outDir=path.resolve('artifacts/v26-browser');fs.mkdirSync(outDir,{recursive:true});
const forbidden=/PRIMARY ANSWER|EVIDENCE TYPE|RELEASE CANDIDATE|PRIVATE QUOTE SAMPLE|NEXT CHECK|INDEX RELEASE|\bPREVIEW\b|\bNOINDEX\b|출시 후보|검수 후보/i;

async function audit(page,url){
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
  const res=await page.goto(url,{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>({
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    height:document.documentElement.scrollHeight,
    h1:document.querySelectorAll('h1').length,
    firstHeading:document.querySelector('h1,h2,h3,h4,h5,h6')?.tagName||'',
    robots:document.querySelector('meta[name="robots"]')?.content||'',
    text:document.body.innerText
  }));
  expect(res&&res.ok()).toBeTruthy();
  expect(state.scrollWidth).toBeLessThanOrEqual(state.width+2);
  expect(state.h1).toBe(1);
  expect(state.robots).toContain('noindex');
  expect(state.text).not.toMatch(forbidden);
  expect(errors).toEqual([]);
  return state;
}

test('home is task-first on mobile and desktop',async({browser})=>{
  for(const vp of [{width:390,height:844},{width:1440,height:900}]){
    const ctx=await browser.newContext({viewport:vp});const page=await ctx.newPage();
    const state=await audit(page,`${BASE}/`);
    expect(state.firstHeading).toBe('H1');
    await expect(page.locator('h1')).toHaveText('인테리어 견적 검사·비교');
    await expect(page.locator('.v26-primary-actions a')).toHaveCount(2);
    await expect(page.locator('.v26-primary-actions')).toContainText('견적 검사 시작');
    await expect(page.locator('.v26-primary-actions')).toContainText('3견적 비교');
    await expect(page.locator('body')).not.toContainText('실제 견적 N=0');
    await expect(page.locator('body')).not.toContainText('CHECK');
    await expect(page.locator('body')).not.toContainText('COMPARE');
    await expect(page.locator('body')).not.toContainText('CALCULATE');
    await ctx.close();
  }
});

test('cost hub is consumer-facing and includes insulation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await audit(page,`${BASE}/cost/`);
  await expect(page.locator('h1')).toContainText('공사별 인테리어 비용');
  const insulation=page.locator('a[href$="/cost/insulation/"]');
  await expect(insulation.first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('PRIMARY ANSWER');
  await expect(page.locator('body')).not.toContainText('GO');
});

test('new insulation hub answers real estimate conditions',async({browser})=>{
  for(const vp of [{width:390,height:844},{width:1440,height:900}]){
    const ctx=await browser.newContext({viewport:vp});const page=await ctx.newPage();
    await audit(page,`${BASE}/cost/insulation/`);
    await expect(page.locator('h1')).toContainText('단열');
    await expect(page.locator('body')).toContainText('단열재 종류');
    await expect(page.locator('body')).toContainText('실제 작업면적');
    await expect(page.locator('body')).toContainText('기밀');
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(6);
    await ctx.close();
  }
});

test('32 pyeong page stops pretending N=0 is cost data',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await audit(page,`${BASE}/interior-cost/32-pyeong/`);
  await expect(page.locator('h1')).toHaveText('32평 인테리어 비용 비교 조건');
  await expect(page.locator('body')).toContainText('가격 통계 공개 전');
  await expect(page.locator('body')).not.toContainText('P25 보류');
  await expect(page.locator('body')).not.toContainText('평당 중앙값 보류');
  await expect(page.locator('body')).not.toContainText('실제 견적 표본 N=0');
});

test('quote compare is compact and exposes importer on 390px',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const state=await audit(page,`${BASE}/quote-compare/`);
  await expect(page.locator('.v26-tool-shortcut')).toContainText('CSV·TXT 견적 불러오기');
  const vendor=page.locator('.vendor-grid').first();
  const layout=await vendor.evaluate(el=>({
    columns:getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
    width:el.getBoundingClientRect().width
  }));
  expect(layout.columns).toBe(3);
  expect(layout.width).toBeLessThanOrEqual(365);
  // Previous external audit measured ~14,312px; v26 should materially shorten it.
  expect(state.height).toBeLessThan(11000);
});

test('search hides regional empty shells and internal QA results',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await audit(page,`${BASE}/search/?q=32평`);
  await page.waitForTimeout(400);
  const links=await page.locator('[data-search-results] a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')||''));
  expect(links.some(h=>h.includes('/region/'))).toBeFalsy();
  expect(links.some(h=>/\/data\/(answers-v|production-|ad-layout|coverage|launch-gate)/.test(h))).toBeFalsy();
});

test('launch manifest holds thin clusters and excludes ops pages',async({page})=>{
  const res=await page.request.get(`${BASE}/data/v26-launch-manifest.json`);
  expect(res.ok()).toBeTruthy();
  const j=await res.json();
  const matrix=j.pages.filter(x=>/^\/interior-cost\/matrix\/.+\/.+\/$/.test(x.route));
  expect(matrix).toHaveLength(25);
  expect(matrix.every(x=>x.state==='hold_noindex')).toBeTruthy();
  expect(j.pages.filter(x=>x.route.startsWith('/region/')&&x.route!=='/region/').every(x=>x.state==='hold_noindex')).toBeTruthy();
  expect(j.pages.some(x=>x.state==='exclude_production')).toBeTruthy();
  expect(j.preview_noindex_preserved).toBe(true);
  expect(j.production_index_not_enabled).toBe(true);
});

test('capture v26 representative screenshots',async({browser})=>{
  const targets=[
    ['home-mobile-v26.png',390,844,`${BASE}/`],
    ['quote-compare-mobile-v26.png',390,844,`${BASE}/quote-compare/`],
    ['cost-mobile-v26.png',390,844,`${BASE}/cost/`],
    ['pyeong32-mobile-v26.png',390,844,`${BASE}/interior-cost/32-pyeong/`],
    ['insulation-desktop-v26.png',1440,900,`${BASE}/cost/insulation/`]
  ];
  for(const [name,w,h,url] of targets){
    const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.screenshot({path:path.join(outDir,name),fullPage:true});
    await ctx.close();
  }
  for(const [name] of targets)expect(fs.existsSync(path.join(outDir,name))).toBeTruthy();
});

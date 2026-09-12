const { test, expect } = require('@playwright/test');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';

async function noOverflow(page){
  return await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
}

test('home editorial hierarchy mobile and desktop', async({page})=>{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:900,name:'desktop'}]){
    await page.setViewportSize(viewport);
    await page.goto(BASE+'/',{waitUntil:'networkidle'});
    await expect(page.locator('h1')).toContainText('인테리어 견적');
    await expect(page.locator('.v30-hero')).toBeVisible();
    await expect(page.getByText('337,984').first()).toBeVisible();
    const bg=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(8, 8, 8)');
    const weight=await page.locator('.v30-hero h1').evaluate(el=>getComputedStyle(el).fontWeight);
    expect(Number(weight)).toBeLessThanOrEqual(500);
    expect(await noOverflow(page)).toBeTruthy();
    await page.screenshot({path:`artifacts/v30-browser/home-${viewport.name}.png`,fullPage:true});
  }
});

test('home uses hairline editorial lists not old marketplace cards', async({page})=>{
  await page.goto(BASE+'/',{waitUntil:'networkidle'});
  await expect(page.locator('.v30-service-list')).toHaveCount(2);
  await expect(page.locator('.v30-data-grid')).toBeVisible();
  await expect(page.locator('.v28-service-grid')).toHaveCount(0);
  await expect(page.getByText('받은 인테리어 견적서, 빠진 비용부터 확인하세요')).toHaveCount(0);
});

test('data hub keeps full API evidence in dark editorial layout', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/data/',{waitUntil:'networkidle'});
  await expect(page.locator('h1')).toHaveText('데이터');
  await expect(page.getByText('337,984').first()).toBeVisible();
  await expect(page.locator('.v30-source-row')).toBeVisible();
  expect(await noOverflow(page)).toBeTruthy();
  await page.screenshot({path:'artifacts/v30-browser/data-mobile.png',fullPage:true});
});

test('trade detail preserves v29 price distributions', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/cost/bathroom/',{waitUntil:'networkidle'});
  await expect(page.locator('[data-v29-price-reference="bathroom"]')).toBeVisible();
  await expect(page.getByText('P25', {exact:false}).first()).toBeVisible();
  await expect(page.locator('.v30-eyebrow')).toBeVisible();
  const cardBg=await page.locator('.v29-ref-card').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(cardBg==='rgba(0, 0, 0, 0)'||cardBg==='rgb(8, 8, 8)').toBeTruthy();
  expect(await noOverflow(page)).toBeTruthy();
  await page.screenshot({path:'artifacts/v30-browser/bathroom-mobile.png',fullPage:true});
});

test('quote tool is dark and functional', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/quote-check/',{waitUntil:'networkidle'});
  await expect(page.locator('h1')).toContainText('견적서 확인');
  await expect(page.locator('.v30-eyebrow')).toBeVisible();
  await expect(page.locator('.qrow')).toHaveCount(12);
  expect(await noOverflow(page)).toBeTruthy();
  await page.screenshot({path:'artifacts/v30-browser/quote-check-mobile.png',fullPage:true});
});

test('plumbing detail and hub route remain available', async({page})=>{
  await page.goto(BASE+'/cost/plumbing/',{waitUntil:'networkidle'});
  await expect(page.locator('h1')).toContainText('배관');
  await expect(page.locator('[data-v29-price-reference="plumbing"]')).toBeVisible();
});

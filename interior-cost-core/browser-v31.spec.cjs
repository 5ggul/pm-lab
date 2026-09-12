const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const OUT=path.resolve('artifacts/v31-browser');
fs.mkdirSync(OUT,{recursive:true});

async function sane(page){
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const robots=await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
  const text=await page.locator('body').innerText();
  expect(text).not.toContain('PRICE RECORDS');
  expect(text).not.toContain('받은 인테리어 견적서, 빠진 비용부터 확인하세요');
  const cls=await page.locator('body').getAttribute('class');
  expect(cls).toContain('v31-light');
  expect(cls).not.toContain('v30-hyper');
  const bg=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');
}

for(const view of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1440,height:1000}}]){
  test.describe(view.name,()=>{
    test.use({viewport:view.viewport});
    test(`home accepted light service layout ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/`);await sane(page);
      await expect(page.getByRole('heading',{name:'견적 도구',level:2})).toBeVisible();
      await expect(page.getByRole('link',{name:/견적 확인/}).first()).toBeVisible();
      await expect(page.getByRole('link',{name:/견적 비교/}).first()).toBeVisible();
      await expect(page.getByRole('heading',{name:'평수별 비용',level:2})).toBeVisible();
      await expect(page.getByRole('heading',{name:'공사별 비용',level:2})).toBeVisible();
      await page.screenshot({path:path.join(OUT,`home-${view.name}.png`),fullPage:true});
    });
    test(`data hub refined ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/data/`);await sane(page);
      await expect(page.getByRole('heading',{name:'공식 자료',level:1})).toBeVisible();
      await expect(page.getByText('337,984건').first()).toBeVisible();
      await expect(page.getByRole('link',{name:/전체 가격 데이터/})).toBeVisible();
      await page.screenshot({path:path.join(OUT,`data-${view.name}.png`),fullPage:true});
    });
    test(`bathroom public reference ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/cost/bathroom/`);await sane(page);
      const block=page.locator('[data-v29-price-reference="bathroom"]');
      await expect(block).toBeVisible();
      const txt=await block.innerText();
      expect(txt).toContain('P25');expect(txt).toContain('P75');expect(txt).toContain('가격 레코드');
      await page.screenshot({path:path.join(OUT,`bathroom-${view.name}.png`),fullPage:true});
    });
    test(`quote check remains utilitarian ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/quote-check/`);await sane(page);
      await expect(page.getByRole('heading',{name:'견적서 확인',level:1})).toBeVisible();
      await expect(page.locator('.qrow')).toHaveCount(12);
      await page.screenshot({path:path.join(OUT,`quote-check-${view.name}.png`),fullPage:true});
    });
  });
}

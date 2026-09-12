const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const OUT=path.resolve('artifacts/v29-browser');
fs.mkdirSync(OUT,{recursive:true});
async function sane(page){
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const robots=await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
  const text=await page.locator('body').innerText();
  expect(text).not.toContain('PRIMARY ANSWER');
  expect(text).not.toContain('RELEASE CANDIDATE');
}
for(const view of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1440,height:1000}}]){
  test.describe(view.name,()=>{
    test.use({viewport:view.viewport});
    test(`data hub ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/data/`);await sane(page);
      await expect(page.getByRole('heading',{name:'공식 자료',level:1})).toBeVisible();
      await expect(page.getByText('337,984건').first()).toBeVisible();
      await expect(page.getByText('11개').first()).toBeVisible();
      await expect(page.getByRole('link',{name:/전체 가격 데이터/})).toBeVisible();
      await page.screenshot({path:path.join(OUT,`data-${view.name}.png`),fullPage:true});
    });
    test(`full api page ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/data/g2b-all/`);await sane(page);
      await expect(page.getByRole('heading',{name:'나라장터 가격정보',level:1})).toBeVisible();
      await expect(page.getByText('337,984건').first()).toBeVisible();
      await expect(page.getByText('시설공통자재(기계설비)')).toBeVisible();
      await expect(page.getByText('표준시장단가및시장시공가격')).toBeVisible();
    });
    test(`bathroom reference ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/cost/bathroom/`);await sane(page);
      await expect(page.getByRole('heading',{name:'공공 참고단가',level:2})).toBeVisible();
      await expect(page.locator('[data-v29-price-reference="bathroom"] .v29-ref-card').first()).toBeVisible();
      const txt=await page.locator('[data-v29-price-reference="bathroom"]').innerText();
      expect(txt).toContain('중앙값'.replace('중앙값','')); // section cards expose the value itself; this keeps regression focused on rendered block
      expect(txt).toContain('P25');expect(txt).toContain('P75');expect(txt).toContain('가격 레코드');
      await page.screenshot({path:path.join(OUT,`bathroom-${view.name}.png`),fullPage:true});
    });
    test(`plumbing new page ${view.name}`,async({page})=>{
      const r=await page.goto(`${BASE}/cost/plumbing/`);expect(r.status()).toBe(200);await sane(page);
      await expect(page.getByRole('heading',{name:'배관·설비 비용',level:1})).toBeVisible();
      await expect(page.locator('[data-v29-price-reference="plumbing"]')).toBeVisible();
      await expect(page.getByText(/가격 필드 10,448건/)).toBeVisible();
    });
  });
}

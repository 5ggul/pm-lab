const {test,expect}=require('@playwright/test');
const BASE=process.env.V23_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const routes=[24,30,32,34,40].map(p=>`interior-cost/matrix/${p}-pyeong/insulation/`);
for(const viewport of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
  test.describe(`v23 insulation ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    for(const route of routes){
      test(route,async({page})=>{
        const errors=[];
        page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
        page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
        const res=await page.goto(`${BASE}/${route}`,{waitUntil:'networkidle'});
        expect(res&&res.ok()).toBeTruthy();
        await expect(page.locator('main#main-content')).toBeVisible();
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('[data-v23-insulation]')).toBeVisible();
        await expect(page.locator('[data-v23-faq-list] article')).toHaveCount(3);
        await expect(page.locator('table.v21-ownership').first().locator('tbody tr')).toHaveCount(8);
        const robots=await page.locator('meta[name="robots"]').getAttribute('content');
        expect(robots).toContain('noindex');
        const faqType=await page.locator('script[type="application/ld+json"][data-v23-faq]').evaluate(n=>JSON.parse(n.textContent)['@type']);
        expect(faqType).toBe('FAQPage');
        const config=await page.locator('script[data-v21-route-config]').evaluate(n=>JSON.parse(n.textContent));
        expect(config.public_refs).toHaveLength(8);
        expect(config.materials.length).toBeGreaterThan(0);
        const overflow=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
        expect(overflow.sw).toBeLessThanOrEqual(overflow.cw+2);
        expect(errors).toEqual([]);
      });
    }
  });
}
test('v23 matrix hub shows all 25 as candidates',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}/interior-cost/matrix/`,{waitUntil:'networkidle'});
  await expect(page.locator('[data-v23-release-note]')).toBeVisible();
  await expect(page.locator('body')).toContainText('25개 모두 데이터·편집 검수 후보');
  await expect(page.locator('a.v21-route-link small',{hasText:'단열 참조 복구'})).toHaveCount(5);
  const hold=await page.locator('a.v21-route-link.v21-hold').count();
  expect(hold).toBe(0);
  const overflow=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(overflow.sw).toBeLessThanOrEqual(overflow.cw+2);
});

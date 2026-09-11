const {test,expect}=require('@playwright/test');

const BASE=process.env.V22_BASE_URL||'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const promoted=[
  'interior-cost/matrix/24-pyeong/carpentry/',
  'interior-cost/matrix/30-pyeong/bathroom/',
  'interior-cost/matrix/30-pyeong/wallpaper/',
  'interior-cost/matrix/30-pyeong/floor/',
  'interior-cost/matrix/30-pyeong/carpentry/',
  'interior-cost/matrix/34-pyeong/bathroom/',
  'interior-cost/matrix/34-pyeong/wallpaper/',
  'interior-cost/matrix/34-pyeong/floor/',
  'interior-cost/matrix/34-pyeong/carpentry/',
  'interior-cost/matrix/40-pyeong/carpentry/'
];

for(const viewport of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
  test.describe(`v22 editorial ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    for(const route of promoted){
      test(route,async({page})=>{
        const errors=[];
        page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
        page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
        const res=await page.goto(`${BASE}/${route}`,{waitUntil:'networkidle'});
        expect(res&&res.ok()).toBeTruthy();
        await expect(page.locator('main#main-content')).toBeVisible();
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('[data-v22-editorial]')).toBeVisible();
        await expect(page.locator('[data-v22-faq-list] article')).toHaveCount(3);
        const robots=await page.locator('meta[name="robots"]').getAttribute('content');
        expect(robots).toContain('noindex');
        const faqTypes=await page.locator('script[type="application/ld+json"][data-v22-faq]').evaluateAll(nodes=>nodes.map(n=>{try{return JSON.parse(n.textContent)['@type']}catch{return null}}));
        expect(faqTypes).toContain('FAQPage');
        const overflow=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
        expect(overflow.sw).toBeLessThanOrEqual(overflow.cw+2);
        expect(errors).toEqual([]);
      });
    }
  });
}

test('v22 matrix hub shows 20 release and 5 hold',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}/interior-cost/matrix/`,{waitUntil:'networkidle'});
  await expect(page.locator('[data-v22-release-note]')).toBeVisible();
  await expect(page.locator('body')).toContainText('단열 5개 조합만 HOLD');
  const promotedLinks=page.locator('a.v21-route-link small',{hasText:'편집 검수 완료'});
  await expect(promotedLinks).toHaveCount(10);
  const overflow=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(overflow.sw).toBeLessThanOrEqual(overflow.cw+2);
});

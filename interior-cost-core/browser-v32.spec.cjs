const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const OUT=path.resolve('artifacts/v32-browser');
fs.mkdirSync(OUT,{recursive:true});

async function systemCheck(page,{desktop=false}={}){
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const robots=await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
  const cls=await page.locator('body').getAttribute('class');
  expect(cls).toContain('v32-stratton');
  expect(cls||'').not.toContain('v31-light');
  expect(cls||'').not.toContain('v30-hyper');
  await expect(page.locator('.v32-data-tape')).toBeVisible();
  const bodyBg=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(bodyBg).toBe('rgb(247, 241, 232)');
  const header=page.locator('.site-header');
  const headerRadius=await header.evaluate(el=>getComputedStyle(el).borderRadius);
  const headerShadow=await header.evaluate(el=>getComputedStyle(el).boxShadow);
  expect(headerRadius).toBe('0px');expect(headerShadow).toBe('none');
  if(desktop){
    const height=await header.evaluate(el=>Math.round(el.getBoundingClientRect().height));
    expect(height).toBeGreaterThanOrEqual(64);expect(height).toBeLessThanOrEqual(68);
  }
  const footer=page.locator('.site-footer').first();
  if(await footer.count()){
    const footerBg=await footer.evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(footerBg).toBe('rgb(13, 13, 12)');
  }
}

const routes=[
  {name:'home',url:'/'},
  {name:'quote-check',url:'/quote-check/'},
  {name:'quote-compare',url:'/quote-compare/'},
  {name:'calculator',url:'/calculator/'},
  {name:'data',url:'/data/'},
  {name:'g2b-all',url:'/data/g2b-all/'},
  {name:'bathroom',url:'/cost/bathroom/'},
  {name:'plumbing',url:'/cost/plumbing/'},
  {name:'pyeong-32',url:'/interior-cost/32-pyeong/'},
  {name:'guides',url:'/guides/'},
  {name:'about',url:'/about/'}
];

for(const view of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1440,height:1000}}]){
  test.describe(view.name,()=>{
    test.use({viewport:view.viewport});
    for(const route of routes){
      test(`${route.name} receives v32 system ${view.name}`,async({page})=>{
        const r=await page.goto(`${BASE}${route.url}`,{waitUntil:'domcontentloaded'});
        expect(r.status()).toBe(200);
        await systemCheck(page,{desktop:view.name==='desktop'});
        await expect(page.locator('h1').first()).toBeVisible();
        await page.screenshot({path:path.join(OUT,`${route.name}-${view.name}.png`),fullPage:true});
      });
    }

    test(`home is hard-edged functional layout ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/`);await systemCheck(page,{desktop:view.name==='desktop'});
      await expect(page.getByRole('heading',{name:/견적 검사/})).toBeVisible();
      await expect(page.getByRole('heading',{name:'견적 도구',level:2})).toBeVisible();
      const card=page.locator('.v28-service-card').first();
      expect(await card.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
      expect(await card.evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
      const heroSize=parseFloat(await page.locator('.v32-home-hero h1').evaluate(el=>getComputedStyle(el).fontSize));
      if(view.name==='desktop')expect(heroSize).toBeGreaterThanOrEqual(70);else expect(heroSize).toBeGreaterThanOrEqual(46);
    });

    test(`bathroom price reference is ruled not cardy ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/cost/bathroom/`);await systemCheck(page,{desktop:view.name==='desktop'});
      const block=page.locator('[data-v29-price-reference="bathroom"]');
      await expect(block).toBeVisible();
      const text=await block.innerText();
      expect(text).toContain('P25');expect(text).toContain('P75');expect(text).toContain('가격 레코드');
      const card=block.locator('.v29-ref-card').first();
      expect(await card.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
      expect(await card.evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
    });

    test(`quote check stays functional ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/quote-check/`);await systemCheck(page,{desktop:view.name==='desktop'});
      await expect(page.locator('.qrow')).toHaveCount(12);
      const input=page.locator('input').first();
      if(await input.count())expect(await input.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
    });

    test(`data assets preserved ${view.name}`,async({page})=>{
      await page.goto(`${BASE}/data/`);await systemCheck(page,{desktop:view.name==='desktop'});
      await expect(page.getByText('337,984건').first()).toBeVisible();
      await expect(page.getByRole('link',{name:/전체 가격 데이터/})).toBeVisible();
    });
  });
}

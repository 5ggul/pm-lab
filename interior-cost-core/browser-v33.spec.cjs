const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const OUT=path.resolve('artifacts/v33-browser');
fs.mkdirSync(OUT,{recursive:true});
const routes=[
 ['home','/'],['quote-check','/quote-check/'],['quote-compare','/quote-compare/'],['calculator','/calculator/'],
 ['cost-hub','/cost/'],['bathroom','/cost/bathroom/'],['plumbing','/cost/plumbing/'],['pyeong32','/interior-cost/32-pyeong/'],
 ['data','/data/'],['g2b-all','/data/g2b-all/'],['guides','/guides/']
];
async function sane(page){
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
 const robots=await page.locator('meta[name="robots"]').getAttribute('content');
 expect(robots).toContain('noindex');
 const bg=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
 expect(bg).toBe('rgb(247, 241, 232)');
 const radius=await page.locator('.v33-ticket,.v33-page-ticket').first().evaluate(el=>getComputedStyle(el).borderRadius).catch(()=>null);
 if(radius!==null) expect(radius).toBe('0px');
 const footerBg=await page.locator('footer').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(footerBg).toBe('rgb(13, 13, 12)');
 await expect(page.locator('.v33-header-cta')).toBeVisible();
}
for(const view of [{name:'mobile',viewport:{width:390,height:844}},{name:'desktop',viewport:{width:1440,height:1000}}]){
 test.describe(view.name,()=>{
  test.use({viewport:view.viewport});
  for(const [name,route] of routes){
   test(`${name} ${view.name}`,async({page})=>{
    const r=await page.goto(`${BASE}${route}`,{waitUntil:'networkidle'}); expect(r.status()).toBe(200); await sane(page);
    if(name==='home'){
      await expect(page.locator('.v33-home-hero')).toBeVisible();
      await expect(page.locator('.v33-ticket')).toBeVisible();
      await expect(page.locator('.v33-step')).toHaveCount(5);
      const markBg=await page.locator('.v33-home-copy .v33-mark').evaluate(el=>getComputedStyle(el).backgroundColor);
      expect(markBg).toBe('rgb(255, 90, 42)');
      const fsH=await page.locator('.v33-home-copy h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      expect(fsH).toBeGreaterThan(view.name==='desktop'?75:44);
      if(view.name==='desktop'){
        await expect(page.locator('.v33-hero-art--left')).toBeVisible();
        await expect(page.locator('.v33-hero-art--right')).toBeVisible();
        await expect(page.locator('.v33-process-strip')).toBeVisible();
      }
    }else{
      await expect(page.locator('.v33-page-ticket').first()).toBeVisible();
      await expect(page.locator('h1 .v33-mark').first()).toBeVisible();
      const markBg=await page.locator('h1 .v33-mark').first().evaluate(el=>getComputedStyle(el).backgroundColor);
      expect(markBg).toBe('rgb(255, 90, 42)');
    }
    if(name==='bathroom'){
      await expect(page.locator('[data-v29-price-reference="bathroom"]')).toBeVisible();
      await expect(page.locator('.v29-ref-card')).toHaveCount(3);
    }
    if(name==='plumbing') await expect(page.getByText(/가격 필드 10,448건/)).toBeVisible();
    if(name==='data') await expect(page.getByText('337,984건').first()).toBeVisible();
    await page.screenshot({path:path.join(OUT,`${name}-${view.name}.png`),fullPage:true});
   });
  }
 });
}

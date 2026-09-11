const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-quote-tools-batch2-audit-v20.json'),'utf8'));
const refs=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-calculator-reference-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-quote-batch2');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;

async function noOverflow(page){return page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,noindex:/noindex/.test(document.querySelector('meta[name="robots"]')?.content||'')}))}

test('quote paste classifier exposes official candidates without false price comparison',async({page})=>{
  test.setTimeout(30000);
  expect(audit.version).toBe('20.6.0');expect(audit.quote_paste_integration).toBe(true);expect(audit.quote_paste_price_comparison).toBe(false);expect(audit.same_unit_only).toBe(true);expect(audit.automatic_price_judgment).toBe(false);expect(audit.private_market_average).toBe(false);
  await page.setViewportSize({width:390,height:844});await page.goto(url('quote-paste/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  await page.locator('[data-v10-example]').click();
  await expect(page.locator('[data-v20-qb2-paste-card]')).toHaveCount(8,{timeout:5000});
  const card=page.locator('[data-v20-qb2-paste-card]').filter({has:page.locator('[data-v20-qb2-ref]')}).first();await expect(card).toBeVisible();
  await expect(card.locator('[data-v20-qb2-unit]')).toHaveCount(1);await expect(card.locator('[data-v20-qb2-ref]')).toHaveCount(1);await expect(card).toContainText('붙여넣기 금액과 직접 비교하지 않음');
  const root=page.locator('[data-v20-qb2-paste]');await expect(root).not.toContainText('적정하다');await expect(root).not.toContainText('비싸다');await expect(root).not.toContainText('싸다');
  const m=await noOverflow(page);expect(m.overflow).toBe(false);expect(m.h1).toBe(1);expect(m.noindex).toBe(true);
  await page.screenshot({path:path.join(outDir,'mobile-quote-paste-public.png'),fullPage:true});
});

test('one-set tool exposes official candidates but never compares bundled total directly',async({page})=>{
  test.setTimeout(30000);
  expect(audit.one_set_integration).toBe(true);expect(audit.one_set_price_comparison).toBe(false);expect(audit.scope_equivalence_assumed).toBe(false);expect(audit.public_choice_persisted).toBe(false);expect(audit.server_transmission).toBe(false);
  const bathroomRefs=refs.references.filter(r=>r.row_key==='bathroom');expect(bathroomRefs.length).toBeGreaterThan(0);
  await page.setViewportSize({width:390,height:844});await page.goto(url('one-set/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const root=page.locator('[data-v20-qb2-one]');await expect(root).toHaveCount(1);await expect(root.locator('[data-v20-qb2-one-unit]')).toHaveCount(1);await expect(root.locator('[data-v20-qb2-one-ref]')).toHaveCount(1);
  await expect(root.locator('[data-v20-qb2-one-result]')).toContainText('1식 총액과 직접 비교하지 않음');await expect(root).not.toContainText('적정하다');await expect(root).not.toContainText('비싸다');await expect(root).not.toContainText('싸다');
  await page.locator('[data-one-set-type]').selectOption('window');await expect(root.locator('[data-v20-qb2-one-result]')).not.toHaveText('선택한 공종·단위의 공식 참고 후보가 없습니다.');
  const m=await noOverflow(page);expect(m.overflow).toBe(false);expect(m.h1).toBe(1);expect(m.noindex).toBe(true);
  await page.screenshot({path:path.join(outDir,'mobile-one-set-public.png'),fullPage:true});
});

test('batch2 pages have no desktop overflow',async({browser})=>{
  test.setTimeout(30000);
  for(const p of ['quote-paste/index.html','one-set/index.html']){const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');const m=await noOverflow(page);expect(m.overflow).toBe(false);expect(m.h1).toBe(1);expect(m.noindex).toBe(true);await context.close()}
  fs.writeFileSync(path.join(outDir,'batch2-audit.json'),JSON.stringify({version:audit.version,passed:true,pages:['quote-paste','one-set'],same_unit_only:audit.same_unit_only,automatic_price_judgment:audit.automatic_price_judgment,production_switch:audit.production_switch},null,2));
});

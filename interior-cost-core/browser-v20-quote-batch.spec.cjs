const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const refs=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-calculator-reference-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-quote-tools-batch-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-quote-batch');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;
const usable=()=>refs.references.find(r=>['market','material'].includes(r.source)&&r.unit_key==='㎡')||refs.references.find(r=>['market','material'].includes(r.source))||refs.references[0];

test('quote check derives a user unit price and shows same-unit public references',async({page})=>{
  test.setTimeout(30000);
  expect(audit.version).toBe('20.5.0');expect(audit.quote_check_integration).toBe(true);expect(audit.same_unit_only).toBe(true);expect(audit.automatic_price_judgment).toBe(false);
  const ref=usable();expect(ref).toBeTruthy();
  await page.setViewportSize({width:1440,height:900});await page.goto(url('quote-check/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator(`[data-qrow="${ref.row_key}"]`);await expect(row).toHaveCount(1);
  await row.locator('[data-q-amount]').fill('50');await row.locator('[data-q-qty]').fill('10');await row.locator('[data-q-unit]').fill(ref.unit_key);
  const publicRow=page.locator(`[data-v20-qb-check-row="${ref.row_key}"]`);await expect(publicRow).toHaveCount(1);await expect(publicRow).toContainText('50,000원');
  await expect(publicRow.locator('[data-v20-qb-ref]').first()).toContainText(ref.unit_key);
  await expect(page.locator('[data-v20-qb-check]')).toHaveAttribute('data-v20-qb-judgment','none');
  await expect(page.locator('[data-v20-qb-check]')).not.toContainText('적정하다');await expect(page.locator('[data-v20-qb-check]')).not.toContainText('싸다');await expect(page.locator('[data-v20-qb-check]')).not.toContainText('비싸다');
  await row.locator('[data-q-unit]').fill('사용자정의단위');await expect(publicRow.locator('[data-v20-qb-ref]')).toHaveCount(0);await expect(publicRow).toContainText('동일 단위 후보 없음');
  await page.setViewportSize({width:390,height:844});const m=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);expect(m).toBe(false);await page.screenshot({path:path.join(outDir,'mobile-quote-check-public.png'),fullPage:true});
});

test('A/B/C compare can use a shared quantity/unit basis with a chosen public reference',async({page})=>{
  test.setTimeout(30000);const ref=usable();expect(ref).toBeTruthy();
  await page.setViewportSize({width:1440,height:900});await page.goto(url('quote-compare/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator(`[data-compare-row="${ref.row_key}"]`);await expect(row).toHaveCount(1);
  for(const [v,n] of [['a','50'],['b','60'],['c','70']]){await row.locator(`[data-vendor="${v}"][data-state]`).selectOption('included');await row.locator(`[data-vendor="${v}"][data-amount]`).fill(n)}
  const basis=row.locator('[data-v20-qb-basis]');await expect(basis).toHaveCount(1);await basis.locator('[data-v20-qb-basis-qty]').fill('10');await basis.locator('[data-v20-qb-basis-unit]').fill(ref.unit_key);
  const select=basis.locator('[data-v20-qb-basis-ref]');const values=await select.locator('option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));expect(values.length).toBeGreaterThan(0);if(values.includes(ref.id))await select.selectOption(ref.id);else await select.selectOption(values[0]);
  const output=basis.locator('[data-v20-qb-basis-out]');await expect(output).toContainText('A 50,000원');await expect(output).toContainText('B 60,000원');await expect(output).toContainText('C 70,000원');await expect(output).toContainText('가격 적정성 판정 없음');
  await page.screenshot({path:path.join(outDir,'desktop-abc-public.png'),fullPage:true});
});

test('cost pages expose official-reference evidence without horizontal overflow',async({browser})=>{
  test.setTimeout(60000);expect(audit.cost_pages_enriched).toBeGreaterThanOrEqual(4);expect(audit.cost_reference_rows).toBeGreaterThanOrEqual(audit.cost_pages_enriched);
  const slugs=audit.cost_slugs;let checked=0;
  for(const slug of slugs){const file=path.join(ROOT,'cost',slug,'index.html');if(!fs.existsSync(file))continue;const html=fs.readFileSync(file,'utf8');if(!html.includes('data-v20-qb-cost'))continue;const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(url(`cost/${slug}/index.html`),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,noindex:/noindex/.test(document.querySelector('meta[name="robots"]')?.content||'')}));expect(m.overflow).toBe(false);expect(m.noindex).toBe(true);await expect(page.locator('[data-v20-qb-cost]')).toContainText('민간 아파트 시공 시장평균이나 적정견적이 아니며');checked++;await context.close()}
  expect(checked).toBe(audit.cost_pages_enriched);fs.writeFileSync(path.join(outDir,'cost-pages-audit.json'),JSON.stringify({version:audit.version,checked,rows:audit.cost_reference_rows,passed:true},null,2));
});

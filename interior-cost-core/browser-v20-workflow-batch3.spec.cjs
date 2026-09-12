const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const refs=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-calculator-reference-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-workflow-batch3-audit-v20.json'),'utf8'));
const coverage=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-workflow-coverage-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-workflow-batch3');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;
const bathroomRef=refs.references.find(r=>r.row_key==='bathroom'&&['market','material'].includes(r.source))||refs.references.find(r=>r.row_key==='bathroom');

test('quote paste parses currency after quantity and hands amount-only state to quote check',async({page})=>{
  test.setTimeout(30000);expect(audit.version).toBe('20.7.0');expect(audit.quote_paste_to_quote_check).toBe(true);expect(audit.handoff_unit_inferred).toBe(false);expect(bathroomRef).toBeTruthy();
  await page.setViewportSize({width:1440,height:900});await page.goto(url('quote-paste/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  await page.locator('[data-v10-example]').click();
  const bathroomRow=page.locator('[data-v10-paste-body] tr').filter({hasText:'욕실 2개 860만원'});await expect(bathroomRow).toContainText('860만원');
  await page.locator('[data-v20-qb3-send-check]').click();await page.waitForURL(/quote-check/);await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator('[data-qrow="bathroom"]');await expect(row.locator('[data-q-amount]')).toHaveValue('860');await expect(row.locator('[data-q-qty]')).toHaveValue('');await expect(row.locator('[data-q-unit]')).toHaveValue('');
  await expect(page.locator('[data-v20-qb3-handoff]')).toBeVisible();await expect(page.locator('[data-v20-qb3-handoff]')).toContainText('수량·단위·사양을 입력하기 전에는 공식 단가와 비교하지 않습니다');
  await expect(page.locator('[data-v20-qb-check-row="bathroom"]')).toHaveCount(0);
  await row.locator('[data-q-qty]').fill('10');await row.locator('[data-q-unit]').fill(bathroomRef.unit_key);await expect(page.locator('[data-v20-qb-check-row="bathroom"]')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await page.screenshot({path:path.join(outDir,'mobile-paste-handoff-check.png'),fullPage:true});
});

test('one-set hands total only to quote check without inventing unit or quantity',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:1440,height:900});await page.goto(url('one-set/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  await page.locator('[data-one-set-type]').selectOption('bathroom');await page.locator('[data-one-set-amount]').fill('850');await page.locator('[data-v20-qb3-one-send]').click();await page.waitForURL(/quote-check/);await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator('[data-qrow="bathroom"]');await expect(row.locator('[data-q-amount]')).toHaveValue('850');await expect(row.locator('[data-q-qty]')).toHaveValue('');await expect(row.locator('[data-q-unit]')).toHaveValue('');await expect(page.locator('[data-v20-qb3-handoff]')).toContainText('1개 공종의 금액만 반영했습니다');
});

test('checklist and cost combination expose coverage without price judgment',async({browser})=>{
  test.setTimeout(30000);expect(coverage.covered_rows).toBeGreaterThanOrEqual(5);expect(coverage.total_reference_count).toBe(refs.references.length);
  for(const [p,marker] of [['checklist/index.html','[data-v20-qb3-checklist]'],['cost-combination/index.html','[data-v20-qb3-combination]']]){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');await expect(page.locator(marker)).toHaveCount(1);await expect(page.locator(marker)).toContainText('적정');const text=await page.locator(marker).innerText();expect(text).not.toContain('적정하다');expect(text).not.toContain('비싸다');expect(text).not.toContain('싸다');expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
  fs.writeFileSync(path.join(outDir,'coverage-audit.json'),JSON.stringify({version:audit.version,covered_rows:coverage.covered_rows,reference_count:coverage.total_reference_count,passed:true},null,2));
});

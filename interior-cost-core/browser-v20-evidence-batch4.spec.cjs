const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const evidence=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-evidence-index-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-evidence-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-evidence-batch4');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;

test('evidence index filters stable provenance records and exports visible rows',async({page})=>{
  test.setTimeout(45000);
  expect(evidence.version).toBe('20.8.0');
  expect(evidence.evidence_count).toBe(evidence.evidence.length);
  expect(new Set(evidence.evidence.map(x=>x.evidence_id)).size).toBe(evidence.evidence.length);
  expect(evidence.same_unit_only).toBe(true);expect(evidence.category_keyword_gate).toBe(true);expect(evidence.scope_equivalence_assumed).toBe(false);expect(evidence.automatic_price_judgment).toBe(false);expect(evidence.private_market_average).toBe(false);
  for(const r of evidence.evidence){expect(r.dataset_id).toBe('15129415');expect(r.official_dataset_url).toContain('data.go.kr/data/15129415/openapi.do');expect(r.operation).toMatch(/^get/);expect(r.source_page).toContain('/data/g2b-');expect(r.evidence_id).toMatch(/^g2b-(material|market|standard)-[0-9a-f]{12}$/)}
  await page.setViewportSize({width:1440,height:900});await page.goto(url('data/g2b-evidence/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-v20-evidence-page]')?.dataset?.v20EvidenceReady==='1');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await expect(page.locator('[data-v20-evidence-card]')).toHaveCount(evidence.evidence_count);
  const source='standard',expected=evidence.source_counts[source];await page.locator('[data-v20-evidence-source]').selectOption(source);await expect(page.locator('[data-v20-evidence-card]:visible')).toHaveCount(expected);
  const first=evidence.evidence.find(x=>x.source===source);expect(first).toBeTruthy();await page.locator('[data-v20-evidence-q]').fill(first.evidence_id);await expect(page.locator('[data-v20-evidence-card]:visible')).toHaveCount(1);await expect(page.locator('[data-v20-evidence-card]:visible')).toContainText(first.item_label);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-v20-evidence-csv]').click()]);expect(download.suggestedFilename()).toBe('g2b-evidence-visible.csv');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await page.screenshot({path:path.join(outDir,'mobile-evidence-index.png'),fullPage:true});
});

test('evidence strip is linked from every audited tool and enriched cost surface',async({browser})=>{
  test.setTimeout(90000);expect(audit.strip_injected_count).toBe(audit.strip_target_count);expect(audit.strip_target_count).toBeGreaterThanOrEqual(14);
  let checked=0;
  for(const rel of audit.strip_targets){
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.goto(url(rel),{waitUntil:'domcontentloaded'});const strip=page.locator('[data-v20-evidence-strip]');await expect(strip).toHaveCount(1);await expect(strip.locator('a')).toHaveAttribute('href','/pm-lab/interior-cost-preview/data/g2b-evidence/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);expect(/noindex/.test(await page.locator('meta[name="robots"]').getAttribute('content')||'')).toBe(true);checked++;await context.close();
  }
  fs.writeFileSync(path.join(outDir,'surface-link-audit.json'),JSON.stringify({version:audit.version,checked,evidence_count:evidence.evidence_count,passed:true},null,2));
});

test('evidence operations are source-specific and contain no secret-field names',async()=>{
  expect(audit.operations).toEqual({material:'getPriceInfoListFcltyCmmnMtrilBildng',market:'getPriceInfoListMrktCnstrctPcBildng',standard:'getStdMarkUprcinfoList'});
  const text=JSON.stringify(evidence);expect(text).not.toMatch(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i);expect(evidence.server_transmission).toBe(false);expect(evidence.production_switch).toBe(false);expect(evidence.search_console_submission).toBe(false);expect(evidence.ads_injected).toBe(false);
});

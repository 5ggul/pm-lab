const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const coverage=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-reference-coverage-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-reference-coverage-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-coverage-gaps-batch8');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/^\//,'').replace(/index\.html$/,'')}`;

test('coverage hub exposes covered and unavailable scopes without price judgment',async({page})=>{
  expect(coverage.version).toBe('20.12.0');expect(coverage.summary.core_total).toBe(11);expect(coverage.summary.core_covered).toBe(7);expect(coverage.summary.core_unavailable).toBe(4);expect(coverage.summary.cost_total).toBe(8);expect(coverage.summary.cost_covered).toBe(6);expect(coverage.summary.cost_unavailable).toBe(2);expect(coverage.summary.reference_count).toBe(65);expect(coverage.summary.evidence_count).toBe(65);
  expect(coverage.same_unit_only).toBe(true);expect(coverage.category_keyword_gate).toBe(true);expect(coverage.scope_equivalence_assumed).toBe(false);expect(coverage.automatic_price_judgment).toBe(false);expect(coverage.private_market_average).toBe(false);expect(coverage.unavailable_is_zero_price).toBe(false);expect(coverage.unavailable_is_missing_data_claim).toBe(false);
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await page.goto(url('data/g2b-reference-coverage/index.html'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-coverage-page]')).toHaveCount(1);await expect(page.locator('[data-v20-coverage-core]')).toHaveCount(11);await expect(page.locator('[data-v20-coverage-cost]')).toHaveCount(8);await expect(page.locator('[data-v20-coverage-cost][data-status="unavailable"]')).toHaveCount(2);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);const text=await page.locator('[data-v20-coverage-page]').innerText();expect(text).toContain('연결 없음');expect(text).toContain('다른 공종');expect(text).not.toContain('비싸다');expect(text).not.toContain('싸다');expect(text).not.toContain('적정하다');expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false)}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(outDir,'mobile-coverage-hub.png'),fullPage:true});
});

test('all eight cost pages expose coverage state and unavailable pages are explicit',async({browser})=>{
  for(const item of coverage.cost_pages){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(`cost/${item.slug}/index.html`),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-coverage-cost-strip]')).toHaveCount(1);await expect(page.locator('[data-v20-coverage-cost-strip]')).toHaveAttribute('data-status',item.status);if(item.status==='unavailable'){await expect(page.locator('[data-v20-coverage-unavailable]')).toHaveCount(1);await expect(page.locator('[data-v20-coverage-unavailable]')).toContainText('다른 공종이나 다른 단위');await expect(page.locator('[data-v20-qb-cost]')).toHaveCount(0)}else{await expect(page.locator('[data-v20-coverage-unavailable]')).toHaveCount(0);await expect(page.locator('[data-v20-qb-cost]')).toHaveCount(1)}expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
});

test('coverage entry point is present on eight major official-reference surfaces',async({browser})=>{
  expect(audit.entry_targets).toHaveLength(8);expect(audit.entry_injected).toBe(8);expect(audit.explicit_unavailable_blocks).toBe(2);
  for(const p of audit.entry_targets){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-coverage-entry]')).toHaveCount(1);await expect(page.locator('[data-v20-coverage-entry] a')).toHaveAttribute('href',/\/data\/g2b-reference-coverage\//);expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
  fs.writeFileSync(path.join(outDir,'coverage-audit.json'),JSON.stringify({version:audit.version,core:[audit.core_covered,audit.core_total],cost:[audit.cost_covered,audit.cost_total],unavailable:audit.explicit_unavailable_blocks,entry_injected:audit.entry_injected,passed:true},null,2));
});

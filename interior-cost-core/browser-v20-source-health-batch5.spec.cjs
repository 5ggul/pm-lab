const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const health=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-source-health-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-source-health-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-source-health-batch5');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;

test('source health page exposes three official source states without inventing freshness',async({page})=>{
  test.setTimeout(30000);
  expect(health.version).toBe('20.9.0');expect(health.source_count).toBe(3);expect(health.evidence_count).toBe(65);expect(health.semantics.freshness_threshold_assumed).toBe(false);expect(health.semantics.private_market_average).toBe(false);expect(health.semantics.automatic_price_judgment).toBe(false);
  for(const s of health.source_health){expect(['live','stale_fallback']).toContain(s.refresh_status);expect(s.operation).toBeTruthy();expect(s.source_collected_at).toBeTruthy();expect(s.evidence_count).toBeGreaterThan(0);expect(String(s.endpoint)).not.toContain('serviceKey')}
  expect(JSON.stringify(health)).not.toMatch(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i);
  await page.setViewportSize({width:390,height:844});await page.goto(url('data/g2b-source-health/index.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);await expect(page.locator('[data-v20-source-health-page]')).toHaveCount(1);await expect(page.locator('[data-v20-source-card]')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);
  const text=await page.locator('[data-v20-source-health-page]').innerText();expect(text).toContain('공식 데이터 수집 상태');expect(text).toContain('임의 신선도 일수 기준');expect(text).toContain('민간 아파트 인테리어 시장평균');
  await page.screenshot({path:path.join(outDir,'mobile-source-health.png'),fullPage:true});
});

test('source health status is linked from evidence and source pages on mobile',async({browser})=>{
  test.setTimeout(30000);expect(audit.strip_target_count).toBe(6);expect(audit.strip_injected_count).toBe(6);
  for(const p of audit.strip_targets){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);await expect(page.locator('[data-v20-source-health-strip]')).toHaveCount(1);await expect(page.locator('[data-v20-source-health-strip] a')).toHaveAttribute('href','/pm-lab/interior-cost-preview/data/g2b-source-health/');expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
  fs.writeFileSync(path.join(outDir,'audit.json'),JSON.stringify({version:audit.version,sources:health.source_count,evidence:health.evidence_count,stale_fallback_count:health.stale_fallback_count,linked_surfaces:audit.strip_target_count,passed:true},null,2));
});

test('desktop source health keeps source counts and links visible',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url('data/g2b-source-health/index.html'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-source-card]')).toHaveCount(3);for(const s of health.source_health){const card=page.locator(`[data-v20-source-card="${s.key}"]`);await expect(card).toContainText(s.label);await expect(card).toContainText(s.status_label);await expect(card.locator('a').first()).toHaveAttribute('href',s.source_page)}expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await page.screenshot({path:path.join(outDir,'desktop-source-health.png'),fullPage:true});
});

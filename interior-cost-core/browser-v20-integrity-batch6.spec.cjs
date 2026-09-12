const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-data-integrity-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-data-integrity-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-integrity-batch6');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/^\//,'').replace(/index\.html$/,'')}`;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');

test('integrity manifest independently matches sanitized snapshot bytes',async()=>{
  expect(manifest.version).toBe('20.10.0');
  expect(manifest.source_count).toBe(3);expect(manifest.evidence_count).toBe(65);expect(manifest.all_structural_checks_pass).toBe(true);
  expect(manifest.hash_algorithm).toBe('SHA-256');expect(manifest.freshness_threshold_assumed).toBe(false);expect(manifest.automatic_price_judgment).toBe(false);expect(manifest.private_market_average).toBe(false);
  const files={material:'data/g2b-building-materials.json',market:'data/g2b-building-market-construction.json',standard:'data/g2b-standard-market-unit-building.json'};
  for(const row of manifest.integrity){const raw=fs.readFileSync(path.join(CORE,files[row.key]),'utf8');expect(row.source_sha256).toBe(sha(raw));expect(row.source_sha256).toMatch(/^[0-9a-f]{64}$/);expect(row.evidence_sha256).toMatch(/^[0-9a-f]{64}$/);expect(row.structural_check_pass).toBe(true);expect(row.record_count).toBeGreaterThan(0);expect(row.group_count).toBeGreaterThan(0);expect(row.evidence_count).toBeGreaterThan(0);expect(['live','stale_fallback']).toContain(row.refresh_status);}
  expect(audit.strip_target_count).toBe(7);expect(audit.strip_injected_count).toBe(7);expect(audit.unique_source_hashes).toBe(3);expect(audit.forbidden_fields_absent).toBe(true);
  const txt=JSON.stringify(manifest);expect(txt).not.toMatch(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i);
  fs.writeFileSync(path.join(outDir,'manifest-audit.json'),JSON.stringify({version:manifest.version,source_count:manifest.source_count,evidence_count:manifest.evidence_count,source_hashes:manifest.integrity.map(x=>({key:x.key,sha256:x.source_sha256})),passed:true},null,2));
});

test('integrity page renders three sources without price judgment on desktop and mobile',async({page})=>{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await page.goto(url('data/g2b-data-integrity/index.html'),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-integrity-page]')).toHaveCount(1);await expect(page.locator('[data-v20-integrity-card]')).toHaveCount(3);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);const text=await page.locator('[data-v20-integrity-page]').innerText();expect(text).toContain('SHA-256');expect(text).toContain('3 / 3 통과');expect(text).not.toContain('적정하다');expect(text).not.toContain('비싸다');expect(text).not.toContain('싸다');expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);for(const card of await page.locator('[data-v20-integrity-card]').all()){const code=await card.locator('code').first().innerText();expect(code).toMatch(/^[0-9a-f]{64}$/)}}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(outDir,'mobile-integrity.png'),fullPage:true});
});

test('integrity entry points are present on seven linked preview surfaces',async({browser})=>{
  for(const p of audit.strip_targets){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-integrity-strip]')).toHaveCount(1);await expect(page.locator('[data-v20-integrity-strip] a')).toHaveAttribute('href',/\/data\/g2b-data-integrity\//);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
});

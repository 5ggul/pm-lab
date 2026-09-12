const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const refs=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-calculator-reference-v20.json'),'utf8'));
const evidence=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-evidence-index-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-review-packet-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-review-packet-batch7');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/^\//,'').replace(/index\.html$/,'')}`;
const bathroomRefs=refs.references.filter(r=>r.row_key==='bathroom');
const bathroomRef=bathroomRefs.find(r=>['market','material'].includes(r.source))||bathroomRefs[0];

test('quote-check builds one-use local review packet with evidence and exports',async({page})=>{
  test.setTimeout(30000);expect(audit.version).toBe('20.11.0');expect(audit.packet_transport).toBe('sessionStorage_once');expect(audit.server_transmission).toBe(false);expect(audit.persistent_storage).toBe(false);expect(bathroomRef).toBeTruthy();
  await page.setViewportSize({width:1440,height:900});await page.goto(url('quote-check/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator('[data-qrow="bathroom"]');await row.locator('[name="state-bathroom"][value="included"]').check();await row.locator('[data-q-amount]').fill('860');await row.locator('[data-q-qty]').fill('10');await row.locator('[data-q-unit]').fill(bathroomRef.unit_key);await row.locator('[data-q-spec]').fill('사용자 확인 사양');await row.locator('[data-q-memo]').fill('검수 메모');
  await expect(page.locator('[data-v20-qb-check-row="bathroom"] [data-v20-qb-ref]').first()).toHaveCount(1);
  await page.locator('[data-v20-review-open]').click();await page.waitForURL(/quote-review-report/);
  await expect(page.locator('[data-v20-review-page]')).toHaveCount(1);await expect(page.locator('[data-v20-review-output]')).toContainText('받은 견적 검사');await expect(page.locator('[data-v20-review-output]')).toContainText('욕실');await expect(page.locator('[data-v20-review-output]')).toContainText('860만원');await expect(page.locator('[data-v20-review-output]')).toContainText('사용자 확인 사양');
  const packetExists=await page.evaluate(()=>sessionStorage.getItem('interior_v20_review_packet'));expect(packetExists).toBeNull();
  const jsonDownload=page.waitForEvent('download');await page.locator('[data-v20-rp-json]').click();const jd=await jsonDownload;expect(jd.suggestedFilename()).toBe('interior-review-packet.json');
  const csvDownload=page.waitForEvent('download');await page.locator('[data-v20-rp-csv]').click();const cd=await csvDownload;expect(cd.suggestedFilename()).toBe('interior-review-packet.csv');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await page.screenshot({path:path.join(outDir,'mobile-quote-check-report.png'),fullPage:true});
});

test('A B C compare packet preserves common basis and explicit official selection only',async({page})=>{
  test.setTimeout(30000);await page.setViewportSize({width:1440,height:900});await page.goto(url('quote-compare/index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const row=page.locator('[data-compare-row="bathroom"]');await row.locator('[data-vendor="a"][data-state]').selectOption('included');await row.locator('[data-vendor="a"][data-amount]').fill('800');await row.locator('[data-vendor="b"][data-state]').selectOption('included');await row.locator('[data-vendor="b"][data-amount]').fill('900');
  const basis=row.locator('[data-v20-qb-basis]');await expect(basis).toHaveCount(1);await basis.locator('[data-v20-qb-basis-qty]').fill('10');await basis.locator('[data-v20-qb-basis-unit]').fill(bathroomRef.unit_key);const opts=await basis.locator('[data-v20-qb-basis-ref] option').count();expect(opts).toBeGreaterThan(1);await basis.locator('[data-v20-qb-basis-ref]').selectOption({index:1});
  await page.locator('[data-v20-review-open]').click();await page.waitForURL(/quote-review-report/);await expect(page.locator('[data-v20-review-output]')).toContainText('A/B/C 업체 비교');await expect(page.locator('[data-v20-review-output]')).toContainText('800만원');await expect(page.locator('[data-v20-review-output]')).toContainText('900만원');await expect(page.locator('[data-v20-review-output] code').first()).toContainText('g2b-');
  expect(await page.evaluate(()=>sessionStorage.getItem('interior_v20_review_packet'))).toBeNull();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await page.screenshot({path:path.join(outDir,'mobile-abc-report.png'),fullPage:true});
});

test('report direct visit is empty and static safety contracts remain explicit',async({page})=>{
  expect(evidence.evidence_count).toBe(65);expect(audit.automatic_price_judgment).toBe(false);expect(audit.private_market_average).toBe(false);expect(audit.quantity_inferred).toBe(false);expect(audit.unit_inferred).toBe(false);expect(audit.spec_inferred).toBe(false);expect(audit.preview_noindex).toBe(true);expect(audit.production_switch).toBe(false);expect(audit.search_console_submission).toBe(false);expect(audit.ads_injected).toBe(false);
  await page.goto(url('quote-review-report/index.html'),{waitUntil:'domcontentloaded'});await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);await expect(page.locator('[data-v20-review-output]')).toContainText('전달된 검수 패킷이 없습니다');await expect(page.locator('[data-v20-rp-actions]')).toBeHidden();
  fs.writeFileSync(path.join(outDir,'review-packet-audit.json'),JSON.stringify({version:audit.version,evidence_count:evidence.evidence_count,source_pages:audit.source_pages,passed:true},null,2));
});

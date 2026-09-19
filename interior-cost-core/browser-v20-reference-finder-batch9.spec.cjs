const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const finder=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-reference-finder-v20.json'),'utf8'));
const coverage=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-reference-coverage-v20.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-reference-finder-audit-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-reference-finder-batch9');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/^\//,'').replace(/index\.html$/,'')}`;

const linked=finder.candidates.find(x=>x.linked_evidence_ids?.length&&x.label&&x.label.length>=2&&x.unit_key);
const plain=finder.candidates.find(x=>x.label&&x.label.length>=2&&x.unit_key);

test('finder contracts cover broad official pool without automatic matching',async()=>{
  expect(finder.version).toBe('20.13.0');
  expect(finder.candidate_count).toBe(394);expect(finder.candidates.length).toBe(394);expect(finder.unit_count).toBe(16);
  expect(new Set(finder.candidates.map(x=>x.candidate_id)).size).toBe(394);
  expect(finder.search_contract.unit_required).toBe(true);expect(finder.search_contract.keyword_required).toBe(true);
  expect(finder.search_contract.lexical_all_tokens).toBe(true);expect(finder.search_contract.fuzzy_matching).toBe(false);expect(finder.search_contract.semantic_similarity).toBe(false);
  expect(finder.search_contract.query_infers_unit).toBe(false);expect(finder.search_contract.automatic_reference_selection).toBe(false);expect(finder.search_contract.automatic_category_mapping).toBe(false);
  expect(finder.same_unit_only).toBe(true);expect(finder.scope_equivalence_assumed).toBe(false);expect(finder.automatic_price_judgment).toBe(false);expect(finder.private_market_average).toBe(false);
  expect(finder.user_input_persisted).toBe(false);expect(finder.server_transmission).toBe(false);expect(finder.production_switch).toBe(false);expect(finder.search_console_submission).toBe(false);expect(finder.ads_injected).toBe(false);
  expect(linked).toBeTruthy();expect(plain).toBeTruthy();
  for(const row of finder.candidates){expect(row.dataset_id).toBe('15129415');expect(row.operation).toMatch(/^get/);expect(row.source_page).toContain('/data/g2b-');expect(row.official_dataset_url).toContain('data.go.kr/data/15129415');expect(row.candidate_id).toMatch(/^g2b-candidate-[0-9a-f]{12}$/)}
  const txt=JSON.stringify(finder);expect(txt).not.toMatch(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i);
});

test('unit is mandatory and lexical search stays inside the selected unit',async({page})=>{
  await page.goto(url(`data/g2b-reference-finder/?q=${encodeURIComponent(plain.label)}`),{waitUntil:'domcontentloaded'});
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);
  await expect(page.locator('[data-v20-reference-finder]')).toHaveCount(1);
  await expect(page.locator('[data-v20-find-state]')).toContainText('단위를 먼저 선택');
  await expect(page.locator('[data-v20-find-result]')).toHaveCount(0);
  await page.locator('[data-v20-find-unit]').selectOption(plain.unit_key);
  await expect(page.locator('[data-v20-find-result]').first()).toBeVisible();
  const units=await page.locator('[data-v20-find-result]').evaluateAll(els=>els.map(x=>x.getAttribute('data-unit')));
  expect(new Set(units)).toEqual(new Set([plain.unit_key]));
  await page.locator('[data-v20-find-source]').selectOption(plain.source);
  const sources=await page.locator('[data-v20-find-result]').evaluateAll(els=>els.map(x=>x.getAttribute('data-source')));
  expect(new Set(sources)).toEqual(new Set([plain.source]));
});

test('deep link exposes linked evidence but never auto-selects a reference',async({page})=>{
  const requests=[];page.on('request',r=>requests.push({method:r.method(),url:r.url()}));
  const target=url(`data/g2b-reference-finder/?unit=${encodeURIComponent(linked.unit_key)}&q=${encodeURIComponent(linked.label)}&source=${encodeURIComponent(linked.source)}`);
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-v20-find-unit]')).toHaveValue(linked.unit_key);await expect(page.locator('[data-v20-find-source]')).toHaveValue(linked.source);
  await expect(page.locator('[data-v20-find-result]').first()).toBeVisible();
  await expect(page.locator('[data-v20-find-body]')).toContainText(linked.candidate_id);
  await expect(page.locator('[data-v20-find-body]')).toContainText(linked.linked_evidence_ids[0]);
  const text=await page.locator('[data-v20-reference-finder]').innerText();expect(text).toContain('자동 추천/적정성 판정 없음');expect(text).not.toContain('적정하다');expect(text).not.toContain('비싸다');expect(text).not.toContain('싸다');
  expect(requests.some(x=>x.method!=='GET')).toBe(false);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);
  await page.screenshot({path:path.join(outDir,'mobile-reference-finder.png'),fullPage:true});
});

test('coverage gaps link to manual finder without fabricating compact references',async({browser})=>{
  const gaps=coverage.cost_pages.filter(x=>x.status==='unavailable');expect(gaps.length).toBe(2);
  for(const item of gaps){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(`cost/${item.slug}/`),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-coverage-unavailable]')).toHaveCount(1);await expect(page.locator('[data-v20-finder-unavailable-link]')).toHaveCount(1);await expect(page.locator('[data-v20-finder-unavailable-link] a')).toHaveAttribute('href',/\/data\/g2b-reference-finder\/\?q=/);await expect(page.locator('[data-v20-qb-cost]')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
});

test('six data surfaces expose the finder entry point',async({browser})=>{
  expect(audit.entry_target_count).toBe(6);expect(audit.unavailable_cost_count).toBe(2);
  const targets=['data/index.html','data/g2b-reference-coverage/index.html','data/g2b-quote-compare/index.html','data/g2b-evidence/index.html','data/g2b-source-health/index.html','data/g2b-data-integrity/index.html'];
  for(const p of targets){const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();await page.goto(url(p),{waitUntil:'domcontentloaded'});await expect(page.locator('[data-v20-reference-finder-entry]')).toHaveCount(1);await expect(page.locator('[data-v20-reference-finder-entry] a')).toHaveAttribute('href',/\/data\/g2b-reference-finder\//);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex,nofollow/);expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);await c.close()}
  fs.writeFileSync(path.join(outDir,'reference-finder-audit.json'),JSON.stringify({version:audit.version,candidate_count:audit.candidate_count,unit_count:audit.unit_count,evidence_linked_candidate_count:audit.evidence_linked_candidate_count,entry_target_count:audit.entry_target_count,unavailable_cost_count:audit.unavailable_cost_count,passed:true},null,2));
});

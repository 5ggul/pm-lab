const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:4173/interior-cost-preview';
const results = [];
function assert(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
  console.log((condition ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}
async function wait(page, ms = 120) { await page.waitForTimeout(ms); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });

  const pageA = await context.newPage();
  await pageA.goto(BASE + '/quote-check/');
  await pageA.evaluate(() => localStorage.clear());
  await pageA.reload();
  const pageB = await context.newPage();
  await pageB.goto(BASE + '/quote-check/');

  await pageA.locator('[data-qrow="demolition"] [data-q-amount]').fill('111');
  await pageA.locator('[data-save-quote]').click();
  await wait(pageA);
  await pageB.locator('[data-qrow="waste"] [data-q-amount]').fill('222');
  await pageB.locator('[data-save-quote]').click();
  await wait(pageB, 250);

  let saved = await pageB.evaluate(() => JSON.parse(localStorage.getItem('interior-quote-v5')));
  assert('quote-check multi-tab disjoint save merges', saved?.items?.demolition?.amount === '111' && saved?.items?.waste?.amount === '222',
    JSON.stringify({ demolition: saved?.items?.demolition?.amount, waste: saved?.items?.waste?.amount }));

  await pageA.locator('[data-reset-quote]').click();
  await wait(pageB, 350);
  await pageB.locator('[data-qrow="waste"] [data-q-amount]').fill('333');
  await pageB.locator('[data-save-quote]').click();
  await wait(pageB, 220);
  saved = await pageB.evaluate(() => JSON.parse(localStorage.getItem('interior-quote-v5')));
  assert('quote-check reset does not resurrect stale state', saved?.items?.demolition?.amount === '' && saved?.items?.waste?.amount === '333',
    JSON.stringify({ demolition: saved?.items?.demolition?.amount, waste: saved?.items?.waste?.amount }));

  await pageB.locator('[data-qrow="demolition"] input[value="included"]').check();
  const downloadPromise = pageB.waitForEvent('download');
  await pageB.locator('[data-export-csv]').click();
  const download = await downloadPromise;
  const csv = fs.readFileSync(await download.path(), 'utf8').replace(/^\uFEFF/, '');
  assert('CSV exports Korean state labels', csv.includes('"철거","기재"') && !csv.includes('included'), csv.split('\n')[1] || '');

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 375, height: 812 });
  await mobile.goto(BASE + '/quote-check/');
  await mobile.locator('[data-quote-check-mode-button="wizard"]').click();
  await mobile.locator('[data-quote-check-mode-button="all"]').click();
  const mode = await mobile.locator('[data-quote-form]').getAttribute('data-quote-check-mode');
  assert('375px wizard can return to all-row mode', mode === 'all', String(mode));
  const overflow375 = await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  assert('375px quote-check has no page horizontal overflow', overflow375);

  const calc = await context.newPage();
  await calc.goto(BASE + '/calculator/');
  const firstRow = calc.locator('[data-budget-row]').first();
  const qty = firstRow.locator('[data-qty]');
  const unitPrice = firstRow.locator('[data-unit-price]');
  await qty.fill('-2');
  await unitPrice.fill('100');
  await wait(calc);
  const budgetTotal = await calc.locator('[data-budget-total]').innerText();
  assert('calculator rejects negative quantity', budgetTotal.includes('입력값') && (await qty.getAttribute('aria-invalid')) === 'true', budgetTotal);
  assert('calculator quantity uses numeric non-negative input', (await qty.getAttribute('type')) === 'number' && (await qty.getAttribute('min')) === '0');

  const refTool = calc.locator('[data-v21-layer-tool]');
  if (await refTool.count()) {
    const quoteRate = refTool.locator('[data-v21-quote-rate]');
    await quoteRate.fill('-40000');
    await wait(calc);
    const diff = await refTool.locator('[data-v21-diff]').innerText();
    assert('public reference comparison rejects negative quote rate', diff.includes('입력값') && (await quoteRate.getAttribute('aria-invalid')) === 'true', diff);
  }

  const compare = await context.newPage();
  await compare.goto(BASE + '/quote-compare/');
  await wait(compare, 250);
  const stateNames = await compare.locator('[data-compare-row] [data-state]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  const amountNames = await compare.locator('[data-compare-row] [data-amount]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  assert('36 compare state controls have unique accessible names', stateNames.length === 36 && stateNames.every(Boolean) && new Set(stateNames).size === 36,
    JSON.stringify(stateNames.slice(0, 3)));
  assert('36 compare amount controls have unique accessible names', amountNames.length === 36 && amountNames.every(Boolean) && new Set(amountNames).size === 36,
    JSON.stringify(amountNames.slice(0, 3)));
  const status = await compare.locator('[data-v41-shell-status]').innerText();
  assert('compare status hides implementation vocabulary', !/handoff|snapshot|\bsource\b/i.test(status), status);

  const search = await context.newPage();
  await search.goto(BASE + '/search/?q=' + encodeURIComponent('퍼블리셔'));
  await wait(search, 300);
  const hrefs = await search.locator('a.search-result').evaluateAll(els => els.map(e => e.getAttribute('href')));
  assert('public search excludes internal QA/operations pages', !hrefs.some(h => /publisher-readiness|quote-pipeline|quote-operations/.test(h || '')),
    JSON.stringify(hrefs));

  for (const slug of ['about','contact','privacy','terms','disclaimer','editorial-policy','corrections']) {
    const p = await context.newPage();
    await p.goto(BASE + '/' + slug + '/');
    const text = await p.locator('body').innerText();
    assert('policy-specific copy ' + slug, !text.includes('이 페이지는 견적 항목을 같은 기준으로 읽기 위한 편집 가이드입니다.'));
    await p.close();
  }
  const about = await context.newPage();
  await about.goto(BASE + '/about/');
  assert('public operator handle is visible', (await about.locator('body').innerText()).includes('@5ggul'));

  const changelog = await context.newPage();
  await changelog.goto(BASE + '/data/changelog/');
  assert('September 19 changelog entry exists', (await changelog.locator('body').innerText()).includes('2026-09-19'));

  const robots = await (await context.request.get(BASE + '/robots.txt')).text();
  assert('preview robots remains blocked', /Disallow:\s*\//.test(robots));
  assert('preview noindex remains on quote-check', (await pageB.locator('meta[name="robots"]').getAttribute('content') || '').includes('noindex'));

  for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
    const p = await context.newPage();
    await p.setViewportSize(viewport);
    for (const route of ['/quote-check/','/quote-compare/','/calculator/','/search/?q=욕실']) {
      await p.goto(BASE + route);
      const noOverflow = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      assert(viewport.width + 'px no overflow ' + route, noOverflow);
    }
    await p.close();
  }

  const dataA = JSON.parse(await (await context.request.get(BASE + '/data/public-unit-cost-2026-h2.json')).text());
  const dataB = JSON.parse(await (await context.request.get(BASE + '/data/public-unit-cost-v8.json')).text());
  function findCode(root, code, out = []) {
    if (Array.isArray(root)) { root.forEach(x => findCode(x, code, out)); return out; }
    if (root && typeof root === 'object') {
      if (root.code === code) out.push(root);
      Object.values(root).forEach(x => findCode(x, code, out));
    }
    return out;
  }
  const expected = 'https://it7.kr/solutions/public-cost/item/MA310.00240/';
  assert('MA310.00240 detail URL fixed in H2 data', findCode(dataA, 'MA310.00240').some(x => x.detail === expected));
  assert('MA310.00240 detail URL fixed in v8 data', findCode(dataB, 'MA310.00240').some(x => x.detail === expected));

  const index = JSON.parse(await (await context.request.get(BASE + '/data/search-index.json')).text());
  assert('search index itself excludes internal QA pages', !index.some(x => /publisher-readiness|quote-pipeline|quote-operations/.test(x.url || '')));

  await browser.close();
  const failed = results.filter(x => !x.pass);
  console.log('ASSERTIONS=' + results.length + ' FAILURES=' + failed.length);
  if (failed.length) {
    console.error(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
})();
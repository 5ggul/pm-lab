'use strict';

const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = (process.env.QA_BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const OUT = process.env.QA_RESULT_PATH || 'interior-v41-browser-qa.json';
const SHELL = '/docs/interior-v41-preview/production-shell';
const PROD_KEYS = ['interior-quote-v5','interior-compare-v5','interior-compare-v6'];
const REVIEW_KEYS = [
  'interior-quote-source-v41',
  'interior-quote-compare-handoff-v41',
  'interior-quote-compare-state-v41',
  'interior-quote-compare-shell-v41'
];

const results = [];
const failures = [];
function record(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail ?? '') });
  if (!ok) failures.push({ name, detail: String(detail ?? '') });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log('[' + mark + '] ' + name + (detail ? ' :: ' + detail : ''));
}
function must(ok, name, detail = '') {
  record(name, ok, detail);
  if (!ok) throw new Error(name + (detail ? ': ' + detail : ''));
}
function url(rel) {
  return BASE_URL + SHELL + '/' + rel.replace(/^\/+/, '');
}
async function goto(page, rel) {
  const response = await page.goto(url(rel), { waitUntil: 'domcontentloaded', timeout: 60000 });
  must(!!response && response.ok(), 'HTTP ' + rel, response ? response.status() : 'no response');
}
async function waitSummary(page, expected, label) {
  await page.waitForFunction(
    () => /^\\s*\\d+\\s*\\/\\s*\\d+\\s*PASS/.test(document.querySelector('#summary')?.textContent || ''),
    null,
    { timeout: 60000 }
  );
  const summary = (await page.locator('#summary').textContent()) || '';
  const failedRows = await page.locator('#rows tr').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.children).map((td) => (td.textContent || '').trim()))
      .filter((cells) => cells[1] === 'FAIL')
  );
  must(
    summary.includes(expected + ' / ' + expected + ' PASS'),
    label + ' summary',
    summary.trim() + (failedRows.length ? ' :: ' + JSON.stringify(failedRows) : '')
  );
  return summary;
}
async function readRaw(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}
async function readJson(page, key) {
  const raw = await readRaw(page, key);
  return raw ? JSON.parse(raw) : null;
}
async function snapshotProd(page) {
  return page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), PROD_KEYS);
}
function sameObject(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR'
  });

  const pageErrors = [];
  context.on('page', (p) => {
    p.on('pageerror', (err) => pageErrors.push({ url: p.url(), message: String(err?.message || err) }));
  });

  let inspector;
  try {
    inspector = await context.newPage();
    await goto(inspector, 'storage-inspector.html');

    const secure = await inspector.evaluate(() => ({
      secureContext: window.isSecureContext,
      locks: !!navigator.locks && typeof navigator.locks.request === 'function',
      origin: location.origin
    }));
    must(secure.secureContext, 'secure-context', JSON.stringify(secure));
    must(secure.locks, 'Web Locks available', JSON.stringify(secure));

    await inspector.evaluate((keys) => {
      keys.forEach((k, i) => localStorage.setItem(k, 'prod-v41-ci-sentinel-' + i + '::' + 'x'.repeat(31 + i)));
    }, PROD_KEYS);
    await inspector.reload({ waitUntil: 'domcontentloaded' });
    await inspector.locator('#baseline').click();
    await inspector.waitForFunction(() => (document.querySelector('#summary')?.textContent || '').includes('기준점으로 기록'));
    const prodBaseline = await snapshotProd(inspector);
    must(PROD_KEYS.every((k) => prodBaseline[k] !== null), 'production-key baseline seeded', JSON.stringify(prodBaseline));

    const probes = [
      { file: 'self-check.html', expected: 55, click: false },
      { file: 'failure-probe.html', expected: 8, click: false },
      { file: 'writer-concurrency-probe.html', expected: 7, click: true },
      { file: 'pending-recovery-probe.html', expected: 9, click: true },
      { file: 'stale-transfer-probe.html', expected: 9, click: true },
      { file: 'robustness-probe.html', expected: 18, click: true }
    ];

    let automaticTotal = 0;
    for (const spec of probes) {
      const p = await context.newPage();
      await goto(p, spec.file);
      if (spec.click) await p.locator('#run').click();
      const summary = await waitSummary(p, spec.expected, spec.file);
      const rows = await p.locator('#rows tr').count();
      must(rows === spec.expected, spec.file + ' row-count', rows + '/' + spec.expected);
      record(spec.file, true, summary.trim());
      automaticTotal += spec.expected;
      await p.close();
    }
    must(automaticTotal === 106, 'automatic hosted-check inventory', String(automaticTotal));

    const flow = await context.newPage();
    const markers = { a: '111', b: '222', c: '333' };

    async function sendAndApply(target) {
      await goto(flow, 'quote-check/');
      await flow.waitForSelector('[data-send-to-compare]', { timeout: 45000 });

      const row = flow.locator('[data-qrow="demolition"]');
      must((await row.count()) === 1, target.toUpperCase() + ' quote row present');

      const included = row.locator('input[type="radio"][value="included"]');
      if (await included.count()) await included.check();
      await row.locator('[data-q-amount]').fill(markers[target]);
      if (await row.locator('[data-q-qty]').count()) await row.locator('[data-q-qty]').fill('1');
      if (await row.locator('[data-q-unit]').count()) await row.locator('[data-q-unit]').fill('식');
      if (await row.locator('[data-q-spec]').count()) await row.locator('[data-q-spec]').fill('CI-' + target.toUpperCase() + '-SPEC');
      if (await row.locator('[data-q-memo]').count()) await row.locator('[data-q-memo]').fill('CI-' + target.toUpperCase() + '-MEMO');

      await flow.locator('[data-send-to-compare]').click();
      await flow.waitForSelector('dialog.v40-handoff-dialog[open]', { timeout: 15000 });
      await flow.locator('input[name="v40-target"][value="' + target + '"]').check();
      await flow.locator('[data-v40-confirm]').click();

      await flow.waitForURL(/\/production-shell\/quote-compare\/?$/, { timeout: 30000 });
      const parsed = new URL(flow.url());
      must(!parsed.search && !parsed.hash, target.toUpperCase() + ' URL carries no quote payload', flow.url());

      await flow.waitForSelector('[data-v41-shell-preview]', { timeout: 30000 });
      const statusBefore = (await flow.locator('[data-v41-shell-status]').textContent()) || '';
      must(statusBefore.includes(target.toUpperCase() + ' 업체 handoff'), target.toUpperCase() + ' preview is explicit', statusBefore);

      await flow.locator('[data-v41-shell-apply]').click();
      await flow.waitForFunction(
        (t) => (document.querySelector('[data-v41-shell-status]')?.textContent || '').includes(t.toUpperCase() + ' 업체 적용 완료'),
        target,
        { timeout: 30000 }
      );
      must((await flow.locator('[data-v41-shell-preview]').count()) === 0, target.toUpperCase() + ' preview removed after Apply');

      const saved = await readJson(flow, 'interior-quote-compare-shell-v41');
      must(saved?.flat?.['demolition:' + target + ':amount'] === markers[target], target.toUpperCase() + ' amount persisted', JSON.stringify(saved?.flat?.['demolition:' + target + ':amount']));
      must(saved?.vendors?.[target]?.items?.demolition?.spec === 'CI-' + target.toUpperCase() + '-SPEC', target.toUpperCase() + ' rich metadata persisted');
      must((await readRaw(flow, 'interior-quote-source-v41')) === null, target.toUpperCase() + ' source cleaned');
      must((await readRaw(flow, 'interior-quote-compare-handoff-v41')) === null, target.toUpperCase() + ' handoff cleaned');
    }

    await sendAndApply('a');
    await sendAndApply('b');
    let savedAB = await readJson(flow, 'interior-quote-compare-shell-v41');
    must(savedAB?.flat?.['demolition:a:amount'] === markers.a, 'B Apply preserves A');
    await sendAndApply('c');

    const savedABC = await readJson(flow, 'interior-quote-compare-shell-v41');
    must(['a','b','c'].every((v) => savedABC?.flat?.['demolition:' + v + ':amount'] === markers[v]), 'A/B/C three-vendor state preserved');
    must(['a','b','c'].every((v) => savedABC?.vendors?.[v]?.items?.demolition?.memo === 'CI-' + v.toUpperCase() + '-MEMO'), 'A/B/C metadata preserved');

    await flow.reload({ waitUntil: 'domcontentloaded' });
    await flow.waitForSelector('[data-compare-table]', { timeout: 30000 });
    for (const v of ['a','b','c']) {
      const value = await flow.locator('[data-compare-row="demolition"] [data-vendor="' + v + '"][data-amount]').inputValue();
      must(value === markers[v], 'refresh restores ' + v.toUpperCase(), value);
    }

    await goto(flow, 'index.html');
    await goto(flow, 'quote-compare/');
    await flow.waitForSelector('[data-compare-table]', { timeout: 30000 });
    for (const v of ['a','b','c']) {
      const value = await flow.locator('[data-compare-row="demolition"] [data-vendor="' + v + '"][data-amount]').inputValue();
      must(value === markers[v], 'revisit restores ' + v.toUpperCase(), value);
    }

    await flow.close();
    const reopened = await context.newPage();
    await goto(reopened, 'quote-compare/');
    await reopened.waitForSelector('[data-compare-table]', { timeout: 30000 });
    for (const v of ['a','b','c']) {
      const value = await reopened.locator('[data-compare-row="demolition"] [data-vendor="' + v + '"][data-amount]').inputValue();
      must(value === markers[v], 'new-tab revisit restores ' + v.toUpperCase(), value);
    }

    // Real storage-event stale snapshot protection across two tabs.
    const stale = reopened;
    await goto(stale, 'quote-check/');
    await stale.waitForSelector('[data-send-to-compare]', { timeout: 30000 });
    await stale.locator('[data-qrow="demolition"] [data-q-amount]').fill('444');
    await stale.locator('[data-send-to-compare]').click();
    await stale.waitForSelector('dialog.v40-handoff-dialog[open]');
    await stale.locator('input[name="v40-target"][value="a"]').check();
    await stale.locator('[data-v40-confirm]').click();
    await stale.waitForURL(/\/production-shell\/quote-compare\/?$/, { timeout: 30000 });
    await stale.waitForSelector('[data-v41-shell-preview]', { timeout: 30000 });
    const oldTransfer = await stale.evaluate(() => window.InteriorProductionCompareAdapter41.readTransfer());
    must(!!oldTransfer?.source && !!oldTransfer?.handoff, 'stale tab captured exact transfer');

    const newer = await context.newPage();
    await goto(newer, 'index.html');
    const newerSnapshot = await newer.evaluate(() => {
      const sourceKey = 'interior-quote-source-v41';
      const handoffKey = 'interior-quote-compare-handoff-v41';
      const old = JSON.parse(localStorage.getItem(sourceKey));
      const transferId = 'ci-newer-' + Date.now();
      const createdAt = new Date().toISOString();
      const source = {
        version: 2,
        transferId,
        createdAt,
        quote: JSON.parse(JSON.stringify(old.quote))
      };
      source.quote.items.demolition.amount = '555';
      const handoff = { version: 2, target: 'b', transferId, createdAt };
      localStorage.setItem(sourceKey, JSON.stringify(source));
      localStorage.setItem(handoffKey, JSON.stringify(handoff));
      return { source, handoff };
    });

    await stale.waitForFunction(
      () => (document.querySelector('[data-v41-shell-status]')?.textContent || '').includes('snapshot이 변경되어 기존 미리보기를 무효화'),
      null,
      { timeout: 15000 }
    );
    must((await stale.locator('[data-v41-shell-preview]').count()) === 0, 'stale preview invalidated by native storage event');

    const staleCleanup = await stale.evaluate(async (old) => {
      return await window.InteriorProductionCompareAdapter41.clearOwnedTransferExclusive(old);
    }, oldTransfer);
    must(staleCleanup === false, 'stale cleanup refuses newer transfer', String(staleCleanup));

    const persistedNewer = await newer.evaluate(() => ({
      source: JSON.parse(localStorage.getItem('interior-quote-source-v41')),
      handoff: JSON.parse(localStorage.getItem('interior-quote-compare-handoff-v41'))
    }));
    must(persistedNewer.source?.transferId === newerSnapshot.source.transferId, 'newer source preserved after stale cleanup');
    must(persistedNewer.handoff?.transferId === newerSnapshot.handoff.transferId, 'newer handoff preserved after stale cleanup');
    must(persistedNewer.handoff?.target === 'b', 'newer target preserved', persistedNewer.handoff?.target || 'missing');

    await newer.evaluate(() => {
      localStorage.removeItem('interior-quote-source-v41');
      localStorage.removeItem('interior-quote-compare-handoff-v41');
    });
    await newer.close();
    await stale.close();

    // Touch + overflow regression at the required mobile widths.
    for (const width of [360, 375, 390, 430]) {
      const mobileContext = await browser.newContext({
        viewport: { width, height: 800 },
        hasTouch: true,
        isMobile: true,
        locale: 'ko-KR'
      });
      const mp = await mobileContext.newPage();
      await goto(mp, 'quote-check/');
      await mp.waitForSelector('[data-send-to-compare]', { timeout: 30000 });
      const quoteMetrics = await mp.evaluate(() => ({
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        sendHeight: document.querySelector('[data-send-to-compare]')?.getBoundingClientRect().height || 0
      }));
      must(!quoteMetrics.pageOverflow, 'mobile ' + width + ' quote-check no page overflow');
      must(quoteMetrics.sendHeight >= 44, 'mobile ' + width + ' send action >=44px', quoteMetrics.sendHeight);
      await mp.locator('[data-send-to-compare]').tap();
      await mp.waitForSelector('dialog.v40-handoff-dialog[open]');
      const dialogBox = await mp.locator('dialog.v40-handoff-dialog').boundingBox();
      must(!!dialogBox && dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= width + 1, 'mobile ' + width + ' dialog within viewport', JSON.stringify(dialogBox));
      await mp.locator('[data-v40-cancel]').tap();

      await goto(mp, 'quote-compare/');
      await mp.waitForSelector('[data-compare-table]', { timeout: 30000 });
      const compareMetrics = await mp.evaluate(() => ({
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        tablePresent: !!document.querySelector('[data-compare-table]')
      }));
      must(!compareMetrics.pageOverflow, 'mobile ' + width + ' quote-compare no page overflow');
      must(compareMetrics.tablePresent, 'mobile ' + width + ' compare table present');
      await mobileContext.close();
    }

    await inspector.bringToFront();
    await inspector.locator('#compare').click();
    await inspector.waitForFunction(() => (document.querySelector('#summary')?.textContent || '').startsWith('PASS'));
    const baselineSummary = (await inspector.locator('#summary').textContent()) || '';
    record('same-tab production storage baseline compare', true, baselineSummary);

    const prodAfter = await snapshotProd(inspector);
    must(sameObject(prodBaseline, prodAfter), 'production-named storage exact values unchanged', JSON.stringify(prodAfter));

    for (const k of REVIEW_KEYS) {
      await inspector.evaluate((key) => localStorage.removeItem(key), k);
    }

    must(pageErrors.length === 0, 'no uncaught page errors', JSON.stringify(pageErrors));

    const report = {
      schema: 'interior-v41-browser-qa/v1',
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      secureContext: secure,
      automaticChecks: 106,
      mobileWidths: [360, 375, 390, 430],
      productionKeys: PROD_KEYS,
      productionBaseline: prodBaseline,
      productionAfter: prodAfter,
      passed: results.filter((r) => r.ok).length,
      failed: failures.length,
      results,
      failures,
      pageErrors
    };
    await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log('QA_RESULT=' + OUT);
    console.log('QA_TOTAL_ASSERTIONS=' + results.length);
    console.log('QA_FAILURES=' + failures.length);
    if (failures.length) process.exitCode = 1;
  } catch (err) {
    const report = {
      schema: 'interior-v41-browser-qa/v1',
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      passed: results.filter((r) => r.ok).length,
      failed: failures.length + 1,
      results,
      failures: [...failures, { name: 'fatal', detail: String(err?.stack || err) }],
      pageErrors
    };
    await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8').catch(() => {});
    console.error(err?.stack || err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
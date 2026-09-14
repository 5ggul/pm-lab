const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = 'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const OUT = path.join(__dirname, 'browser-artifacts');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const q = (item, vendor, kind) => `[data-compare-row="${item}"] [data-vendor="${vendor}"][data-${kind}]`;
const quoteAmount = item => `[data-qrow="${item}"] [data-q-amount]`;
const quoteState = (item, state) => `[data-qrow="${item}"] input[name="state-${item}"][value="${state}"]`;

async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 150, timeout: 4000 }).catch(() => {});
  await sleep(120);
}

async function setInput(page, selector, value) {
  await page.$eval(selector, (el, next) => {
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(value));
}

async function setSelect(page, selector, value) {
  const selected = await page.select(selector, value);
  assert.ok(selected.includes(value), `select failed: ${selector} -> ${value}`);
}

async function value(page, selector) {
  return page.$eval(selector, el => el.value);
}

async function storage(page, key) {
  return page.evaluate(k => localStorage.getItem(k), key);
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

function watchErrors(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(`${label}: pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`${label}: console.error: ${msg.text()}`);
  });
  return errors;
}

async function assertDialogFits(page, selector, viewportWidth) {
  const box = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
  });
  assert.ok(box.left >= -1, `dialog left overflow: ${JSON.stringify(box)}`);
  assert.ok(box.right <= viewportWidth + 1, `dialog right overflow: ${JSON.stringify(box)}`);
}

async function runDesktop(browser, report) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const errors = watchErrors(page, 'desktop');

  await page.goto(`${ROOT}/quote-compare/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await clearStorage(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);

  await setSelect(page, q('demolition', 'a', 'state'), 'included');
  await setInput(page, q('demolition', 'a', 'amount'), 111);
  await setSelect(page, q('bathroom', 'c', 'state'), 'separate');
  await setInput(page, q('bathroom', 'c', 'amount'), 333);
  await setSelect(page, q('demolition', 'b', 'state'), 'separate');
  await setInput(page, q('demolition', 'b', 'amount'), 999);
  await page.click('[data-save-compare]');
  await sleep(120);
  assert.ok(await storage(page, 'interior-compare-v5'), 'v5 compare save missing before handoff');
  assert.ok(await storage(page, 'interior-compare-v6'), 'v6 compare save missing before handoff');

  await page.goto(`${ROOT}/quote-check/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.waitForSelector('[data-v42-send-to-compare]');
  await setInput(page, '[data-context="supply"]', 32);
  await page.click(quoteState('demolition', 'included'));
  await setInput(page, quoteAmount('demolition'), 120);
  await page.click(quoteState('bathroom', 'separate'));
  await setInput(page, quoteAmount('bathroom'), 450);

  await page.click('[data-v42-send-to-compare]');
  await page.waitForSelector('dialog.v42-handoff-dialog[open]');
  await page.click('input[name="v42-target"][value="b"]');
  await screenshot(page, 'desktop-quote-send-dialog.png');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('[data-v42-send]')
  ]);
  await settle(page);
  assert.equal(new URL(page.url()).pathname, '/pm-lab/interior-cost-preview/quote-compare/');
  assert.equal(new URL(page.url()).search, '', 'quote payload or query leaked into URL');
  await page.waitForSelector('dialog.v42-handoff-dialog[open] [data-v42-import-apply]');
  const importText = await page.$eval('dialog.v42-handoff-dialog[open]', el => el.innerText);
  assert.match(importText, /B 업체 칸으로 가져오기/);
  assert.match(importText, /2 \/ 12/);
  assert.match(importText, /570만원/);
  await screenshot(page, 'desktop-compare-import.png');

  await page.click('[data-v42-import-apply]');
  await sleep(180);
  assert.equal(await value(page, q('demolition', 'b', 'state')), 'included');
  assert.equal(await value(page, q('demolition', 'b', 'amount')), '120');
  assert.equal(await value(page, q('bathroom', 'b', 'state')), 'separate');
  assert.equal(await value(page, q('bathroom', 'b', 'amount')), '450');
  assert.equal(await value(page, q('demolition', 'a', 'amount')), '111', 'A value was overwritten');
  assert.equal(await value(page, q('bathroom', 'c', 'amount')), '333', 'C value was overwritten');
  assert.equal(await storage(page, 'interior-quote-compare-handoff-v42'), null, 'handoff flag not cleared after apply');
  const v5 = JSON.parse(await storage(page, 'interior-compare-v5'));
  const v6 = JSON.parse(await storage(page, 'interior-compare-v6'));
  assert.deepEqual(v5, v6, 'v5/v6 compare payloads differ');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  assert.equal(await value(page, q('demolition', 'b', 'amount')), '120', 'B value did not survive reload');
  assert.equal(await value(page, q('demolition', 'a', 'amount')), '111', 'A value did not survive reload');
  assert.equal(await value(page, q('bathroom', 'c', 'amount')), '333', 'C value did not survive reload');

  const resetNav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => null);
  await page.click('[data-reset-compare]');
  await resetNav;
  await settle(page);
  assert.equal(await storage(page, 'interior-compare-v5'), null, 'v5 remained after reset');
  assert.equal(await storage(page, 'interior-compare-v6'), null, 'v6 remained after reset');
  assert.equal(await value(page, q('demolition', 'b', 'amount')), '', 'B amount remained after reset');
  assert.equal(await value(page, q('demolition', 'b', 'state')), 'missing', 'B state remained after reset');

  await page.goto(`${ROOT}/quote-check/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.click(quoteState('demolition', 'included'));
  await setInput(page, quoteAmount('demolition'), 50);
  await page.click('[data-v42-send-to-compare]');
  await page.waitForSelector('dialog.v42-handoff-dialog[open]');
  await page.click('input[name="v42-target"][value="c"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('[data-v42-send]')
  ]);
  await settle(page);
  await page.waitForSelector('[data-v42-import-cancel]');
  await page.click('[data-v42-import-cancel]');
  await sleep(120);
  assert.equal(await storage(page, 'interior-quote-compare-handoff-v42'), null, 'handoff flag not cleared on cancel');
  assert.equal(await value(page, q('demolition', 'c', 'amount')), '', 'cancel changed C value');
  assert.equal(await storage(page, 'interior-compare-v5'), null, 'cancel unexpectedly wrote v5');
  assert.equal(await storage(page, 'interior-compare-v6'), null, 'cancel unexpectedly wrote v6');

  await page.evaluate(() => {
    localStorage.setItem('interior-quote-v5', JSON.stringify({ items: { demolition: { state: 'included', amount: '88' } } }));
    localStorage.setItem('interior-quote-compare-handoff-v42', JSON.stringify({
      version: 1,
      target: 'a',
      createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString()
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  assert.equal(await storage(page, 'interior-quote-compare-handoff-v42'), null, 'stale handoff was not removed');
  assert.equal(await page.$('dialog.v42-handoff-dialog[open]'), null, 'stale handoff opened import dialog');

  assert.deepEqual(errors, [], `desktop browser errors:\n${errors.join('\n')}`);
  report.desktop = 'PASS';
  await page.close();
}

async function runMobile(browser, report) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = watchErrors(page, 'mobile');

  await page.goto(`${ROOT}/quote-check/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await clearStorage(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.waitForSelector('[data-v42-send-to-compare]');
  await page.click(quoteState('demolition', 'included'));
  await setInput(page, quoteAmount('demolition'), 77);
  const quoteOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(quoteOverflow <= 1, `mobile quote page horizontal overflow: ${quoteOverflow}px`);

  await page.click('[data-v42-send-to-compare]');
  await page.waitForSelector('dialog.v42-handoff-dialog[open]');
  await assertDialogFits(page, 'dialog.v42-handoff-dialog[open]', 390);
  const sendActionsVisible = await page.$$eval('dialog.v42-handoff-dialog[open] .v42-dialog-actions button', buttons => buttons.length === 2 && buttons.every(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }));
  assert.ok(sendActionsVisible, 'mobile send dialog actions are not visible');
  await screenshot(page, 'mobile-quote-send-dialog.png');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('[data-v42-send]')
  ]);
  await settle(page);
  await page.waitForSelector('dialog.v42-handoff-dialog[open] [data-v42-import-apply]');
  await assertDialogFits(page, 'dialog.v42-handoff-dialog[open]', 390);
  const compareOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(compareOverflow <= 1, `mobile compare page horizontal overflow: ${compareOverflow}px`);
  await screenshot(page, 'mobile-compare-import.png');
  await page.click('[data-v42-import-apply]');
  await sleep(150);
  assert.equal(await value(page, q('demolition', 'a', 'amount')), '77');
  assert.equal(await value(page, q('demolition', 'a', 'state')), 'included');
  assert.equal(await storage(page, 'interior-quote-compare-handoff-v42'), null);

  assert.deepEqual(errors, [], `mobile browser errors:\n${errors.join('\n')}`);
  report.mobile = 'PASS';
  await page.close();
}

(async () => {
  const report = {
    engine: 'Chromium via puppeteer-core',
    viewportDesktop: '1440x1000',
    viewportMobile: '390x844',
    desktop: 'NOT RUN',
    mobile: 'NOT RUN',
    finishedAt: null
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    await runDesktop(browser, report);
    await runMobile(browser, report);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log('INTERIOR V42 REAL CHROMIUM QA: PASS');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.error = error.stack || String(error);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.error('INTERIOR V42 REAL CHROMIUM QA: FAIL');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

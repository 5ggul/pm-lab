const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

const ROOT = 'http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 150, timeout: 4000 }).catch(() => {});
  await sleep(120);
}

async function storage(page, key) {
  return page.evaluate(k => localStorage.getItem(k), key);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  try {
    await page.goto(`${ROOT}/quote-check/`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    await page.waitForSelector('[data-v42-send-to-compare]');
    await page.click('[data-qrow="demolition"] input[name="state-demolition"][value="included"]');
    await page.$eval('[data-qrow="demolition"] [data-q-amount]', el => {
      el.value = '88';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.click('[data-v42-send-to-compare]');
    await page.waitForSelector('dialog.v42-handoff-dialog[open]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('[data-v42-send]')
    ]);
    await settle(page);

    await page.waitForSelector('dialog.v42-handoff-dialog[open] [data-v42-import-apply]');
    assert.ok(await storage(page, 'interior-quote-compare-handoff-v42'), 'fresh handoff missing before ESC');

    await page.keyboard.press('Escape');
    await sleep(150);

    assert.equal(await storage(page, 'interior-quote-compare-handoff-v42'), null, 'ESC did not clear handoff');
    assert.equal(await page.$('dialog.v42-handoff-dialog[open]'), null, 'dialog remained open after ESC');
    assert.equal(await storage(page, 'interior-compare-v5'), null, 'ESC unexpectedly wrote v5');
    assert.equal(await storage(page, 'interior-compare-v6'), null, 'ESC unexpectedly wrote v6');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    assert.equal(await page.$('dialog.v42-handoff-dialog[open]'), null, 'import dialog reopened after ESC cancel');
    assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);

    console.log('INTERIOR V42 ESC CANCEL QA: PASS');
  } catch (error) {
    console.error('INTERIOR V42 ESC CANCEL QA: FAIL');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

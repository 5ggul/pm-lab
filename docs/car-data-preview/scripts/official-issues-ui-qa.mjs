import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(process.env.OFFICIAL_ISSUES_SITE_ROOT || sourceRoot);
const repository = path.resolve(sourceRoot, '../..');
// A Pages bundle is usually served at the origin root, while the shared
// preview uses /car-data-preview. Let the caller supply the complete base.
const base = (process.env.OFFICIAL_ISSUES_BASE || process.env.CAR_PAGES_BASE || process.env.CAR_PREVIEW_BASE || 'http://127.0.0.1:4173/car-data-preview').replace(/\/$/, '');
const output = path.resolve(process.env.OFFICIAL_ISSUES_QA_OUTPUT || path.join(repository, 'output/playwright/official-issues'));
fs.mkdirSync(output, {recursive:true});
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/generated/official-issues-index.json'), 'utf8'));
const grandeur = index.families.find(family => family.family_id === 'hyundai-grandeur');
const unknown = index.families.find(family => family.match_status !== 'verified');
assert.ok(index.sources.reports.available && grandeur?.match_status === 'verified' && unknown, 'Use a validated official snapshot for browser QA');
const recallHtml = fs.readFileSync(path.join(root, 'recalls/index.html'), 'utf8');
const recallData = JSON.parse(recallHtml.match(/<script\b[^>]*id="decision-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] || '{}');
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
const errors = [], results = [];
const page = await newQaPage(browser, {viewport:{width:390,height:844}});
page.on('pageerror', error => errors.push({url:page.url(),message:error.message}));

const go = async route => {
  const response = await page.goto(base + route, {waitUntil:'load'});
  assert.equal(response.status(), 200, route);
};
const readyReports = () => page.waitForFunction(() => !document.querySelector('#issues-filter')?.hidden && document.querySelector('#issues-source-status')?.textContent.includes('연간 공개 파일'));
const readyLinks = () => page.waitForFunction(() => document.querySelector('#vehicle-issues .vehicle-official-issues-source'));
const renderedCount = async () => Number((await page.locator('.issues-report-number').innerText()).replace(/[^0-9]/g, ''));
const setMonth = async (id,value) => { await page.locator(id).fill(value); await page.locator(id).dispatchEvent('change'); };
async function run(name, fn) {
  try { await fn(); results.push({name,ok:true}); console.log(`Official issues UI PASS: ${name}`); }
  catch (error) {
    results.push({name,ok:false,error:error.message});
    await page.screenshot({path:path.join(output, 'failure-' + name.replace(/[^a-z0-9-]/gi,'-') + '.png'),fullPage:true}).catch(() => {});
    throw error;
  }
}

try {
  await run('roving-tabs-arrow-home-end-focus-and-tab-order', async () => {
    await go('/recalls/?tab=recalls');
    const expectSelected = async name => {
      const actual = await page.locator('.official-issues-tabs [role="tab"]').evaluateAll(tabs => tabs.map(tab => ({name:tab.dataset.issuesTab,selected:tab.getAttribute('aria-selected'),tabIndex:tab.tabIndex,tabindex:tab.getAttribute('tabindex'),focused:document.activeElement===tab,controls:tab.getAttribute('aria-controls'),id:tab.id})));
      assert.equal(actual.length, 3, 'All official source tabs are present');
      assert.equal(actual.filter(tab => tab.selected === 'true').length, 1, 'Exactly one tab is selected');
      assert.equal(actual.filter(tab => tab.tabIndex === 0).length, 1, 'Only the selected tab is in the document tab order');
      for (const tab of actual) {
        const selected = tab.name === name;
        assert.equal(tab.selected, String(selected), tab.name + ' selected state');
        assert.equal(tab.tabIndex, selected ? 0 : -1, tab.name + ' roving tab index');
        assert.equal(tab.tabindex, String(selected ? 0 : -1), tab.name + ' explicit tab index');
        assert.equal(tab.focused, selected, tab.name + ' keyboard focus follows selection');
        const panel = page.locator('#' + tab.controls);
        assert.equal(await panel.getAttribute('role'), 'tabpanel');
        assert.equal(await panel.getAttribute('aria-labelledby'), tab.id);
        assert.equal(await panel.isVisible(), selected, tab.name + ' panel visibility follows selection');
      }
      assert.equal(new URL(page.url()).searchParams.get('tab'), name, 'Keyboard selection updates the recoverable URL');
    };
    await page.locator('[data-issues-tab="recalls"]').focus();
    await expectSelected('recalls');
    // Tab skips the two inactive tabs; Shift+Tab returns to the sole active tab.
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'recall-q');
    await page.keyboard.press('Shift+Tab');
    await expectSelected('recalls');
    for (const [key, selected] of [['ArrowLeft','free-repairs'],['ArrowRight','recalls'],['ArrowRight','reports'],['End','free-repairs'],['Home','recalls'],['End','free-repairs'],['ArrowRight','recalls'],['ArrowRight','reports'],['ArrowRight','free-repairs'],['ArrowLeft','reports']]) {
      await page.keyboard.press(key);
      await expectSelected(selected);
    }
    await readyReports();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'issues-q', 'Tab enters the active reports panel rather than another tab');
    await page.keyboard.press('Shift+Tab');
    await expectSelected('reports');
  });

  await run('tabs-search-model-year-period-and-url-restore', async () => {
    await go('/recalls/?tab=reports'); await readyReports();
    assert.equal(await page.locator('[data-issues-tab="reports"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#issues-recalls').isVisible(), false);
    await page.locator('#issues-q').fill('그랜저');
    await page.locator('[data-issues-family="hyundai-grandeur"]').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'issues-model-year', 'Removing a chosen family button must move focus into the selected-vehicle controls');
    assert.equal(await renderedCount(), grandeur.report_count);
    assert.match(await page.locator('#issues-source-status').innerText(), new RegExp(index.sources.reports.period.from));
    assert.match(await page.locator('#issues-source-status').innerText(), new RegExp(index.sources.reports.period.to));
    const year = String(grandeur.by_model_year.slice().sort((a,b) => b.count-a.count)[0].year);
    const from = index.sources.reports.period.from.slice(0,7), to = from.slice(0,5) + '03';
    await page.locator('#issues-model-year').selectOption(year);
    await setMonth('#issues-from', from); await setMonth('#issues-to', to);
    const expected = grandeur.reports.filter(record => String(record.model_year) === year && record.received_month >= from && record.received_month <= to).reduce((sum, record) => sum + record.count, 0);
    assert.equal(await renderedCount(), expected);
    const saved = page.url();
    assert.equal(new URL(saved).searchParams.get('modelYear'), year);
    assert.equal(new URL(saved).searchParams.get('from'), from);
    assert.equal(new URL(saved).searchParams.get('to'), to);
    await page.reload({waitUntil:'load'}); await readyReports();
    assert.equal(await page.locator('#issues-model-year').inputValue(), year);
    assert.equal(await page.locator('#issues-from').inputValue(), from);
    assert.equal(await page.locator('#issues-to').inputValue(), to);
    assert.equal(await renderedCount(), expected);
    await setMonth('#issues-from', from.slice(0,5) + '12');
    assert.equal(await page.locator('#issues-filter-error').isVisible(), true);
    assert.equal(await page.locator('.issues-report-number').count(), 0);
    await page.goto(saved); await readyReports();
    await page.locator('[data-issues-tab="free-repairs"]').click();
    assert.equal(await page.locator('#issues-free-repairs').isVisible(), true);
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'free-repairs');
    assert.equal(await page.locator('#issues-free-repairs a[href="https://www.car.go.kr/ri/grts/list.do"]').count(), 1);
    await page.goBack(); await readyReports();
    assert.equal(await renderedCount(), expected);
    await page.locator('[data-issues-tab="reports"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('[data-issues-tab="recalls"]').getAttribute('aria-selected'), 'true');
  });

  await run('legacy-recall-search-and-id-redirect', async () => {
    await go('/recalls/?q=GV70');
    assert.equal(await page.locator('#recall-q').inputValue(), 'GV70');
    const visible = await page.locator('[data-recall-id]:visible').allTextContents();
    assert.ok(visible.length > 0 && visible.every(text => /GV70/i.test(text)), 'Existing recall query must continue to filter the original notices');
    assert.ok(recallData.aliases?.length);
    const alias = recallData.aliases[0];
    await page.goto(base + '/recalls/?id=' + encodeURIComponent(alias.id));
    await page.waitForURL(base + '/recalls/' + alias.slug + '/');
    assert.equal(await page.locator('h1').count(), 1);
  });

  await run('recall-family-links-and-tab-selection-scope', async () => {
    const expectScope = async (name, route) => {
      if (route) await go(route);
      await page.waitForFunction(expected => document.querySelector('#recall-q')?.value === expected, name);
      const visible = await page.locator('[data-recall-id]:visible').allTextContents();
      assert.ok(visible.length > 0 && visible.every(text => text.includes(name)), `Recall results must remain scoped to ${name}`);
    };
    await go('/cars/hyundai/grandeur-gn7/'); await readyLinks();
    await page.locator('#vehicle-issues a[href*="tab=recalls"]').click();
    await expectScope('그랜저');
    assert.equal(new URL(page.url()).searchParams.get('family'), 'hyundai-grandeur');
    await expectScope('그랜저', '/recalls/?tab=recalls&family=hyundai-grandeur');
    await page.locator('#recall-q').fill('GV70');
    await page.waitForURL(url => url.searchParams.get('q') === 'GV70');
    await page.locator('[data-issues-tab="reports"]').click(); await readyReports();
    await page.locator('[data-issues-tab="recalls"]').click();
    await expectScope('GV70');
    await go('/recalls/?tab=reports'); await readyReports();
    await page.locator('#issues-q').fill('K8');
    await page.locator('[data-issues-family="kia-k8"]').click();
    await page.locator('[data-issues-tab="recalls"]').click();
    await expectScope('K8');
    await expectScope('GV70', '/recalls/?tab=recalls&family=hyundai-grandeur&q=GV70');
  });

  await run('keyboard-more-results-focus', async () => {
    await go('/recalls/?tab=reports'); await readyReports();
    assert.equal(await page.locator('#issues-family-list [data-issues-family]').count(), 12);
    await page.locator('#issues-more').click();
    assert.equal(await page.locator('#issues-family-list [data-issues-family]').count(), 24);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('#issues-family-list [data-issues-family]')[12]), true, 'More results must focus the first newly revealed family');
  });

  await run('unmapped-out-of-scope-and-verified-zero-distinction', async () => {
    await go('/recalls/?tab=reports&family=' + encodeURIComponent(unknown.family_id)); await readyReports();
    assert.match(await page.locator('#issues-report-result').innerText(), /차명 연결을 검토/);
    assert.equal(await page.locator('.issues-report-number').count(), 0);
    await go('/recalls/?tab=reports&family=hyundai-grandeur&modelYear=1900'); await readyReports();
    assert.match(await page.locator('#issues-report-result').innerText(), /수록 자료에서 확인되지/);
    assert.equal(await page.locator('.issues-report-number').count(), 0);
    await go('/recalls/?tab=reports&family=hyundai-grandeur&from=2099-01'); await readyReports();
    assert.match(await page.locator('#issues-report-result').innerText(), /범위 밖/);
    assert.equal(await page.locator('.issues-report-number').count(), 0);
    const fixture = structuredClone(index);
    Object.assign(fixture.families.find(family => family.family_id === grandeur.family_id), {report_count:0,reports:[],by_model_year:[],by_received_month:[]});
    await page.route('**/official-issues-index.json*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
    try {
      await go('/recalls/?tab=reports&family=hyundai-grandeur'); await readyReports();
      assert.equal(await renderedCount(), 0);
      assert.match(await page.locator('#issues-report-result').innerText(), /결함이나 신고 이력이 없다는 뜻은 아닙니다/);
    } finally { await page.unroute('**/official-issues-index.json*'); }
  });

  await run('source-network-failure-and-retry', async () => {
    await page.route('**/official-issues-index.json*', route => route.abort('failed'));
    await go('/recalls/?tab=reports&family=hyundai-grandeur');
    await page.locator('#issues-retry').waitFor();
    assert.match(await page.locator('#issues-source-status').innerText(), /조회 실패를 신고 0건으로 표시하지 않습니다/);
    assert.equal(await page.locator('.issues-report-number').count(), 0);
    await page.unroute('**/official-issues-index.json*');
    await page.locator('#issues-retry').click(); await readyReports();
    assert.equal(await renderedCount(), grandeur.report_count);
  });

  await run('source-unavailable-and-failed-status-retain-last-good-data', async () => {
    const unavailable = structuredClone(index);
    unavailable.sources.reports.available = false;
    await page.route('**/official-issues-index.json*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unavailable)}));
    try {
      await go('/recalls/?tab=reports&family=hyundai-grandeur');
      await page.waitForFunction(() => document.querySelector('#issues-source-status')?.textContent.includes('조회 실패를 신고 0건으로 표시하지 않습니다'));
      assert.equal(await page.locator('.issues-report-number').count(), 0);
      assert.equal(await page.locator('#issues-filter').isVisible(), false);
    } finally { await page.unroute('**/official-issues-index.json*'); }
    await page.route('**/official-issues-status.json*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,checked_at:new Date().toISOString(),source_states:{reports:{ok:false,checked_at:new Date().toISOString()}}})}));
    try {
      await go('/recalls/?tab=reports&family=hyundai-grandeur'); await readyReports();
      assert.equal(await renderedCount(), grandeur.report_count);
      assert.match(await page.locator('#issues-source-status').innerText(), /최근 변경 확인 실패: 마지막 정상 자료 표시/);
    } finally { await page.unroute('**/official-issues-status.json*'); }
  });

  await run('static-and-family-detail-and-fixed-pair-links', async () => {
    for (const route of ['/cars/hyundai/grandeur-gn7/', '/cars/family/?id=hyundai-grandeur']) {
      await go(route); await readyLinks();
      assert.match(await page.locator('#vehicle-issues').innerText(), new RegExp(grandeur.report_count.toLocaleString('ko-KR') + '건'));
      assert.match(await page.locator('#vehicle-issues').innerText(), /차종 전체 기준/);
      for (const tab of ['reports','recalls','free-repairs']) {
        const link = await page.locator(`#vehicle-issues a[href*="tab=${tab}"]`).getAttribute('href');
        assert.equal(new URL(link, page.url()).searchParams.get('family'), 'hyundai-grandeur');
      }
    }
    await go('/compare/grandeur-vs-k8/'); await readyLinks();
    const rows = page.locator('#vehicle-issues .vehicle-official-issues-row');
    assert.equal(await rows.count(), 2);
    assert.equal(new URL(await rows.nth(0).locator('a').first().getAttribute('href'), page.url()).searchParams.get('family'), 'hyundai-grandeur');
    assert.equal(new URL(await rows.nth(1).locator('a').first().getAttribute('href'), page.url()).searchParams.get('family'), 'kia-k8');
  });

  await run('custom-compare-selection-and-url-restore', async () => {
    await go('/compare/?fa=hyundai-grandeur&fb=kia-k8&km=20000'); await readyLinks();
    await page.waitForFunction(() => document.querySelectorAll('#vehicle-issues .vehicle-official-issues-row').length === 2);
    await page.locator('#familyA').fill('기아 쏘렌토');
    await page.waitForFunction(() => document.querySelector('#vehicle-issues .vehicle-official-issues-row h3')?.textContent === 'A 쏘렌토');
    await page.locator('#familyB').fill('현대 그랜저');
    await page.waitForFunction(() => document.querySelectorAll('#vehicle-issues .vehicle-official-issues-row h3')[1]?.textContent === 'B 그랜저');
    const saved = page.url();
    assert.equal(new URL(saved).searchParams.get('fa'), 'kia-sorento');
    assert.equal(new URL(saved).searchParams.get('fb'), 'hyundai-grandeur');
    await page.reload(); await readyLinks();
    assert.match(await page.locator('#vehicle-issues').innerText(), /A 쏘렌토/);
    assert.match(await page.locator('#vehicle-issues').innerText(), /B 그랜저/);
    await page.locator('#familyA').fill('존재하지 않는 차종');
    await page.waitForFunction(() => !document.querySelector('#vehicle-issues .vehicle-official-issues-row'));
    assert.equal(await page.locator('#vehicle-issues a[href*="family="]').count(), 0);
    await page.locator('#reviewedMode').click();
    await page.locator('#carA').selectOption('k8-gl3');
    await page.locator('#carB').selectOption('grandeur-gn7');
    await page.waitForFunction(() => document.querySelector('#vehicle-issues .vehicle-official-issues-row h3')?.textContent === 'A K8');
    assert.match(await page.locator('#vehicle-issues').innerText(), /B 그랜저/);
  });

  const viewports = [{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
  const routes = [
    ['reports','/recalls/?tab=reports&family=hyundai-grandeur'],
    ['recalls','/recalls/?tab=recalls'],
    ['free-repairs','/recalls/?tab=free-repairs'],
    ['detail','/cars/hyundai/grandeur-gn7/'],
    ['family','/cars/family/?id=hyundai-grandeur'],
    ['compare','/compare/?fa=hyundai-grandeur&fb=kia-k8']
  ];
  for (const viewport of viewports) await run(`layout-${viewport.width}x${viewport.height}`, async () => {
    await page.setViewportSize(viewport);
    for (const [name, route] of routes) {
      await go(route);
      if (name === 'reports') await readyReports();
      if (['detail','family','compare'].includes(name)) await readyLinks();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => ({viewport:innerWidth,width:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length}));
      assert.ok(layout.width <= layout.viewport, `${name}: horizontal overflow ${layout.width}/${layout.viewport}`);
      assert.equal(layout.h1, 1, name);
      if (['detail','family','compare'].includes(name)) {
        const alignment = await page.evaluate(() => {
          const heading = document.querySelector('#vehicle-issues h2')?.getBoundingClientRect();
          const main = document.querySelector('.decision-main')?.getBoundingClientRect();
          return {headingLeft:heading?.left,headingRight:heading?.right,mainLeft:main?.left,viewport:innerWidth};
        });
        const gutter = viewport.width <= 700 ? 16 : 24;
        assert.ok(alignment.headingLeft >= gutter - 1, `${name}: official-information heading needs ${gutter}px outer spacing, got ${alignment.headingLeft}`);
        assert.ok(alignment.headingRight <= alignment.viewport - gutter + 1, `${name}: official-information heading exceeds the right content gutter`);
        if (name === 'compare' && Number.isFinite(alignment.mainLeft)) assert.ok(Math.abs(alignment.headingLeft - alignment.mainLeft) <= 1, `compare: official-information heading must share the comparison content axis (${alignment.headingLeft}/${alignment.mainLeft})`);
      }
      if (name === 'reports') {
        const targets = await page.locator('.official-issues-tabs a,#issues-selected button,#issues-period-fields input,#issues-period-fields select').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({text:element.textContent || element.id,height:element.getBoundingClientRect().height})));
        assert.ok(targets.every(target => target.height >= 44), JSON.stringify(targets));
        if ([390,1280].includes(viewport.width)) await page.screenshot({path:path.join(output, `${name}-${viewport.width}.png`),fullPage:true});
      }
      if (['family','compare'].includes(name) && viewport.width === 390) {
        await page.locator('#vehicle-issues').screenshot({path:path.join(output, `${name}-links-390.png`)});
      }
    }
  });
  assert.deepEqual(errors, [], 'New official-issues interactions must not cause browser exceptions');
} finally {
  fs.writeFileSync(path.join(output, 'qa-result.json'), JSON.stringify({base,checked_at:new Date().toISOString(),external_photo_requests:'shared qa-photo-fixture',results,browser_errors:errors},null,2) + '\n');
  await browser.close();
}
console.log(`Official issues UI QA PASS: ${results.length} scenarios including 6 page types × 6 viewports; evidence ${output}`);

import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});

try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  await page.goto(base+'/tools/annual-cost/?mode=all&fa=hyundai-nexo');
  await page.waitForFunction(()=>document.querySelector('#price')?.disabled===true);
  await page.locator('#reviewedMode').click();
  await page.locator('#car').selectOption('ev6-cv');
  assert.equal(await page.locator('#price').isEnabled(),true,'switching away from hydrogen must unlock the charging-price input');
  await page.locator('#price').fill('300');
  await page.waitForFunction(()=>/원$/.test(document.querySelector('#total')?.textContent||''));

  await page.goto(base+'/tools/annual-cost/?mode=reviewed&car=grandeur-gn7&variant=gn7-g25-2wd-18&km=20000');
  await page.waitForFunction(()=>document.querySelector('#car')?.value==='grandeur-gn7'&&document.querySelector('#reg')?.disabled===false);
  await page.locator('#reg').fill('2023-01');
  await page.locator('#reg').press('Tab');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('reg')==='2023-01');
  const taxBefore=await page.locator('#tax').textContent();
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#reg')?.value==='2023-01');
  assert.equal(await page.locator('#tax').textContent(),taxBefore,'registration month and age-adjusted tax must survive reload');

  await page.goto(base+'/compare/?mode=reviewed&a=grandeur-gn7&av=gn7-g25-2wd-18&b=grandeur-gn7&bv=gn7-g25-2wd-19&km=1000&gas=1858.27');
  await page.waitForFunction(()=>document.querySelector('#compareConclusion')?.textContent?.includes('4,180원'));
  assert.doesNotMatch(await page.locator('#compareConclusion').textContent(),/0만 원/,'small positive differences must never round to zero');

  await page.goto(base+'/tools/annual-cost/?mode=reviewed&car=grandeur-gn7&variant=gn7-g25-2wd-18&km=20000&cprice_gasoline=1e308');
  await page.waitForFunction(()=>document.querySelector('#calcWarning')?.textContent?.includes('1,000,000원'));
  assert.doesNotMatch(await page.locator('main').innerText(),/∞|Infinity/,'calculator must reject overflowing prices');
  assert.equal(new URL(page.url()).searchParams.has('cprice_gasoline'),false,'invalid price must be removed from the share URL');

  await page.goto(base+'/compare/?mode=reviewed&a=grandeur-gn7&av=gn7-g25-2wd-18&b=k8-gl3&km=20000&gas=1e308');
  await page.waitForFunction(()=>document.querySelector('#compareWarning')?.textContent?.includes('1,000,000원'));
  assert.doesNotMatch(await page.locator('main').innerText(),/∞|Infinity/,'comparison must reject overflowing prices');

  await page.goto(base+'/cars/family/?id=hyundai-nexo');
  await page.locator('.family-preview-note').waitFor({state:'visible'});
  assert.equal(await page.locator('.family-preview-note').textContent(),'신고 사양 미리보기');

  await page.goto(base+'/cars/kia/ev6/');
  assert.equal(await page.locator('body').getAttribute('data-car'),'ev6-cv');
  assert.equal(await page.locator('#variantButtons').evaluate(element=>getComputedStyle(element).minHeight),'256px','EV6 mobile selector must reserve the async variant-chip height');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'EV6 mobile overflow');

  const desktop=await browser.newPage({viewport:{width:1280,height:900}});
  await desktop.goto(base+'/cars/kia/ev6/');
  assert.equal(await desktop.locator('#variantButtons').evaluate(element=>getComputedStyle(element).minHeight),'98px','EV6 desktop selector must reserve the async variant-chip height');
  await desktop.goto(base+'/cars/?q=넥쏘');
  await desktop.waitForFunction(()=>document.querySelectorAll('.vehicle-card').length===1);
  const heights=await desktop.locator('.site-header-search button,.vehicle-card-actions a,.vehicle-card-actions button').evaluateAll(elements=>elements.filter(element=>getComputedStyle(element).display!=='none').map(element=>element.getBoundingClientRect().height));
  assert(heights.length&&heights.every(height=>height>=44),`desktop interactive targets below 44px: ${heights.join(', ')}`);
  await desktop.close();

  assert.deepEqual(errors,[],'edge-case flows must not throw page errors');
  console.log('edge-case regression QA passed');
}finally{
  await browser.close();
}

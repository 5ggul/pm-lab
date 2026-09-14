const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const TRACKED=['interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46','interior-contract-reflection-v48'];
function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(220)}
async function seedTracked(page){await page.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32',building:'아파트'},items:{demolition:{state:'included',amount:'120'}}}));
  const compare={'demolition:a:state':'included','demolition:a:amount':'100','demolition:b:state':'included','demolition:b:amount':'120','demolition:c:state':'separate','demolition:c:amount':'150'};
  localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
  localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
  localStorage.setItem('interior-review-progress-v46',JSON.stringify({version:1,updatedAt:'2026-09-14T00:00:00.000Z',entries:{'a:demo:x':{done:true,note:'폐기물 반출 포함'}}}));
  localStorage.setItem('interior-contract-reflection-v48',JSON.stringify({version:1,updatedAt:'2026-09-14T00:00:00.000Z',entries:{'a:demo:x':{reflected:true,documentNote:'특약 3항'}}}));
});}
async function sourceSnapshot(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),TRACKED)}
async function baselineRaw(page){return page.evaluate(()=>localStorage.getItem('interior-review-baseline-v49'))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedTracked(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview48),'object','v48 did not auto-load from actual HTML');
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview49),'object','v49 did not auto-load from actual HTML');
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview50),'object','v50 did not auto-load from actual HTML');
  assert.match(await page.$eval('[data-v50-status]',el=>el.innerText),/검수 기준이 없어/);
  assert.equal(await page.$$eval('[data-v50-grid] .v50-card',els=>els.length),0);

  const sourcesBeforeBaseline=await sourceSnapshot(page);
  await page.click('[data-v49-save]');await sleep(120);
  const baseline=await page.evaluate(()=>JSON.parse(localStorage.getItem('interior-review-baseline-v49')));
  assert.equal(baseline.version,1);assert.deepEqual(await sourceSnapshot(page),sourcesBeforeBaseline,'v49 baseline save mutated tracked sources');
  assert.match(await page.$eval('[data-v50-status]',el=>el.innerText),/재검수할 변경이 없습니다/);

  const baselineBeforeChanges=await baselineRaw(page);
  await page.evaluate(()=>{
    const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='135';localStorage.setItem('interior-quote-v5',JSON.stringify(q));
    const c5=JSON.parse(localStorage.getItem('interior-compare-v5'));c5['demolition:a:amount']='110';localStorage.setItem('interior-compare-v5',JSON.stringify(c5));
    const c6=JSON.parse(localStorage.getItem('interior-compare-v6'));c6['demolition:a:amount']='110';localStorage.setItem('interior-compare-v6',JSON.stringify(c6));
    const p=JSON.parse(localStorage.getItem('interior-review-progress-v46'));p.entries['a:demo:x'].note='폐기물 반출과 보양 포함';localStorage.setItem('interior-review-progress-v46',JSON.stringify(p));
    const r=JSON.parse(localStorage.getItem('interior-contract-reflection-v48'));r.entries['a:demo:x'].documentNote='특약 4항으로 이동';localStorage.setItem('interior-contract-reflection-v48',JSON.stringify(r));
  });
  const changedSources=await sourceSnapshot(page);await page.click('[data-refresh-report]');await sleep(180);
  assert.equal(await page.$$eval('[data-v50-grid] .v50-card',els=>els.length),4,'expected quote/compare/progress/reflection tasks');
  const taskIds=await page.$$eval('[data-v50-grid] .v50-card',els=>els.map(el=>el.dataset.task).sort());assert.deepEqual(taskIds,['compare','progress','quote','reflection']);
  assert.equal(await page.$$eval('[data-task="compare"] .v50-chip',els=>els.length),2,'compare v5/v6 should be one task');
  assert.equal(await baselineRaw(page),baselineBeforeChanges,'v50 render mutated v49 baseline');
  assert.deepEqual(await sourceSnapshot(page),changedSources,'v50 render mutated tracked sources');

  const quoteCard='[data-task="quote"]';const quoteCheck=await page.$(`${quoteCard} [data-v50-check]`);const quoteKey=await quoteCheck.evaluate(el=>el.dataset.v50Check);await quoteCheck.click();await sleep(100);
  const note=await page.$(`${quoteCard} [data-v50-note]`);await note.type('견적서 금액과 철거 포함범위 다시 대조함');await sleep(320);
  let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('interior-review-revalidation-v50')));assert.equal(state.version,1);assert.equal(state.entries[quoteKey].done,true);assert.match(state.entries[quoteKey].note,/다시 대조함/);
  assert.equal(await baselineRaw(page),baselineBeforeChanges,'v50 completion mutated baseline');assert.deepEqual(await sourceSnapshot(page),changedSources,'v50 completion mutated tracked sources');
  assert.match(await page.$eval('[data-v50-status]',el=>el.innerText),/재검수 1 \/ 4 완료/);
  const queueText=await page.evaluate(()=>window.InteriorQuoteReview50.queueText());assert.match(queueText,/견적 입력 다시 확인/);assert.match(queueText,/A\/B\/C 비교 다시 확인/);assert.match(queueText,/견적서 금액과 철거 포함범위 다시 대조함/);

  await page.evaluate(()=>{const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='140';localStorage.setItem('interior-quote-v5',JSON.stringify(q))});
  const sourcesAfterSecondQuoteChange=await sourceSnapshot(page);await page.click('[data-refresh-report]');await sleep(160);
  const newQuoteKey=await page.$eval(`${quoteCard} [data-v50-check]`,el=>el.dataset.v50Check);assert.notEqual(newQuoteKey,quoteKey,'quote task signature did not rotate after second change');assert.equal(await page.$eval(`${quoteCard} [data-v50-check]`,el=>el.checked),false,'old completion incorrectly carried into new change');assert.match(await page.$eval('[data-v50-status]',el=>el.innerText),/재검수 0 \/ 4 완료/);
  assert.equal(await baselineRaw(page),baselineBeforeChanges);assert.deepEqual(await sourceSnapshot(page),sourcesAfterSecondQuoteChange);

  const quoteHref=await page.$eval(`${quoteCard} .v50-card-actions a`,el=>el.getAttribute('href'));const compareHref=await page.$eval('[data-task="compare"] .v50-card-actions a',el=>el.getAttribute('href'));assert.equal(quoteHref,'/pm-lab/interior-cost-preview/quote-check/');assert.equal(compareHref,'/pm-lab/interior-cost-preview/quote-compare/');
  await page.emulateMediaType('print');assert.ok(await page.$eval('[data-v50-revalidation-section]',el=>getComputedStyle(el).display!=='none'),'v50 hidden in print');assert.ok(await page.$eval('[data-v50-revalidation-section] .v50-actions',el=>getComputedStyle(el).display==='none'),'v50 actions visible in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v50-revalidation.png'),fullPage:true});assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runBaselineRefresh(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1100,height:900});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedTracked(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await page.click('[data-v49-save]');await sleep(100);
  await page.evaluate(()=>{const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='155';localStorage.setItem('interior-quote-v5',JSON.stringify(q))});await page.click('[data-refresh-report]');await sleep(120);assert.equal(await page.$$eval('[data-v50-grid] .v50-card',els=>els.length),1);
  await page.click('[data-v49-save]');await sleep(160);assert.equal(await page.$$eval('[data-v50-grid] .v50-card',els=>els.length),0,'revalidation queue did not clear after baseline refresh');assert.match(await page.$eval('[data-v50-status]',el=>el.innerText),/재검수할 변경이 없습니다/);
  report.baselineRefresh='PASS';await page.close();
}

async function runReset(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1000,height:820});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedTracked(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await page.click('[data-v49-save]');await sleep(100);await page.evaluate(()=>{const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='160';localStorage.setItem('interior-quote-v5',JSON.stringify(q))});await page.click('[data-refresh-report]');await sleep(100);const sources=await sourceSnapshot(page);const baseline=await baselineRaw(page);await page.click('[data-v50-check]');await sleep(80);assert.ok(await page.evaluate(()=>localStorage.getItem('interior-review-revalidation-v50')));
  page.on('dialog',d=>d.accept());await page.click('[data-v50-reset]');await sleep(120);assert.equal(await page.evaluate(()=>localStorage.getItem('interior-review-revalidation-v50')),null,'v50 reset did not clear only v50 state');assert.deepEqual(await sourceSnapshot(page),sources,'v50 reset mutated tracked sources');assert.equal(await baselineRaw(page),baseline,'v50 reset mutated v49 baseline');
  report.reset='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedTracked(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await page.click('[data-v49-save]');await sleep(100);await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('interior-compare-v5'));c['demolition:a:amount']='111';localStorage.setItem('interior-compare-v5',JSON.stringify(c));const c6=JSON.parse(localStorage.getItem('interior-compare-v6'));c6['demolition:a:amount']='111';localStorage.setItem('interior-compare-v6',JSON.stringify(c6))});await page.click('[data-refresh-report]');await sleep(120);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);assert.equal(await page.$$eval('[data-v50-grid] .v50-card',els=>els.length),1);assert.ok(await page.$eval('[data-v50-note]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile revalidation note hidden');await page.screenshot({path:path.join(OUT,'mobile-v50-revalidation.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',baselineRefresh:'NOT RUN',reset:'NOT RUN',mobile:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runBaselineRefresh(browser,report);await runReset(browser,report);await runMobile(browser,report);const wrapper=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.match(wrapper,/INTERIOR_REVALIDATION_QUOTE_URL='\?page=quote-check'/);assert.match(wrapper,/INTERIOR_REVALIDATION_COMPARE_URL='\?page=quote-compare'/);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V50 REVALIDATION QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V50 REVALIDATION QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

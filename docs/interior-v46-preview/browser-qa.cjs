const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(180)}
async function seed(page){await page.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32',exclusive:'25.7',building:'아파트',region:'서울',scope:'올수리',bathrooms:'2'},items:{demolition:{state:'included',amount:'120'},bathroom:{state:'separate',amount:'450'}}}));
  const compare={
    'demolition:a:state':'included','demolition:a:amount':'100','bathroom:a:state':'separate','bathroom:a:amount':'400','wallpaper:a:state':'included','wallpaper:a:amount':'80',
    'demolition:b:state':'included','demolition:b:amount':'120','bathroom:b:state':'separate','bathroom:b:amount':'450','wallpaper:b:state':'included','wallpaper:b:amount':'',
    'demolition:c:state':'separate','demolition:c:amount':'150','bathroom:c:state':'separate','bathroom:c:amount':'470','wallpaper:c:state':'included','wallpaper:c:amount':'90'
  };
  localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
  localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
});}
async function baseSnapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6')}))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);const before=await baseSnapshot(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval('[data-v46-progress-section]',el=>el.hidden),false,'progress section hidden');
  const cardCount=await page.$$eval('[data-v46-progress-grid] .v46-progress-card',els=>els.length);assert.equal(cardCount,3,'expected A/B/C progress cards');
  const questionCount=await page.$$eval('[data-v46-check]',els=>els.length);assert.ok(questionCount>=3,'expected progress questions');
  const initialSummary=await page.$eval('[data-v46-progress-summary] .v46-progress-stat strong',el=>el.textContent.trim());assert.match(initialSummary,new RegExp(`^0 / ${questionCount}$`));
  const first=await page.$('[data-v46-check]');const firstKey=await first.evaluate(el=>el.dataset.v46Check);const firstText=await first.evaluate(el=>el.closest('.v46-question').innerText.trim());
  await first.click();
  const note=await page.$(`[data-v46-note="${firstKey}"]`);await note.type('업체 답변: 철거 폐기물 반출 포함, VAT는 별도 확인');await sleep(320);
  const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('interior-review-progress-v46')));assert.equal(progress.version,1);assert.equal(progress.entries[firstKey].done,true);assert.match(progress.entries[firstKey].note,/폐기물 반출 포함/);
  const afterEdit=await baseSnapshot(page);assert.deepEqual(afterEdit,before,'v46 progress mutated quote/compare storage');
  const summaryAfter=await page.$eval('[data-v46-progress-summary] .v46-progress-stat strong',el=>el.textContent.trim());assert.match(summaryAfter,new RegExp(`^1 / ${questionCount}$`));
  const pendingText=await page.evaluate(()=>{const api=window.InteriorQuoteReview46;const groups=api.currentGroups();const rows=api.rowsFrom(groups);return api.unansweredText('a',rows,api.loadProgress())});assert.doesNotMatch(pendingText,new RegExp(firstText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'completed question should not be copied as pending');
  await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval(`[data-v46-check="${firstKey}"]`,el=>el.checked),true,'done state not restored');assert.match(await page.$eval(`[data-v46-note="${firstKey}"]`,el=>el.value),/폐기물 반출 포함/,'note not restored');
  const reloadSummary=await page.$eval('[data-v46-progress-summary] .v46-progress-stat strong',el=>el.textContent.trim());assert.match(reloadSummary,/^1 \/ /);
  await page.emulateMediaType('print');const sectionVisible=await page.$eval('[data-v46-progress-section]',el=>getComputedStyle(el).display!=='none');assert.ok(sectionVisible,'progress hidden in print');const actionHidden=await page.$eval('[data-v46-progress-actions]',el=>getComputedStyle(el).display==='none');assert.ok(actionHidden,'progress actions visible in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v46-progress.png'),fullPage:true});assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.equal(await page.$$eval('[data-v46-progress-grid] .v46-progress-card',els=>els.length),3);
  const textareaVisible=await page.$eval('[data-v46-note]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});assert.ok(textareaVisible,'mobile note textarea hidden');
  await page.screenshot({path:path.join(OUT,'mobile-v46-progress.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runResetAndQuoteOnly(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const check=await page.$('[data-v46-check]');await check.click();await sleep(100);assert.ok(await page.evaluate(()=>localStorage.getItem('interior-review-progress-v46')));
  page.on('dialog',d=>d.accept());await page.click('[data-v46-reset]');await sleep(120);assert.equal(await page.evaluate(()=>localStorage.getItem('interior-review-progress-v46')),null,'reset did not clear progress');
  await page.evaluate(()=>{localStorage.removeItem('interior-compare-v5');localStorage.removeItem('interior-compare-v6');});await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$$eval('[data-v46-progress-grid] .v46-progress-card',els=>els.length),0);assert.match(await page.$eval('[data-v46-progress-grid]',el=>el.innerText),/업체별 질문이 없어/);
  report.resetQuoteOnly='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',resetQuoteOnly:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runResetAndQuoteOnly(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V46 REVIEW PROGRESS QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V46 REVIEW PROGRESS QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

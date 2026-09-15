const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TRACKED=['interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46','interior-contract-reflection-v48','interior-review-baseline-v49','interior-review-revalidation-v50'];

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(220)}
async function snapshot(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),TRACKED)}
async function seedQuote(page){await page.evaluate(()=>localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32',building:'아파트'},items:{demolition:{state:'included',amount:'120'},bathroom:{state:'separate',amount:'450'}}}))) }
async function seedCompare(page){await page.evaluate(()=>{const c={'demolition:a:state':'included','demolition:a:amount':'100','demolition:b:state':'included','demolition:b:amount':'120','demolition:c:state':'separate','demolition:c:amount':'150','bathroom:a:state':'separate','bathroom:a:amount':'400','bathroom:b:state':'separate','bathroom:b:amount':'450','bathroom:c:state':'separate','bathroom:c:amount':'470','wallpaper:a:state':'included','wallpaper:a:amount':'80','wallpaper:b:state':'included','wallpaper:b:amount':'','wallpaper:c:state':'included','wallpaper:c:amount':'90'};localStorage.setItem('interior-compare-v5',JSON.stringify(c));localStorage.setItem('interior-compare-v6',JSON.stringify(c));})}
async function reload(page){await page.reload({waitUntil:'domcontentloaded'});await settle(page)}
async function nextId(page){return page.evaluate(()=>window.InteriorQuoteReview51.buildModel().next.id)}
async function triggerRefresh(page){await page.evaluate(()=>document.querySelector('[data-refresh-report]')?.click());await sleep(140)}

async function completeQuestions(page){return page.evaluate(()=>{const api=window.InteriorQuoteReview46;const groups=api.currentGroups();const rows=api.rowsFrom(groups);const entries={};rows.forEach((row,i)=>{entries[row.key]={done:true,note:`${row.itemName} 업체 답변 ${i+1}`}});localStorage.setItem(api.PROGRESS_KEY,JSON.stringify({version:1,updatedAt:new Date().toISOString(),entries}));return rows.length})}
async function completeReflection(page){return page.evaluate(()=>{const api=window.InteriorQuoteReview48;const candidates=api.buildCandidates();const entries={};candidates.forEach((row,i)=>{entries[row.key]={reflected:true,documentNote:`특약 ${i+1}항 반영 확인`}});localStorage.setItem(api.REFLECTION_KEY,JSON.stringify({version:1,updatedAt:new Date().toISOString(),entries}));return candidates.length})}

async function runPriority(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});const errors=watchErrors(page,'priority');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await page.evaluate(()=>localStorage.clear());await reload(page);
  for(const name of ['InteriorQuoteReview48','InteriorQuoteReview49','InteriorQuoteReview50','InteriorQuoteReview51'])assert.equal(await page.evaluate(n=>typeof window[n],name),'object',`${name} did not auto-load`);
  assert.equal(await page.$$eval('[data-v51-grid] .v51-step',els=>els.length),6,'expected six status steps');
  assert.equal(await nextId(page),'quote');
  let before=await snapshot(page);await page.evaluate(()=>window.InteriorQuoteReview51.render());assert.deepEqual(await snapshot(page),before,'v51 render mutated storage');

  await seedQuote(page);await triggerRefresh(page);assert.equal(await nextId(page),'compare');
  await seedCompare(page);await reload(page);let model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.ok(model.questionTotal>0,'expected vendor questions after seeded compare');assert.equal(model.next.id,'answers');

  const qCount=await completeQuestions(page);assert.ok(qCount>0);await triggerRefresh(page);model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.equal(model.questionDone,model.questionTotal);assert.ok(model.candidateTotal>0,'expected reflection candidates from completed answers');assert.equal(model.next.id,'reflection');

  const cCount=await completeReflection(page);assert.ok(cCount>0);await triggerRefresh(page);model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.equal(model.reflected,model.candidateTotal);assert.equal(model.next.id,'baseline');

  before=await snapshot(page);await page.click('[data-v49-save]');await sleep(160);model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.equal(model.baselineState,'clean');assert.equal(model.next.id,'done');const afterBaseline=await snapshot(page);for(const k of TRACKED.filter(k=>k!=='interior-review-baseline-v49'))assert.equal(afterBaseline[k],before[k],`baseline action unexpectedly changed ${k}`);

  await page.evaluate(()=>{const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='135';localStorage.setItem('interior-quote-v5',JSON.stringify(q))});await triggerRefresh(page);model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.equal(model.baselineState,'changed');assert.equal(model.next.id,'revalidation');assert.ok(model.revalidationStats.pending>0);

  await page.evaluate(()=>{const api=window.InteriorQuoteReview50;const m=api.buildTasks();const entries={};m.tasks.forEach(t=>entries[t.entryKey]={done:true,note:'변경 후 재검수 완료'});localStorage.setItem(api.STATE_KEY,JSON.stringify({version:1,updatedAt:new Date().toISOString(),entries}))});await triggerRefresh(page);model=await page.evaluate(()=>window.InteriorQuoteReview51.buildModel());assert.equal(model.revalidationStats.pending,0);assert.equal(model.next.id,'baseline-refresh');

  const labels=await page.$$eval('[data-v51-grid] .v51-step span',els=>els.map(x=>x.textContent.trim()));assert.deepEqual(labels,['견적','업체 비교','업체 답변','서면 반영','검수 기준','재검수']);
  const firstStageIsStatus=await page.$eval('.tool-page.site-shell',host=>host.firstElementChild?.hasAttribute('data-v51-status-section'));assert.equal(firstStageIsStatus,true,'v51 status is not at top of tool page');
  await page.emulateMediaType('print');assert.ok(await page.$eval('[data-v51-status-section]',el=>getComputedStyle(el).display!=='none'),'v51 hidden in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v51-status.png'),fullPage:true});assert.deepEqual(errors,[],`priority browser errors:\n${errors.join('\n')}`);report.priority='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await page.evaluate(()=>localStorage.clear());await seedQuote(page);await seedCompare(page);await reload(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);assert.equal(await page.$$eval('[data-v51-grid] .v51-step',els=>els.length),6);assert.ok(await page.$eval('[data-v51-next]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile next card hidden');await page.screenshot({path:path.join(OUT,'mobile-v51-status.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',priority:'NOT RUN',mobile:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runPriority(browser,report);await runMobile(browser,report);const wrapper=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.match(wrapper,/INTERIOR_STATUS_QUOTE_URL='\?page=quote-check'/);assert.match(wrapper,/INTERIOR_STATUS_COMPARE_URL='\?page=quote-compare'/);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V51 REVIEW STATUS QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V51 REVIEW STATUS QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

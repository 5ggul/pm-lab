const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS=['interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46','interior-contract-reflection-v48'];

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(180)}
async function seed(page){await page.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem('interior-quote-v5',JSON.stringify({context:{region:'서울'},items:{demolition:{state:'included',amount:'120',memo:'기준견적-원문-노출금지'}}}));
  const compare={'demolition:a:state':'included','demolition:a:amount':'100','demolition:b:state':'included','demolition:b:amount':'120'};
  localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
  localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
  localStorage.setItem('interior-review-progress-v46',JSON.stringify({version:1,updatedAt:'2026-09-14T00:00:00.000Z',entries:{'a:demo:x':{done:true,note:'업체답변-원문-노출금지'}}}));
  localStorage.setItem('interior-contract-reflection-v48',JSON.stringify({version:1,updatedAt:'2026-09-14T00:00:00.000Z',entries:{'a:demo:x':{reflected:true,documentNote:'특약3항-원문-노출금지'}}}));
});}
async function sources(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),KEYS)}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview48),'object','v48 API not auto-loaded from actual HTML');
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview49),'object','v49 API not auto-loaded from actual HTML');
  assert.ok(await page.$('[data-v48-reflection-section]'),'v48 actual section missing');
  assert.ok(await page.$('[data-v49-baseline-section]'),'v49 actual section missing');
  assert.match(await page.$eval('[data-v49-status]',el=>el.innerText),/검수 기준이 없습니다/);
  const sourceBefore=await sources(page);
  await page.click('[data-v49-save]');await sleep(120);
  const baselineRaw=await page.evaluate(()=>localStorage.getItem('interior-review-baseline-v49'));assert.ok(baselineRaw,'baseline not saved');
  assert.doesNotMatch(baselineRaw,/기준견적-원문-노출금지|업체답변-원문-노출금지|특약3항-원문-노출금지/,'baseline copied source plaintext');
  const baseline=JSON.parse(baselineRaw);assert.equal(baseline.version,1);assert.equal(Object.keys(baseline.values).length,5);
  assert.deepEqual(await sources(page),sourceBefore,'saving baseline mutated source storage');
  assert.equal((await page.evaluate(()=>window.InteriorQuoteReview49.compareBaseline())).state,'clean');
  assert.match(await page.$eval('[data-v49-status]',el=>el.innerText),/변경 없음/);
  await page.reload({waitUntil:'domcontentloaded'});await settle(page);assert.match(await page.$eval('[data-v49-status]',el=>el.innerText),/변경 없음/,'clean baseline not restored after reload');
  await page.evaluate(()=>{const q=JSON.parse(localStorage.getItem('interior-quote-v5'));q.items.demolition.amount='135';localStorage.setItem('interior-quote-v5',JSON.stringify(q));localStorage.removeItem('interior-contract-reflection-v48');});
  await page.click('[data-refresh-report]');await sleep(120);
  let result=await page.evaluate(()=>{const r=window.InteriorQuoteReview49.compareBaseline();return {state:r.state,changed:r.changed.map(x=>({id:x.id,label:x.label,before:x.before,now:x.now})),text:window.InteriorQuoteReview49.summaryText(r)}});
  assert.equal(result.state,'changed');assert.deepEqual(result.changed.map(x=>x.id).sort(),['quote','reflection']);assert.match(result.text,/견적 입력: 내용 변경/);assert.match(result.text,/계약서 반영 기록: 삭제됨/);assert.doesNotMatch(result.text,/135|기준견적-원문-노출금지|특약3항-원문-노출금지/,'change summary leaked raw source value');
  await page.evaluate(()=>localStorage.setItem('interior-review-progress-v46',JSON.stringify({version:1,updatedAt:'2026-09-14T01:00:00.000Z',entries:{}})));
  await page.click('[data-refresh-report]');await sleep(100);result=await page.evaluate(()=>{const r=window.InteriorQuoteReview49.compareBaseline();return {ids:r.changed.map(x=>x.id).sort()}});assert.deepEqual(result.ids,['progress','quote','reflection']);
  await page.emulateMediaType('print');assert.ok(await page.$eval('[data-v49-baseline-section]',el=>getComputedStyle(el).display!=='none'),'v49 hidden in print');assert.ok(await page.$eval('[data-v49-baseline-section] .v49-actions',el=>getComputedStyle(el).display==='none'),'v49 actions visible in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v49-baseline.png'),fullPage:true});
  page.on('dialog',d=>d.accept());await page.click('[data-v49-clear]');await sleep(100);assert.equal(await page.evaluate(()=>localStorage.getItem('interior-review-baseline-v49')),null,'baseline delete failed');assert.match(await page.$eval('[data-v49-status]',el=>el.innerText),/검수 기준이 없습니다/);
  assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview48),'object');assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview49),'object');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.ok(await page.$eval('[data-v49-save]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile save baseline hidden');
  await page.click('[data-v49-save]');await sleep(100);assert.match(await page.$eval('[data-v49-status]',el=>el.innerText),/변경 없음/);
  await page.screenshot({path:path.join(OUT,'mobile-v49-baseline.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V49 BASELINE INTEGRITY QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V49 BASELINE INTEGRITY QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

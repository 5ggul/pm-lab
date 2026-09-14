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
async function seedBase(page){await page.evaluate(()=>{
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

async function seedProgress(page){return page.evaluate(()=>{
  const api=window.InteriorQuoteReview46;const groups=api.currentGroups();const rows=api.rowsFrom(groups);const progress={version:1,updatedAt:new Date().toISOString(),entries:{}};
  if(rows[0])progress.entries[rows[0].key]={done:true,note:'철거 범위와 폐기물 반출 포함이라고 답변'};
  if(rows[1])progress.entries[rows[1].key]={done:true,note:''};
  if(rows[2])progress.entries[rows[2].key]={done:false,note:'다음 통화에서 VAT 포함 여부 재확인 예정'};
  localStorage.setItem(api.PROGRESS_KEY,JSON.stringify(progress));
  return {total:rows.length,firstVendor:rows[0]?.vendor||'a',firstKey:rows[0]?.key||'',thirdKey:rows[2]?.key||''};
});}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const baseBefore=await baseSnapshot(page);const seeded=await seedProgress(page);const progressBefore=await page.evaluate(()=>localStorage.getItem('interior-review-progress-v46'));
  await page.evaluate(()=>window.InteriorQuoteReview47.render());await settle(page);
  assert.equal(await page.$eval('[data-v47-final-section]',el=>el.hidden),false,'v47 section hidden');
  assert.equal(await page.$$eval('[data-v47-summary-grid] .v47-summary-card',els=>els.length),3,'expected A/B/C final cards');
  const model=await page.evaluate(()=>{const m=window.InteriorQuoteReview47.buildModel();return {vendors:m.vendors.map(v=>({vendor:v.vendor,total:v.total,completed:v.completed.length,pending:v.pending.length,notes:v.notes.length,completedWithNote:v.completedWithNote.length})),text:window.InteriorQuoteReview47.overallText(m)}});
  assert.equal(model.vendors.length,3);assert.ok(model.vendors.reduce((s,v)=>s+v.total,0)>2);assert.ok(model.vendors.reduce((s,v)=>s+v.completed,0)>=2);assert.match(model.text,/전체 확인 완료/);assert.match(model.text,/철거 범위와 폐기물 반출 포함이라고 답변/);assert.match(model.text,/아직 확인할 질문/);assert.doesNotMatch(model.text,/추천 업체|가장 저렴|이 업체가 적정|계약해도 됩니다|우수한 업체/);
  const firstVendorText=await page.evaluate(v=>{const m=window.InteriorQuoteReview47.buildModel();return window.InteriorQuoteReview47.vendorFinalText(m,v)},seeded.firstVendor);assert.match(firstVendorText,/계약 전 최종 확인/);assert.match(firstVendorText,/답변 메모/);
  const baseAfter=await baseSnapshot(page);assert.deepEqual(baseAfter,baseBefore,'v47 mutated quote/compare storage');
  const progressAfter=await page.evaluate(()=>localStorage.getItem('interior-review-progress-v46'));assert.equal(progressAfter,progressBefore,'v47 mutated progress storage');
  await page.emulateMediaType('print');const visible=await page.$eval('[data-v47-final-section]',el=>getComputedStyle(el).display!=='none');assert.ok(visible,'v47 hidden in print');const actionHidden=await page.$eval('[data-v47-final-section] .v47-actions',el=>getComputedStyle(el).display==='none');assert.ok(actionHidden,'v47 actions visible in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v47-final-summary.png'),fullPage:true});assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await seedProgress(page);await page.evaluate(()=>window.InteriorQuoteReview47.render());await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.equal(await page.$$eval('[data-v47-summary-grid] .v47-summary-card',els=>els.length),3);
  const copyVisible=await page.$eval('[data-v47-copy-all]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});assert.ok(copyVisible,'mobile overall copy hidden');
  await page.screenshot({path:path.join(OUT,'mobile-v47-final-summary.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runNoCompare(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.evaluate(()=>{localStorage.removeItem('interior-compare-v5');localStorage.removeItem('interior-compare-v6');localStorage.removeItem('interior-review-progress-v46')});await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$$eval('[data-v47-summary-grid] .v47-summary-card',els=>els.length),0);assert.match(await page.$eval('[data-v47-final-section]',el=>el.innerText),/최종 요약을 만들 비교 질문이 없습니다|현재 업체별 질문이 없습니다/);
  report.noCompare='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',noCompare:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runNoCompare(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V47 FINAL SUMMARY QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V47 FINAL SUMMARY QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

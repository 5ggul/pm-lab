const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(220)}
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
async function seedProgress(page){return page.evaluate(()=>{
  const api=window.InteriorQuoteReview46;const groups=api.currentGroups();const rows=api.rowsFrom(groups);const selected=[];
  for(const vendor of ['a','b','c']){const row=rows.find(r=>r.vendor===vendor);if(row)selected.push(row)}
  const extra=rows.find(r=>r.vendor==='a'&&!selected.includes(r));if(extra)selected.push(extra);
  const progress={version:1,updatedAt:new Date().toISOString(),entries:{}};
  selected.forEach((row,index)=>{progress.entries[row.key]={done:true,note:index===0?'철거 범위와 폐기물 반출 포함이라고 답변':`${row.itemName} 포함 범위를 서면 반영하기로 답변`}});
  localStorage.setItem(api.PROGRESS_KEY,JSON.stringify(progress));
  return {selected:selected.map(r=>({vendor:r.vendor,key:r.key,itemName:r.itemName})),totalRows:rows.length};
});}
async function baseSnapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6'),progress:localStorage.getItem('interior-review-progress-v46')}))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const seeded=await seedProgress(page);await page.evaluate(()=>{window.InteriorQuoteReview47.render();window.InteriorQuoteReview48.render()});await settle(page);
  const before=await baseSnapshot(page);
  assert.equal(await page.$eval('[data-v48-reflection-section]',el=>el.hidden),false,'v48 section hidden');
  const candidateCount=await page.$$eval('[data-v48-reflect]',els=>els.length);assert.equal(candidateCount,seeded.selected.length,'candidate count mismatch');assert.ok(candidateCount>=3,'expected multiple reflection candidates');
  const initial=await page.$eval('[data-v48-summary] .v48-stat strong',el=>el.textContent.trim());assert.equal(initial,`0 / ${candidateCount}`);
  const first=await page.$('[data-v48-reflect]');const firstKey=await first.evaluate(el=>el.dataset.v48Reflect);const firstAnswer=await first.evaluate(el=>el.closest('.v48-row').querySelector('.v48-answer').textContent.trim());
  await first.click();const note=await page.$(`[data-v48-doc-note="${firstKey}"]`);await note.type('계약서 특약 3항에 폐기물 반출 포함 문구 확인');await sleep(320);
  const reflection=await page.evaluate(()=>JSON.parse(localStorage.getItem('interior-contract-reflection-v48')));assert.equal(reflection.version,1);assert.equal(reflection.entries[firstKey].reflected,true);assert.match(reflection.entries[firstKey].documentNote,/특약 3항/);
  assert.deepEqual(await baseSnapshot(page),before,'v48 mutated quote/compare/progress storage');
  const summaryAfter=await page.$eval('[data-v48-summary] .v48-stat strong',el=>el.textContent.trim());assert.equal(summaryAfter,`1 / ${candidateCount}`);
  const pending=await page.evaluate(v=>{const api=window.InteriorQuoteReview48;return api.pendingText(api.buildCandidates(),api.loadReflection(),v)},seeded.selected[0].vendor);assert.doesNotMatch(pending,new RegExp(firstAnswer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/^업체 답변:\s*/,'')),'reflected row still present in pending copy');
  const overall=await page.evaluate(()=>{const api=window.InteriorQuoteReview48;return api.reflectionText(api.buildCandidates(),api.loadReflection())});assert.match(overall,/서면 반영 확인 1/);assert.match(overall,/계약서 특약 3항/);assert.doesNotMatch(overall,/추천 업체|가장 저렴|적정가격으로 판단|계약 가능 판정/);
  await page.reload({waitUntil:'domcontentloaded'});await settle(page);assert.equal(await page.$eval(`[data-v48-reflect="${firstKey}"]`,el=>el.checked),true,'reflection state not restored');assert.match(await page.$eval(`[data-v48-doc-note="${firstKey}"]`,el=>el.value),/특약 3항/,'document note not restored');
  await page.emulateMediaType('print');assert.ok(await page.$eval('[data-v48-reflection-section]',el=>getComputedStyle(el).display!=='none'),'v48 hidden in print');assert.ok(await page.$eval('[data-v48-reflection-section] .v48-actions',el=>getComputedStyle(el).display==='none'),'v48 actions visible in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v48-contract-reflection.png'),fullPage:true});assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await seedProgress(page);await page.evaluate(()=>{window.InteriorQuoteReview47.render();window.InteriorQuoteReview48.render()});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.ok(await page.$$eval('[data-v48-reflect]',els=>els.length)>=3);assert.ok(await page.$eval('[data-v48-doc-note]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile document note hidden');
  await page.screenshot({path:path.join(OUT,'mobile-v48-contract-reflection.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runResetAndNoAnswers(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seedBase(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await seedProgress(page);await page.evaluate(()=>window.InteriorQuoteReview48.render());await settle(page);
  const before=await baseSnapshot(page);const check=await page.$('[data-v48-reflect]');await check.click();await sleep(100);assert.ok(await page.evaluate(()=>localStorage.getItem('interior-contract-reflection-v48')));
  page.on('dialog',d=>d.accept());await page.click('[data-v48-reset]');await sleep(120);assert.equal(await page.evaluate(()=>localStorage.getItem('interior-contract-reflection-v48')),null,'reset did not clear reflection only');assert.deepEqual(await baseSnapshot(page),before,'reset mutated quote/compare/progress storage');
  await page.evaluate(()=>localStorage.removeItem('interior-review-progress-v46'));await page.reload({waitUntil:'domcontentloaded'});await settle(page);assert.equal(await page.$$eval('[data-v48-reflect]',els=>els.length),0);assert.match(await page.$eval('[data-v48-grid]',el=>el.innerText),/완료 답변 메모가 없습니다/);
  report.resetNoAnswers='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',resetNoAnswers:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runResetAndNoAnswers(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V48 CONTRACT REFLECTION QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V48 CONTRACT REFLECTION QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

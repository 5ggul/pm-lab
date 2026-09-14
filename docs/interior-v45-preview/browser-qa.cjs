const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(150)}
async function seed(page){await page.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32',region:'서울'},items:{demolition:{state:'included',amount:'120'},bathroom:{state:'separate',amount:'450'}}}));
  const compare={
    'demolition:a:state':'included','demolition:a:amount':'100','bathroom:a:state':'separate','bathroom:a:amount':'400','wallpaper:a:state':'included','wallpaper:a:amount':'80',
    'demolition:b:state':'included','demolition:b:amount':'120','bathroom:b:state':'separate','bathroom:b:amount':'450','wallpaper:b:state':'included','wallpaper:b:amount':'',
    'demolition:c:state':'separate','demolition:c:amount':'150','bathroom:c:state':'separate','bathroom:c:amount':'470','wallpaper:c:state':'included','wallpaper:c:amount':'90'
  };
  localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
  localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
});}
async function storageSnapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6')}))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);const before=await storageSnapshot(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval('[data-v45-vendor-section]',el=>el.hidden),false,'v45 vendor section hidden');
  assert.equal(await page.$$eval('[data-v45-vendor-grid] .v45-vendor-card',els=>els.length),3,'expected three active vendor cards');
  for(const vendor of ['a','b','c']) assert.equal(await page.$$eval(`[data-v45-vendor-grid] .v45-vendor-card[data-vendor="${vendor}"] .v45-vendor-item`,els=>els.length),3,`${vendor} item count`);
  const aText=await page.evaluate(()=>{const d=window.InteriorQuoteReview43.loadData();return window.InteriorQuoteReview45.vendorText(d,'a')});
  const bText=await page.evaluate(()=>{const d=window.InteriorQuoteReview43.loadData();return window.InteriorQuoteReview45.vendorText(d,'b')});
  const cText=await page.evaluate(()=>{const d=window.InteriorQuoteReview43.loadData();return window.InteriorQuoteReview45.vendorText(d,'c')});
  assert.match(aText,/A 업체 확인 질문/);assert.match(aText,/업체별 포함조건이 다릅니다/);assert.match(aText,/업체별 입력금액 차이가 있습니다/);
  assert.match(bText,/도배/);assert.match(bText,/금액이 비어 있습니다/);assert.match(bText,/다른 비교 견적에는 금액 입력이 있습니다/);
  assert.match(cText,/C 업체 확인 질문/);assert.match(cText,/별도 항목으로 입력되어 있습니다/);
  for(const text of [aText,bText,cText]) assert.doesNotMatch(text,/가장 저렴|추천 업체|적정가격|품질이 좋/);
  const after=await storageSnapshot(page);assert.deepEqual(after,before,'v45 rendering mutated localStorage');
  await page.emulateMediaType('print');
  const printVisible=await page.$$eval('[data-v45-vendor-grid] .v45-vendor-card',els=>els.length===3&&els.every(el=>{const s=getComputedStyle(el);const r=el.getBoundingClientRect();return s.display!=='none'&&r.width>0&&r.height>0}));assert.ok(printVisible,'vendor cards hidden in print media');
  await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v45-vendor-questions.png'),fullPage:true});
  assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.equal(await page.$$eval('[data-v45-vendor-grid] .v45-vendor-card',els=>els.length),3);
  const buttons=await page.$$eval('[data-copy-vendor]',els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim(),visible:r.width>0&&r.height>0}}));assert.equal(buttons.length,3);assert.ok(buttons.every(v=>v.visible),'vendor copy button hidden');
  await page.screenshot({path:path.join(OUT,'mobile-v45-vendor-questions.png'),fullPage:true});
  assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runNoCompare(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await page.evaluate(()=>{localStorage.clear();localStorage.setItem('interior-quote-v5',JSON.stringify({context:{},items:{demolition:{state:'included',amount:'100'}}}))});await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$$eval('[data-v45-vendor-grid] .v45-vendor-card',els=>els.length),0);
  assert.match(await page.$eval('[data-v45-vendor-grid]',el=>el.innerText),/업체별 질문을 만들 수 없습니다/);
  report.noCompare='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',noCompare:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runNoCompare(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V45 VENDOR QUESTION QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V45 VENDOR QUESTION QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

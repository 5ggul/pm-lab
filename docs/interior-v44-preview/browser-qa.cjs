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
  localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32',exclusive:'25.7',building:'아파트',region:'서울',scope:'올수리',bathrooms:'2'},items:{demolition:{state:'included',amount:'120'},bathroom:{state:'separate',amount:'450'}}}));
  const compare={
    'demolition:a:state':'included','demolition:a:amount':'100','bathroom:a:state':'separate','bathroom:a:amount':'400','wallpaper:a:state':'included','wallpaper:a:amount':'80',
    'demolition:b:state':'included','demolition:b:amount':'120','bathroom:b:state':'separate','bathroom:b:amount':'450','wallpaper:b:state':'included','wallpaper:b:amount':'',
    'demolition:c:state':'separate','demolition:c:amount':'150','bathroom:c:state':'separate','bathroom:c:amount':'470','wallpaper:c:state':'included','wallpaper:c:amount':'90'
  };
  localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
  localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
});}
async function snapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6')}))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);const before=await snapshot(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval('[data-v44-checklist-section]',el=>el.hidden),false,'checklist section hidden');
  assert.equal(await page.$$eval('[data-v44-checklist-list] .v44-checklist-item',els=>els.length),12,'checklist item count');
  assert.equal(await page.$eval('[data-copy-checklist]',el=>el.textContent.trim()),'업체 확인 목록 복사');
  const text=await page.evaluate(()=>window.InteriorQuoteReview44.checklistText(window.InteriorQuoteReview43.render()));
  assert.match(text,/□ 철거/);assert.match(text,/포함·별도 범위를 A\/B\/C 업체가 같은 기준/);assert.match(text,/금액 차이가 생긴 이유/);assert.match(text,/□ 욕실/);assert.match(text,/별도 비용과 산정 기준/);assert.match(text,/□ 도배/);assert.match(text,/금액이 비어 있는 업체/);
  assert.doesNotMatch(text,/적정가격|추천 업체|가장 저렴/);
  const after=await snapshot(page);assert.deepEqual(after,before,'v44 checklist mutated localStorage');
  await page.emulateMediaType('print');
  const printVisible=await page.$eval('[data-v44-checklist-section]',el=>{const s=getComputedStyle(el);const r=el.getBoundingClientRect();return s.display!=='none'&&r.width>0&&r.height>0});assert.ok(printVisible,'checklist hidden in print media');
  await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v44-checklist.png'),fullPage:true});
  assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  const visible=await page.$eval('[data-copy-checklist]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});assert.ok(visible,'mobile copy checklist button hidden');
  assert.equal(await page.$$eval('[data-v44-checklist-list] .v44-checklist-item',els=>els.length),12);
  await page.screenshot({path:path.join(OUT,'mobile-v44-checklist.png'),fullPage:true});
  assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runNoFlags(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);
  await page.evaluate(()=>{
    localStorage.clear();
    const items={};for(const id of ['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'])items[id]={state:'included',amount:'100'};
    localStorage.setItem('interior-quote-v5',JSON.stringify({context:{},items}));
  });
  await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$$eval('[data-v44-checklist-list] .v44-checklist-item',els=>els.length),0);
  assert.match(await page.$eval('[data-v44-checklist-list]',el=>el.innerText),/별도 확인이 필요한 항목이 없습니다/);
  report.noFlags='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',noFlags:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runNoFlags(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V44 CHECKLIST QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V44 CHECKLIST QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

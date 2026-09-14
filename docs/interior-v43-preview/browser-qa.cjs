const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(120)}
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
async function storageSnapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6')}))}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);const before=await storageSnapshot(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval('[data-review-empty]',el=>el.hidden),true,'empty state should be hidden');
  assert.equal(await page.$eval('[data-review-main]',el=>el.hidden),false,'report main should be visible');
  assert.equal(await page.$eval('[data-quote-total]',el=>el.textContent.trim()),'570만원');
  assert.equal(await page.$eval('[data-included]',el=>el.textContent.trim()),'1');
  assert.equal(await page.$eval('[data-separate]',el=>el.textContent.trim()),'1');
  assert.equal(await page.$eval('[data-missing]',el=>el.textContent.trim()),'10');
  assert.equal(await page.$eval('[data-vendor-total="a"]',el=>el.textContent.trim()),'580만원');
  assert.equal(await page.$eval('[data-vendor-total="b"]',el=>el.textContent.trim()),'570만원');
  assert.equal(await page.$eval('[data-vendor-total="c"]',el=>el.textContent.trim()),'710만원');
  assert.equal(await page.$eval('[data-review-count]',el=>el.textContent.trim()),'12개');
  const text=await page.$eval('[data-review-list]',el=>el.innerText);assert.match(text,/원본 견적 별도/);assert.match(text,/업체 포함조건 다름/);assert.match(text,/업체 금액 차이 50만원/);assert.match(text,/업체 금액 미입력 있음/);
  assert.equal(await page.$$eval('[data-detail-body] tr',rows=>rows.length),12,'detail table row count');
  const after=await storageSnapshot(page);assert.deepEqual(after,before,'report mutated localStorage');
  await page.screenshot({path:path.join(OUT,'desktop-report.png'),fullPage:true});
  assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);
  assert.equal(await page.$eval('[data-review-count]',el=>el.textContent.trim()),'12개');
  const actionVisible=await page.$$eval('[data-review-main] .v43-report-actions>*',els=>els.length===5&&els.every(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}));assert.ok(actionVisible,'mobile report actions not visible');
  await page.screenshot({path:path.join(OUT,'mobile-report.png'),fullPage:true});
  assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

async function runEmpty(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.$eval('[data-review-empty]',el=>el.hidden),false,'empty state not shown');assert.equal(await page.$eval('[data-review-main]',el=>el.hidden),true,'main should hide without saved data');report.empty='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',mobile:'NOT RUN',empty:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runMobile(browser,report);await runEmpty(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V43 REVIEW REPORT QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V43 REVIEW REPORT QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

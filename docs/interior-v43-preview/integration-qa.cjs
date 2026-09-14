const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const CHECK=`${BASE}/quote-check/`;
const COMPARE=`${BASE}/quote-compare/`;
const REPORT=`${BASE}/quote-review-report/`;
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function watchErrors(page,label){
  const errors=[];
  page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});
  return errors;
}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(120)}
async function snapshot(page){return page.evaluate(()=>({quote:localStorage.getItem('interior-quote-v5'),v5:localStorage.getItem('interior-compare-v5'),v6:localStorage.getItem('interior-compare-v6'),handoff:localStorage.getItem('interior-quote-compare-handoff-v42')}))}

async function runCheckToReport(browser,result){
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1000});
  const errors=watchErrors(page,'check-flow');
  await page.goto(CHECK,{waitUntil:'domcontentloaded'});await settle(page);
  await page.evaluate(()=>{
    localStorage.clear();
    const compare={'demolition:a:state':'included','demolition:a:amount':'100','demolition:b:state':'included','demolition:b:amount':'120','demolition:c:state':'separate','demolition:c:amount':'150'};
    localStorage.setItem('interior-compare-v5',JSON.stringify(compare));
    localStorage.setItem('interior-compare-v6',JSON.stringify(compare));
    const set=(id,state,amount)=>{const row=document.querySelector(`[data-qrow="${id}"]`);row.querySelector(`[name="state-${id}"][value="${state}"]`).checked=true;row.querySelector('[data-q-amount]').value=amount;};
    set('demolition','included','120');
    set('bathroom','separate','450');
  });
  await page.waitForSelector('[data-quote-report] [data-v43-open-review]');
  const entryText=await page.$eval('[data-quote-report] [data-v43-open-review]',el=>el.textContent.trim());
  assert.equal(entryText,'검수 리포트 보기');
  await page.screenshot({path:path.join(OUT,'check-entry.png'),fullPage:true});
  const before=await snapshot(page);
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('[data-quote-report] [data-v43-open-review]')]);
  await settle(page);
  assert.equal(new URL(page.url()).pathname,'/pm-lab/interior-cost-preview/quote-review-report/');
  assert.equal(await page.$eval('[data-quote-total]',el=>el.textContent.trim()),'570만원');
  assert.equal(await page.$eval('[data-included]',el=>el.textContent.trim()),'1');
  assert.equal(await page.$eval('[data-separate]',el=>el.textContent.trim()),'1');
  assert.equal(await page.$eval('[data-missing]',el=>el.textContent.trim()),'10');
  const after=await snapshot(page);
  const quote=JSON.parse(after.quote);
  assert.equal(quote.items.demolition.state,'included');
  assert.equal(quote.items.demolition.amount,'120');
  assert.equal(quote.items.bathroom.state,'separate');
  assert.equal(quote.items.bathroom.amount,'450');
  assert.equal(after.v5,before.v5,'quote flow changed compare-v5');
  assert.equal(after.v6,before.v6,'quote flow changed compare-v6');
  assert.equal(after.handoff,null,'review route should not create compare handoff');
  await page.screenshot({path:path.join(OUT,'report-after-check.png'),fullPage:true});
  assert.deepEqual(errors,[],`check flow browser errors:\n${errors.join('\n')}`);
  result.checkToReport='PASS';
  await page.close();
}

async function runCompareToReport(browser,result){
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1000});
  const errors=watchErrors(page,'compare-flow');
  await page.goto(COMPARE,{waitUntil:'domcontentloaded'});await settle(page);
  await page.evaluate(()=>{
    localStorage.clear();
    localStorage.setItem('interior-quote-v5',JSON.stringify({context:{supply:'32'},items:{demolition:{state:'included',amount:'120'},bathroom:{state:'separate',amount:'450'}}}));
    const set=(id,v,state,amount)=>{const row=document.querySelector(`[data-compare-row="${id}"]`);row.querySelector(`[data-vendor="${v}"][data-state]`).value=state;row.querySelector(`[data-vendor="${v}"][data-amount]`).value=amount;};
    set('demolition','a','included','100');set('demolition','b','included','120');set('demolition','c','separate','150');
    set('bathroom','a','separate','400');set('bathroom','b','separate','450');set('bathroom','c','separate','470');
    set('wallpaper','a','included','80');set('wallpaper','b','included','');set('wallpaper','c','included','90');
  });
  await page.waitForSelector('[data-compare-table] [data-v43-open-review]');
  assert.equal(await page.$eval('[data-compare-table] [data-v43-open-review]',el=>el.textContent.trim()),'검수 리포트 보기');
  await page.screenshot({path:path.join(OUT,'compare-entry.png'),fullPage:true});
  const quoteBefore=await page.evaluate(()=>localStorage.getItem('interior-quote-v5'));
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('[data-compare-table] [data-v43-open-review]')]);
  await settle(page);
  assert.equal(new URL(page.url()).pathname,'/pm-lab/interior-cost-preview/quote-review-report/');
  assert.equal(await page.$eval('[data-vendor-total="a"]',el=>el.textContent.trim()),'580만원');
  assert.equal(await page.$eval('[data-vendor-total="b"]',el=>el.textContent.trim()),'570만원');
  assert.equal(await page.$eval('[data-vendor-total="c"]',el=>el.textContent.trim()),'710만원');
  const stored=await snapshot(page);
  assert.equal(stored.quote,quoteBefore,'compare flow changed saved quote');
  assert.equal(stored.v5,stored.v6,'compare v5/v6 should be synchronized');
  const compare=JSON.parse(stored.v6);
  assert.equal(compare['demolition:a:amount'],'100');
  assert.equal(compare['demolition:b:amount'],'120');
  assert.equal(compare['demolition:c:state'],'separate');
  assert.equal(compare['wallpaper:b:amount'],'');
  assert.equal(stored.handoff,null,'review route should not create compare handoff');
  const text=await page.$eval('[data-review-list]',el=>el.innerText);
  assert.match(text,/업체 포함조건 다름/);
  assert.match(text,/업체 금액 차이 50만원/);
  assert.match(text,/업체 금액 미입력 있음/);
  await page.screenshot({path:path.join(OUT,'report-after-compare.png'),fullPage:true});
  assert.deepEqual(errors,[],`compare flow browser errors:\n${errors.join('\n')}`);
  result.compareToReport='PASS';
  await page.close();
}

async function runMobileEntry(browser,result){
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errors=watchErrors(page,'mobile-entry');
  for(const [url,selector] of [[CHECK,'[data-quote-report] [data-v43-open-review]'],[COMPARE,'[data-compare-table] [data-v43-open-review]']]){
    await page.goto(url,{waitUntil:'domcontentloaded'});await settle(page);await page.waitForSelector(selector);
    const box=await page.$eval(selector,el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height}});
    assert.ok(box.width>0&&box.height>0,`mobile review button hidden at ${url}`);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=1,`mobile horizontal overflow ${overflow}px at ${url}`);
  }
  await page.screenshot({path:path.join(OUT,'mobile-compare-entry.png'),fullPage:true});
  assert.deepEqual(errors,[],`mobile entry browser errors:\n${errors.join('\n')}`);
  result.mobileEntry='PASS';
  await page.close();
}

(async()=>{
  const result={engine:'Chromium via puppeteer-core',checkToReport:'NOT RUN',compareToReport:'NOT RUN',mobileEntry:'NOT RUN',finishedAt:null};
  const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    await runCheckToReport(browser,result);
    await runCompareToReport(browser,result);
    await runMobileEntry(browser,result);
    result.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(OUT,'integration-report.json'),JSON.stringify(result,null,2));
    console.log('INTERIOR V43 ENTRY FLOW QA: PASS');
    console.log(JSON.stringify(result,null,2));
  }catch(error){
    result.finishedAt=new Date().toISOString();result.error=error.stack||String(error);
    fs.writeFileSync(path.join(OUT,'integration-report.json'),JSON.stringify(result,null,2));
    console.error('INTERIOR V43 ENTRY FLOW QA: FAIL');console.error(error);process.exitCode=1;
  }finally{await browser.close()}
})();

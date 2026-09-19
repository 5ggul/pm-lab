'use strict';

const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const URL='https://5ggul.github.io/pm-lab/interior-cost-preview/quote-compare/';
const REVIEW_KEY='interior-compare-v7';
const rows=[];
function must(ok,name,detail=''){
  rows.push({ok:!!ok,name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
  if(!ok) throw new Error(name+(detail?': '+detail:''));
}
async function load(page){
  const r=await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
  must(!!r&&r.ok(),'production quote-compare HTTP',r?r.status():'no response');
}
async function t(loc){return ((await loc.textContent())||'').trim();}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
  const pageErrors=[],badResponses=[],writes=[];
  context.on('page',p=>{
    p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
    p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
    p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
  });
  try{
    const p=await context.newPage();
    await load(p);
    await p.waitForSelector('[data-compact-compare-result]');
    await p.evaluate(k=>localStorage.removeItem(k),REVIEW_KEY);
    await p.reload({waitUntil:'networkidle'});
    await p.waitForSelector('[data-compact-compare-result]');

    const boot=await p.evaluate(()=>({
      api:!!window.InteriorCompactCompareV1,
      asset:document.querySelector('script[src*="quote-compare-compact-v1.js"]')?.src||'',
      rows:document.querySelectorAll('[data-compare-row]').length,
      vendors:document.querySelectorAll('[data-compare-row] .vendor-cell').length,
      head:!!document.querySelector('[data-compact-compare-head]'),
      result:!!document.querySelector('[data-compact-compare-result]'),
      chart:getComputedStyle(document.querySelector('[data-v6-compare-chart]')).display,
      top:getComputedStyle(document.querySelector('.compare-top')).display,
      summary:getComputedStyle(document.querySelector('[data-compare-summary]')).display,
      height:document.documentElement.scrollHeight,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    }));
    must(boot.api,'production compact compare API loaded',JSON.stringify(boot));
    must(boot.asset.includes('quote-compare-compact-v1.js?v=23490ce0b741'),'production compact asset cache key current',boot.asset);
    must(boot.rows===12,'production keeps all 12 compare rows',String(boot.rows));
    must(boot.vendors===36,'production keeps all 36 A/B/C cells',String(boot.vendors));
    must(boot.head&&boot.result,'production has one compact input header and result table');
    must(boot.chart==='none'&&boot.top==='none'&&boot.summary==='none','production duplicate result blocks hidden',JSON.stringify({chart:boot.chart,top:boot.top,summary:boot.summary}));
    must(!boot.overflow,'production 375 has no horizontal overflow',JSON.stringify(boot));
    must(boot.height<=5000,'production mobile height stays under 5000px',String(boot.height));

    const hs=await p.evaluate(()=>[...document.querySelectorAll('[data-compare-row] select,[data-compare-row] input[data-amount]')].map(el=>el.getBoundingClientRect().height));
    must(Math.min(...hs)>=44,'production compare controls remain >=44px',String(Math.min(...hs)));

    const row=(id)=>p.locator('[data-compare-row="'+id+'"]');
    await row('demolition').locator('[data-vendor="a"][data-state]').selectOption('included');
    await row('demolition').locator('[data-vendor="a"][data-amount]').fill('100');
    await row('demolition').locator('[data-vendor="b"][data-state]').selectOption('included');
    await row('demolition').locator('[data-vendor="b"][data-amount]').fill('150');
    await row('demolition').locator('[data-vendor="c"][data-state]').selectOption('included');
    await row('demolition').locator('[data-vendor="c"][data-amount]').fill('120');
    await row('waste').locator('[data-vendor="a"][data-state]').selectOption('separate');
    await row('waste').locator('[data-vendor="a"][data-amount]').fill('50');
    await row('waste').locator('[data-vendor="b"][data-state]').selectOption('included');
    await row('waste').locator('[data-vendor="b"][data-amount]').fill('60');
    await row('waste').locator('[data-vendor="c"][data-state]').selectOption('separate');
    await row('waste').locator('[data-vendor="c"][data-amount]').fill('70');
    await p.waitForTimeout(120);

    const totals={};
    for(const v of ['a','b','c'])totals[v]=await t(p.locator('[data-compact-vendor="'+v+'"] [data-compact-total]'));
    must(totals.a==='150만원'&&totals.b==='210만원'&&totals.c==='190만원','production compact totals correct',JSON.stringify(totals));
    const note=await t(p.locator('[data-compact-result-note]'));
    must(note.includes('단순 총액 비교 불가')&&note.includes('폐기물'),'production critical mismatch warning preserved',note);
    must((await t(p.locator('[data-compact-mismatch]')))==='조건 차이 1개','production mismatch count correct');

    await p.locator('[data-diff-only]').check();
    await p.waitForTimeout(80);
    must(await row('demolition').isHidden(),'production diff filter hides matching row');
    must(await row('waste').isVisible(),'production diff filter keeps mismatch row');
    await p.locator('[data-diff-only]').uncheck();

    must((await p.locator('[data-local-quote-import="compare"]').count())===1,'production CSV/TXT import remains present');
    const csv='공종,상태,금액(만원),수량,단위,사양,메모\n철거,포함,500,1,식,철거,메모\n욕실,별도,250,1,식,욕실,메모';
    await p.locator('[data-local-import-vendor]').selectOption('b');
    await p.locator('[data-local-import-file]').setInputFiles({name:'smoke.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')});
    await p.waitForFunction(()=>document.querySelector('[data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}')?.flat?.['demolition:b:amount']==='500',REVIEW_KEY,{timeout:15000});
    must((await row('demolition').locator('[data-vendor="b"][data-amount]').inputValue())==='500','production CSV import still fills B vendor');
    must((await t(p.locator('[data-compact-vendor="b"] [data-compact-total]')))==='810만원','production compact result updates after partial CSV import');

    const p2=await context.newPage();
    await load(p2);
    await p2.waitForSelector('[data-compact-compare-result]');
    await row('flooring').locator('[data-vendor="c"][data-amount]').fill('333');
    await p2.waitForFunction(()=>document.querySelector('[data-compare-row="flooring"] [data-vendor="c"][data-amount]')?.value==='333',null,{timeout:15000});
    await p2.waitForFunction(()=>document.querySelector('[data-compact-vendor="c"] [data-compact-total]')?.textContent.includes('523'),null,{timeout:15000});
    must((await p2.locator('[data-compare-row="flooring"] [data-vendor="c"][data-amount]').inputValue())==='333','production cross-tab input sync preserved');
    must((await t(p2.locator('[data-compact-vendor="c"] [data-compact-total]'))).includes('523'),'production compact result rerenders across tabs');

    await Promise.all([
      p.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}),
      p.locator('[data-reset-compare]').click()
    ]);
    await p.waitForLoadState('networkidle');
    await p.waitForSelector('[data-compact-compare-result]');
    must((await p.evaluate(k=>localStorage.getItem(k),REVIEW_KEY))===null,'production reset still clears v7');
    must((await t(p.locator('[data-compact-vendor="a"] [data-compact-total]')))==='0만원','production compact result resets to zero');

    must(writes.length===0,'production compact compare sends no write requests',JSON.stringify(writes));
    must(pageErrors.length===0,'no production page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no production 4xx/5xx responses',JSON.stringify(badResponses));
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=0');
    console.log('PRODUCTION_HEIGHT='+boot.height);
  }catch(err){
    console.error(err?.stack||err);
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=1');
    process.exitCode=1;
  }finally{await browser.close();}
})();
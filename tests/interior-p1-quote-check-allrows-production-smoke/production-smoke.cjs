'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const URL='https://5ggul.github.io/pm-lab/interior-cost-preview/quote-check/';
const QUOTE_KEY='interior-quote-v5';
const rows=[];
function must(ok,name,detail=''){
  rows.push({ok:!!ok,name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
  if(!ok) throw new Error(name+(detail?': '+detail:''));
}
async function load(page){
  const r=await page.goto(URL,{waitUntil:'networkidle',timeout:60000});
  must(!!r&&r.ok(),'production quote-check HTTP',r?r.status():'no response');
}
async function visibleRows(page){
  return page.locator('[data-qrow]').evaluateAll(rows=>rows.filter(r=>getComputedStyle(r).display!=='none').length);
}
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
    await p.waitForSelector('[data-quote-check-mode-switch]');
    await p.evaluate(k=>localStorage.removeItem(k),QUOTE_KEY);
    await p.reload({waitUntil:'networkidle'});
    await p.waitForSelector('[data-quote-check-mode-switch]');

    const boot=await p.evaluate(()=>({
      api:!!window.InteriorQuoteCheckAllRowsV1,
      asset:document.querySelector('script[src*="quote-check-allrows-v1.js"]')?.src||'',
      mode:document.querySelector('[data-quote-form]')?.dataset.quoteCheckMode||'',
      total:document.querySelectorAll('[data-qrow]').length,
      visible:[...document.querySelectorAll('[data-qrow]')].filter(r=>getComputedStyle(r).display!=='none').length,
      wizardClass:document.querySelector('.quote-check-table')?.classList.contains('mobile-wizard')||false,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      height:document.documentElement.scrollHeight
    }));
    must(boot.api,'production all-row API loaded',JSON.stringify(boot));
    must(boot.asset.includes('quote-check-allrows-v1.js?v=81410a6fc411'),'production all-row cache key current',boot.asset);
    must(boot.mode==='all'&&!boot.wizardClass,'production defaults to all-row mode',JSON.stringify(boot));
    must(boot.total===12&&boot.visible===12,'production shows all 12 quote rows by default',JSON.stringify({total:boot.total,visible:boot.visible}));
    must(!boot.overflow,'production 375 has no horizontal overflow',JSON.stringify(boot));

    const switchHeights=await p.locator('[data-quote-check-mode-button]').evaluateAll(btns=>btns.map(b=>b.getBoundingClientRect().height));
    must(Math.min(...switchHeights)>=44,'production mode buttons remain >=44px',String(Math.min(...switchHeights)));

    const demolition=p.locator('[data-qrow="demolition"]');
    const vat=p.locator('[data-qrow="vat"]');
    await demolition.locator('input[type="radio"][value="included"]').check();
    await demolition.locator('[data-q-amount]').fill('123');
    await vat.locator('input[type="radio"][value="separate"]').check();
    await vat.locator('[data-q-amount]').fill('45');
    await p.waitForTimeout(100);
    must(((await p.locator('[data-quote-total]').textContent())||'').includes('168'),'production report total updates across distant rows');

    await p.locator('[data-save-quote]').click();
    await p.reload({waitUntil:'networkidle'});
    await p.waitForSelector('[data-quote-check-mode-switch]');
    must((await demolition.locator('[data-q-amount]').inputValue())==='123','production saved demolition amount restores');
    must((await vat.locator('[data-q-amount]').inputValue())==='45','production saved VAT amount restores');
    must((await visibleRows(p))===12,'production reload remains all-row by default');

    const txt='공종\t상태\t금액(만원)\t수량\t단위\t사양\t메모\n욕실\t포함\t333\t2\t개\t600각\t운영\n주방\t별도\t444\t1\t식\t상판\t운영2';
    await p.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'prod.txt',mimeType:'text/plain',buffer:Buffer.from(txt,'utf8')
    });
    await p.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    must((await p.locator('[data-qrow="bathroom"] [data-q-amount]').inputValue())==='333','production TXT import updates bathroom row');
    must((await p.locator('[data-qrow="kitchen"] [data-q-amount]').inputValue())==='444','production TXT import updates kitchen row');

    await p.locator('[data-quote-check-mode-button="wizard"]').evaluate(el=>el.click());
    await p.waitForTimeout(80);
    must((await visibleRows(p))===1,'production explicit wizard shows one row');
    must(((await p.locator('[data-wizard-counter]').textContent())||'').trim()==='1 / 12','production wizard starts at 1 / 12');
    await p.locator('[data-next]').click();
    await p.waitForTimeout(80);
    must(((await p.locator('[data-wizard-counter]').textContent())||'').trim()==='2 / 12','production wizard Next still works');

    await p.locator('[data-quote-check-mode-button="all"]').evaluate(el=>el.click());
    await p.waitForTimeout(80);
    must((await visibleRows(p))===12,'production switching back restores all 12 rows');
    must((await p.locator('[data-qrow="bathroom"] [data-q-amount]').inputValue())==='333','production mode switch preserves imported values');

    const handoff=p.locator('[data-send-to-compare]');
    must((await handoff.count())===1,'production handoff action remains present');
    const handoffHeight=await handoff.evaluate(el=>el.getBoundingClientRect().height);
    must(handoffHeight>=44,'production handoff action remains >=44px',String(handoffHeight));

    must(writes.length===0,'production all-row enhancement sends no write requests',JSON.stringify(writes));
    must(pageErrors.length===0,'no production page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no production 4xx/5xx responses',JSON.stringify(badResponses));
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=0');
    console.log('PRODUCTION_VISIBLE_ROWS='+boot.visible);
    console.log('PRODUCTION_HEIGHT='+boot.height);
  }catch(err){
    console.error(err?.stack||err);
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=1');
    process.exitCode=1;
  }finally{await browser.close();}
})();
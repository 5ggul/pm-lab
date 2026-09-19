'use strict';

const fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const BASE=(process.env.QA_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const SITE='/pm-lab/interior-cost-preview';
const QUOTE_KEY='interior-quote-v5';
const results=[],failures=[];

function must(ok,name,detail=''){
  results.push({ok:!!ok,name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
  if(!ok){failures.push({name,detail:String(detail??'')});throw new Error(name+(detail?': '+detail:''));}
}
async function goto(page,url){
  const r=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  must(!!r&&r.ok(),'HTTP '+new URL(url).pathname,r?r.status():'no response');
}
async function visibleRows(page){
  return page.locator('[data-qrow]').evaluateAll(rows=>rows.filter(r=>getComputedStyle(r).display!=='none').length);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const pageErrors=[],badResponses=[],writes=[];
  try{
    const context=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
    context.on('page',p=>{
      p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
      p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
      p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
    });
    const p=await context.newPage();
    await goto(p,BASE+SITE+'/quote-check/');
    await p.waitForSelector('[data-quote-check-mode-switch]');
    await p.evaluate(k=>localStorage.removeItem(k),QUOTE_KEY);
    await p.reload({waitUntil:'networkidle'});
    await p.waitForSelector('[data-quote-check-mode-switch]');

    const boot=await p.evaluate(()=>({
      api:!!window.InteriorQuoteCheckAllRowsV1,
      asset:document.querySelector('script[src*="quote-check-allrows-v1.js"]')?.src||'',
      mode:document.querySelector('[data-quote-form]')?.dataset.quoteCheckMode||'',
      wizardClass:document.querySelector('.quote-check-table')?.classList.contains('mobile-wizard')||false,
      total:document.querySelectorAll('[data-qrow]').length,
      visible:[...document.querySelectorAll('[data-qrow]')].filter(r=>getComputedStyle(r).display!=='none').length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      height:document.documentElement.scrollHeight,
      wizardHead:getComputedStyle(document.querySelector('.wizard-head')).display,
      wizardActions:getComputedStyle(document.querySelector('.wizard-actions')).display
    }));
    must(boot.api,'all-rows quote-check API loaded',JSON.stringify(boot));
    must(boot.asset.includes('quote-check-allrows-v1.js?v=81410a6fc411'),'all-rows asset cache key current',boot.asset);
    must(boot.mode==='all'&&!boot.wizardClass,'candidate defaults to all-row mode',JSON.stringify(boot));
    must(boot.total===12&&boot.visible===12,'all 12 quote rows visible by default',JSON.stringify({total:boot.total,visible:boot.visible}));
    must(boot.wizardHead==='none'&&boot.wizardActions==='none','wizard chrome hidden in all-row mode',JSON.stringify({head:boot.wizardHead,actions:boot.wizardActions}));
    must(!boot.overflow,'all-row 375 has no horizontal overflow',JSON.stringify(boot));

    const buttonHeights=await p.locator('[data-quote-check-mode-button]').evaluateAll(btns=>btns.map(b=>b.getBoundingClientRect().height));
    must(Math.min(...buttonHeights)>=44,'mode buttons are >=44px',String(Math.min(...buttonHeights)));
    const inputHeights=await p.locator('[data-qrow] input[data-q-amount],[data-qrow] input[data-q-qty],[data-qrow] input[data-q-unit],[data-qrow] input[data-q-spec],[data-qrow] input[data-q-memo]').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));
    must(Math.min(...inputHeights)>=44,'all-row field controls remain >=44px',String(Math.min(...inputHeights)));

    // All-row editing should update the existing report and preserve full-form behavior.
    const demolition=p.locator('[data-qrow="demolition"]');
    const vat=p.locator('[data-qrow="vat"]');
    await demolition.locator('input[type="radio"][value="included"]').check();
    await demolition.locator('[data-q-amount]').fill('123');
    await demolition.locator('[data-q-qty]').fill('1');
    await demolition.locator('[data-q-unit]').fill('식');
    await demolition.locator('[data-q-spec]').fill('전체 철거');
    await vat.locator('input[type="radio"][value="separate"]').check();
    await vat.locator('[data-q-amount]').fill('45');
    await p.waitForTimeout(100);
    must((await p.locator('[data-stat-included]').textContent()).trim()==='1','report updates included count from all-row edit');
    must((await p.locator('[data-stat-separate]').textContent()).trim()==='1','report updates separate count from all-row edit');
    const totalText=((await p.locator('[data-quote-total]').textContent())||'').trim();
    must(totalText.includes('168'),'report total updates from first and last rows',totalText);

    // Browser save/restore remains intact.
    await p.locator('[data-save-quote]').click();
    await p.reload({waitUntil:'networkidle'});
    await p.waitForSelector('[data-quote-check-mode-switch]');
    must((await demolition.locator('[data-q-amount]').inputValue())==='123','saved demolition amount restores');
    must((await vat.locator('[data-q-amount]').inputValue())==='45','saved VAT amount restores');
    must((await visibleRows(p))===12,'reload still defaults to all 12 rows');

    // Existing CSV/TXT local import remains usable in all-row mode.
    const txt='공종\t상태\t금액(만원)\t수량\t단위\t사양\t메모\n욕실\t포함\t333\t2\t개\t600각\t가져오기\n주방\t별도\t444\t1\t식\t상판\t가져오기2';
    await p.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'allrows.txt',mimeType:'text/plain',buffer:Buffer.from(txt,'utf8')
    });
    await p.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    must((await p.locator('[data-qrow="bathroom"] [data-q-amount]').inputValue())==='333','TXT import still updates bathroom row');
    must((await p.locator('[data-qrow="kitchen"] [data-q-amount]').inputValue())==='444','TXT import still updates kitchen row');
    must((await visibleRows(p))===12,'TXT import does not switch out of all-row mode');

    // Wizard remains available as an explicit option.
    await p.locator('[data-quote-check-mode-button="wizard"]').click();
    await p.waitForTimeout(80);
    const wizard=await p.evaluate(()=>({
      mode:document.querySelector('[data-quote-form]')?.dataset.quoteCheckMode||'',
      wizardClass:document.querySelector('.quote-check-table')?.classList.contains('mobile-wizard')||false,
      visible:[...document.querySelectorAll('[data-qrow]')].filter(r=>getComputedStyle(r).display!=='none').length,
      counter:document.querySelector('[data-wizard-counter]')?.textContent?.trim()||'',
      head:getComputedStyle(document.querySelector('.wizard-head')).display,
      actions:getComputedStyle(document.querySelector('.wizard-actions')).display
    }));
    must(wizard.mode==='wizard'&&wizard.wizardClass,'explicit wizard mode activates legacy wizard',JSON.stringify(wizard));
    must(wizard.visible===1,'wizard mode shows exactly one quote row',String(wizard.visible));
    must(wizard.counter==='1 / 12','wizard starts at 1 / 12',wizard.counter);
    must(wizard.head!=='none'&&wizard.actions!=='none','wizard chrome visible only in wizard mode',JSON.stringify(wizard));

    const navHeights=await p.locator('.wizard-actions button').evaluateAll(btns=>btns.map(b=>b.getBoundingClientRect().height));
    must(Math.min(...navHeights)>=44,'wizard navigation remains >=44px',String(Math.min(...navHeights)));
    await p.locator('[data-next]').click();
    await p.waitForTimeout(80);
    must((await p.locator('[data-wizard-counter]').textContent()).trim()==='2 / 12','legacy next navigation still works');
    must(await p.locator('[data-qrow="waste"]').isVisible(),'wizard next shows waste row');

    // Switching back restores all rows without losing edited/imported values.
    await p.locator('[data-quote-check-mode-button="all"]').evaluate(el=>el.click());
    await p.waitForTimeout(80);
    must((await visibleRows(p))===12,'switching back restores all 12 rows');
    must((await p.locator('[data-qrow="bathroom"] [data-q-amount]').inputValue())==='333','mode switching preserves imported values');
    must((await p.locator('[data-qrow="demolition"] [data-q-amount]').inputValue())==='123','mode switching preserves saved values');

    // Handoff action remains present and touch-safe.
    const send=p.locator('[data-send-to-compare]');
    must((await send.count())===1,'quote-check handoff action remains present');
    const sendHeight=await send.evaluate(el=>el.getBoundingClientRect().height);
    must(sendHeight>=44,'handoff action remains >=44px',String(sendHeight));

    must(writes.length===0,'all-row enhancement sends no write requests',JSON.stringify(writes));
    must(pageErrors.length===0,'no uncaught page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no 4xx/5xx responses',JSON.stringify(badResponses));

    const report={
      schema:'interior-final-quote-check-allrows-qa/v1',
      generatedAt:new Date().toISOString(),
      current:{height:boot.height,visibleRows:boot.visible},
      passed:results.filter(r=>r.ok).length,
      failed:failures.length,
      results,failures,pageErrors,badResponses,writes
    };
    await fs.writeFile(process.env.QA_RESULT_PATH||'final-allrows.json',JSON.stringify(report,null,2)+'\n','utf8');
    console.log('QA_TOTAL_ASSERTIONS='+results.length);
    console.log('QA_FAILURES='+failures.length);
    console.log('VISIBLE_ROWS='+boot.visible);
    console.log('HEIGHT='+boot.height);
  }catch(err){
    console.error(err?.stack||err);
    process.exitCode=1;
  }finally{
    await browser.close();
  }
})();
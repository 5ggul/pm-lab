'use strict';

const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const REVIEW_KEY='interior-compare-v7';
const rows=[];
function must(ok,name,detail=''){
  rows.push({ok:!!ok,name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
  if(!ok) throw new Error(name+(detail?': '+detail:''));
}
async function load(page,path){
  const r=await page.goto(BASE+path,{waitUntil:'networkidle',timeout:60000});
  must(!!r&&r.ok(),'HTTP '+path,r?r.status():'no response');
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
  const pageErrors=[],badResponses=[],writes=[];
  context.on('page',p=>{
    p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
    p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
    p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
  });
  try{
    const q=await context.newPage();
    await load(q,'/quote-check/');
    await q.waitForSelector('[data-local-quote-import="check"]');
    const boot=await q.evaluate(()=>({
      api:!!window.InteriorLocalQuoteImportV1,
      script:document.querySelector('script[src*="quote-local-import-v1.js"]')?.src||'',
      secure:window.isSecureContext
    }));
    must(boot.api,'production local import API loaded');
    must(boot.secure,'production secure context');
    must(boot.script.includes('quote-local-import-v1.js?v=bb7e1697e302'),'production import cache key current',boot.script);

    const txt='공종\\t상태\\t금액(만원)\\t수량\\t단위\\t사양\\t메모\\n철거\\t포함\\t321\\t1\\t식\\t전체 철거\\t운영TXT\\n욕실\\t별도\\t654\\t2\\t개\\t600각\\t운영TXT2';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'smoke.txt',mimeType:'text/plain',buffer:Buffer.from(txt,'utf8')
    });
    await q.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    must((await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue())==='321','production TXT import sets demolition amount');
    must((await q.locator('[name="state-bathroom"]:checked').getAttribute('value'))==='separate','production TXT import maps Korean state');

    const before=await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue();
    const bad='공종,상태,금액(만원),수량,단위,사양,메모\\n철거,included,-1,1,식,오류,오류';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from(bad,'utf8')
    });
    await q.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('가져오지 못했습니다'),null,{timeout:15000});
    must((await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue())===before,'production invalid import is atomic');

    const c=await context.newPage();
    await load(c,'/quote-compare/');
    await c.waitForSelector('[data-local-quote-import="compare"]');
    await c.evaluate(k=>localStorage.removeItem(k),REVIEW_KEY);
    await c.reload({waitUntil:'networkidle'});
    await c.waitForSelector('[data-local-quote-import="compare"]');
    const csv='공종,상태,금액(만원),수량,단위,사양,메모\\n철거,포함,111,1,식,철거,메모\\n욕실,별도,222,2,개,욕실,메모2';
    await c.locator('[data-local-quote-import="compare"] [data-local-import-vendor]').selectOption('c');
    await c.locator('[data-local-quote-import="compare"] [data-local-import-file]').setInputFiles({
      name:'smoke.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
    });
    await c.waitForFunction(()=>document.querySelector('[data-local-quote-import="compare"] [data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    await c.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}')?.flat?.['demolition:c:amount']==='111',REVIEW_KEY,{timeout:15000});
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="c"][data-amount]').inputValue())==='111','production CSV import fills selected C vendor');
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue())==='','production CSV import leaves A untouched');
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue())==='','production CSV import leaves B untouched');
    const saved=await c.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),REVIEW_KEY);
    must(saved?.flat?.['bathroom:c:amount']==='222','production compare import autosaves v7');
    must(!new URL(c.url()).search&&!new URL(c.url()).hash,'production import adds no payload to URL');

    must(writes.length===0,'production local import sends no write requests',JSON.stringify(writes));
    must(pageErrors.length===0,'no production page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no production 4xx/5xx responses',JSON.stringify(badResponses));
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=0');
  }catch(err){
    console.error(err?.stack||err);
    console.log('SMOKE_ASSERTIONS='+rows.length);
    console.log('SMOKE_FAILURES=1');
    process.exitCode=1;
  }finally{
    await browser.close();
  }
})();
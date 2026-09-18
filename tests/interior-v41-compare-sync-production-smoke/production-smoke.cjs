'use strict';

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = 'https://5ggul.github.io/pm-lab/interior-cost-preview/quote-compare/';
const REVIEW_KEY='interior-compare-v7';
const RESET_KEY='interior-compare-v7-reset-v1';
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
async function raw(page,key){return page.evaluate(k=>localStorage.getItem(k),key);}
async function json(page,key){const v=await raw(page,key);return v?JSON.parse(v):null;}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
  const pageErrors=[],badResponses=[];
  context.on('page',p=>{
    p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
    p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
  });
  try{
    const a=await context.newPage();
    await load(a);
    await a.evaluate(({review,reset})=>{
      localStorage.removeItem(review);localStorage.removeItem(reset);
      localStorage.removeItem('interior-compare-v5');localStorage.removeItem('interior-compare-v6');
    },{review:REVIEW_KEY,reset:RESET_KEY});
    await a.reload({waitUntil:'networkidle'});

    const boot=await a.evaluate(()=>({
      secure:window.isSecureContext,
      locks:!!navigator.locks&&typeof navigator.locks.request==='function',
      api:!!window.InteriorQuoteCompareAdapter41,
      resetKey:window.InteriorQuoteCompareAdapter41?.RESET_KEY||'',
      script:document.querySelector('script[src*="quote-compare-adapter-v1.js"]')?.src||''
    }));
    must(boot.secure,'production secure context',JSON.stringify(boot));
    must(boot.locks,'production Web Locks available');
    must(boot.api,'hotfix compare adapter loaded');
    must(boot.resetKey===RESET_KEY,'hotfix reset generation API loaded',boot.resetKey);
    must(boot.script.includes('quote-compare-adapter-v1.js?v=09ca24f9332e'),'production cache-bust key is current',boot.script);

    const b=await context.newPage();
    await load(b);
    const a1=a.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
    const b1=b.locator('[data-compare-row="waste"] [data-vendor="b"][data-amount]');
    await a1.fill('1111');
    await b.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='1111',null,{timeout:15000});
    await b1.fill('2222');
    await a.waitForFunction(()=>document.querySelector('[data-compare-row="waste"] [data-vendor="b"][data-amount]')?.value==='2222',null,{timeout:15000});
    const sequential=await json(a,REVIEW_KEY),oldRaw=await raw(a,REVIEW_KEY);
    must(sequential?.flat?.['demolition:a:amount']==='1111'&&sequential?.flat?.['waste:b:amount']==='2222','production sequential cross-tab edits merge');
    must(Number.isSafeInteger(sequential?.revision)&&sequential.revision>0,'production snapshot has revision',String(sequential?.revision));

    const ac=a.locator('[data-compare-row="carpentry"] [data-vendor="c"][data-amount]');
    const bw=b.locator('[data-compare-row="window"] [data-vendor="b"][data-amount]');
    await Promise.all([ac.fill('3333'),bw.fill('4444')]);
    await a.waitForFunction(()=>document.querySelector('[data-compare-row="window"] [data-vendor="b"][data-amount]')?.value==='4444',null,{timeout:15000});
    await b.waitForFunction(()=>document.querySelector('[data-compare-row="carpentry"] [data-vendor="c"][data-amount]')?.value==='3333',null,{timeout:15000});
    const simultaneous=await json(a,REVIEW_KEY);
    must(
      simultaneous?.flat?.['carpentry:c:amount']==='3333'&&simultaneous?.flat?.['window:b:amount']==='4444',
      'production simultaneous disjoint edits preserve both'
    );
    must(simultaneous.revision>sequential.revision,'production revision advances monotonically',simultaneous.revision+'>'+sequential.revision);

    await b.evaluate(({key,raw})=>window.dispatchEvent(new StorageEvent('storage',{key,newValue:raw,oldValue:null,url:location.href})),{key:REVIEW_KEY,raw:oldRaw});
    await b.waitForTimeout(120);
    must((await ac.inputValue())==='3333'&&(await bw.inputValue())==='4444','production delayed stale snapshot ignored');

    const oldField=a.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
    await oldField.fill('5555');
    await b.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='5555',null,{timeout:15000});
    const preResetRaw=await raw(b,REVIEW_KEY);
    await b.locator('[data-compare-row="electrical"] [data-vendor="c"][data-amount]').evaluate(el=>{
      el.value='6666';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await Promise.all([
      a.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}),
      a.locator('[data-reset-compare]').click()
    ]);
    await a.waitForLoadState('networkidle');
    await b.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='',null,{timeout:15000});
    await b.waitForTimeout(200);
    must((await raw(b,REVIEW_KEY))===null,'production remote reset remains deleted');
    must(!!(await raw(b,RESET_KEY)),'production reset generation token exists');

    await b.evaluate(({key,raw})=>window.dispatchEvent(new StorageEvent('storage',{key,newValue:raw,oldValue:null,url:location.href})),{key:REVIEW_KEY,raw:preResetRaw});
    await b.waitForTimeout(120);
    must((await b.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue())==='','production delayed pre-reset snapshot ignored');

    const post=b.locator('[data-compare-row="flooring"] [data-vendor="c"][data-amount]');
    await post.fill('7777');
    await b.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}')?.flat?.['flooring:c:amount']==='7777',REVIEW_KEY,{timeout:15000});
    const postSaved=await json(b,REVIEW_KEY);
    must(postSaved?.flat?.['flooring:c:amount']==='7777','production post-reset edit persists');
    must(!postSaved?.flat?.['demolition:a:amount']&&!postSaved?.flat?.['electrical:c:amount'],'production reset state does not resurrect');

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
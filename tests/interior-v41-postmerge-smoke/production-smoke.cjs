'use strict';

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = 'https://5ggul.github.io/pm-lab/interior-cost-preview';
const LEGACY_KEYS=['interior-quote-v5','interior-compare-v5','interior-compare-v6'];
const SOURCE_KEY='interior-quote-handoff-source-v1';
const HANDOFF_KEY='interior-quote-handoff-v1';
const REVIEW_KEY='interior-compare-v7';

const results=[];
function must(ok,name,detail=''){
  const row={name,ok:!!ok,detail:String(detail??'')};
  results.push(row);
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(row.detail?' :: '+row.detail:''));
  if(!ok) throw new Error(name+(row.detail?': '+row.detail:''));
}
async function goto(page,path){
  const r=await page.goto(BASE+path,{waitUntil:'networkidle',timeout:60000});
  must(!!r&&r.ok(),'HTTP '+path,r?r.status():'no response');
}
async function raw(page,key){return page.evaluate(k=>localStorage.getItem(k),key);}
async function snap(page,keys){return page.evaluate(ks=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)])),keys);}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
  const errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push({url:p.url(),message:String(e?.message||e)})));
  try{
    const page=await context.newPage();
    const failedResponses=[];
    page.on('response',r=>{if(r.status()>=400)failedResponses.push({status:r.status(),url:r.url()});});

    await goto(page,'/quote-check/');
    const env=await page.evaluate(()=>({
      secure:window.isSecureContext,
      locks:!!navigator.locks&&typeof navigator.locks.request==='function',
      handoffAsset:!!window.InteriorQuoteHandoff41
    }));
    must(env.secure,'production secure context',JSON.stringify(env));
    must(env.locks,'production Web Locks available',JSON.stringify(env));
    must(env.handoffAsset,'quote handoff asset loaded',JSON.stringify(env));

    await page.evaluate(keys=>{
      localStorage.setItem(keys[0],JSON.stringify({sentinel:'quote-v5'}));
      localStorage.setItem(keys[1],JSON.stringify({sentinel:'compare-v5'}));
      localStorage.setItem(keys[2],JSON.stringify({sentinel:'compare-v6'}));
    },LEGACY_KEYS);
    const baseline=await snap(page,LEGACY_KEYS);

    const row=page.locator('[data-qrow="demolition"]');
    await row.locator('input[type="radio"][value="included"]').check();
    await row.locator('[data-q-amount]').fill('123');
    await row.locator('[data-q-qty]').fill('1');
    await row.locator('[data-q-unit]').fill('식');
    await row.locator('[data-q-spec]').fill('PROD-SMOKE-SPEC');
    await row.locator('[data-q-memo]').fill('PROD-SMOKE-MEMO');
    await page.locator('[data-context="region"]').fill('운영스모크');

    const send=page.locator('[data-send-to-compare]');
    must((await send.count())===1,'production send action present');
    const h=await send.evaluate(el=>el.getBoundingClientRect().height);
    must(h>=44,'production send action >=44px',h);

    await send.click();
    await page.waitForSelector('dialog.v40-handoff-dialog[open]',{timeout:15000});
    const dialogText=(await page.locator('dialog.v40-handoff-dialog').textContent())||'';
    must(!dialogText.includes('검수용'),'production dialog has no review-only wording',dialogText.trim());
    await page.locator('input[name="v40-target"][value="b"]').check();
    await page.locator('[data-v40-confirm]').click();

    await page.waitForURL(/\/quote-compare\/?$/,{timeout:30000});
    const u=new URL(page.url());
    must(!u.search&&!u.hash,'production URL has no quote payload',page.url());

    await page.waitForSelector('[data-v41-shell-preview]',{timeout:30000});
    const adapter=await page.evaluate(()=>!!window.InteriorQuoteCompareAdapter41);
    must(adapter,'compare adapter asset loaded');

    const before=await page.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue();
    must(before!=='123','handoff not auto-applied',before);

    await page.locator('[data-v41-shell-apply]').click();
    await page.waitForFunction(()=>(
      document.querySelector('[data-v41-shell-status]')?.textContent||''
    ).includes('B 업체 적용 완료'),null,{timeout:30000});
    const after=await page.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue();
    must(after==='123','B demolition applied',after);

    const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),REVIEW_KEY);
    must(saved?.flat?.['demolition:b:amount']==='123','v7 amount persisted');
    must(saved?.vendors?.b?.items?.demolition?.spec==='PROD-SMOKE-SPEC','v7 spec metadata persisted');
    must(saved?.vendors?.b?.items?.demolition?.memo==='PROD-SMOKE-MEMO','v7 memo metadata persisted');
    must(saved?.vendors?.b?.context?.region==='운영스모크','v7 context metadata persisted');
    must((await raw(page,SOURCE_KEY))===null,'handoff source cleaned');
    must((await raw(page,HANDOFF_KEY))===null,'handoff envelope cleaned');

    await page.reload({waitUntil:'networkidle'});
    const restored=await page.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue();
    must(restored==='123','production refresh restores applied compare value',restored);

    const legacyAfter=await snap(page,LEGACY_KEYS);
    must(JSON.stringify(baseline)===JSON.stringify(legacyAfter),'legacy storage keys unchanged',JSON.stringify(legacyAfter));

    const mc=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
    const mp=await mc.newPage();
    await goto(mp,'/quote-check/');
    await mp.waitForSelector('[data-send-to-compare]');
    const metrics=await mp.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      sendHeight:document.querySelector('[data-send-to-compare]')?.getBoundingClientRect().height||0
    }));
    must(!metrics.overflow,'production mobile 375 no page overflow');
    must(metrics.sendHeight>=44,'production mobile 375 send >=44px',metrics.sendHeight);
    await mc.close();

    must(errors.length===0,'no production page errors',JSON.stringify(errors));
    must(failedResponses.length===0,'no production 4xx/5xx responses',JSON.stringify(failedResponses));

    console.log('SMOKE_ASSERTIONS='+results.length);
    console.log('SMOKE_FAILURES=0');
  }catch(err){
    console.error(err?.stack||err);
    console.log('SMOKE_ASSERTIONS='+results.length);
    console.log('SMOKE_FAILURES=1');
    process.exitCode=1;
  }finally{
    await browser.close();
  }
})();
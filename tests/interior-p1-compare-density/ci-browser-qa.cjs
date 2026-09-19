'use strict';

const fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=(process.env.QA_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const SITE='/pm-lab/interior-cost-preview';
const PROD='https://5ggul.github.io/pm-lab/interior-cost-preview';
const REVIEW_KEY='interior-compare-v7';
const results=[],failures=[];

function must(ok,name,detail=''){
  results.push({ok:!!ok,name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
  if(!ok){failures.push({name,detail:String(detail??'')});throw new Error(name+(detail?': '+detail:''));}
}
async function goto(page,url){const r=await page.goto(url,{waitUntil:'networkidle',timeout:60000});must(!!r&&r.ok(),'HTTP '+new URL(url).pathname,r?r.status():'no response');}
async function candidate(page){return goto(page,BASE+SITE+'/quote-compare/');}
async function text(loc){return (await loc.textContent())?.trim()||'';}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const pageErrors=[],badResponses=[];
  try{
    // Current production is the before-density baseline.
    const baselineContext=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
    const baseline=await baselineContext.newPage();
    await goto(baseline,PROD+'/quote-compare/');
    const before=await baseline.evaluate(()=>({
      height:document.documentElement.scrollHeight,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      chart:document.querySelector('[data-v6-compare-chart]')?.getBoundingClientRect().height||0,
      top:document.querySelector('.compare-top')?.getBoundingClientRect().height||0
    }));
    must(!before.overflow,'production baseline 375 has no horizontal overflow',JSON.stringify(before));
    await baselineContext.close();

    const context=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
    context.on('page',p=>{
      p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
      p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
    });
    const p=await context.newPage();
    await candidate(p);
    await p.waitForSelector('[data-compact-compare-result]');

    const boot=await p.evaluate(()=>({
      api:!!window.InteriorCompactCompareV1,
      rows:document.querySelectorAll('[data-compare-row]').length,
      vendors:document.querySelectorAll('[data-compare-row] .vendor-cell').length,
      head:!!document.querySelector('[data-compact-compare-head]'),
      result:!!document.querySelector('[data-compact-compare-result]'),
      chartDisplay:getComputedStyle(document.querySelector('[data-v6-compare-chart]')).display,
      topDisplay:getComputedStyle(document.querySelector('.compare-top')).display,
      oldSummaryDisplay:getComputedStyle(document.querySelector('[data-compare-summary]')).display,
      height:document.documentElement.scrollHeight,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      asset:document.querySelector('script[src*="quote-compare-compact-v1.js"]')?.src||''
    }));
    must(boot.api,'compact compare API loaded',JSON.stringify(boot));
    must(boot.rows===12,'all 12 compare rows preserved',String(boot.rows));
    must(boot.vendors===36,'all A/B/C input cells preserved',String(boot.vendors));
    must(boot.head&&boot.result,'one compact input header and result table present');
    must(boot.chartDisplay==='none'&&boot.topDisplay==='none'&&boot.oldSummaryDisplay==='none','duplicate chart/top/old summary hidden',JSON.stringify({chart:boot.chartDisplay,top:boot.topDisplay,summary:boot.oldSummaryDisplay}));
    must(!boot.overflow,'compact compare 375 has no horizontal overflow',JSON.stringify(boot));
    must(boot.asset.includes('quote-compare-compact-v1.js?v=e40c2fbcdc01'),'compact asset cache key current',boot.asset);
    const ratio=boot.height/before.height;
    must(ratio<=0.72,'mobile document height reduced by at least 28%',JSON.stringify({before:before.height,after:boot.height,ratio:Number(ratio.toFixed(3))}));

    const minHeights=await p.evaluate(()=>[...document.querySelectorAll('[data-compare-row] select,[data-compare-row] input[data-amount]')].map(el=>el.getBoundingClientRect().height));
    must(Math.min(...minHeights)>=44,'mobile compare controls remain >=44px',String(Math.min(...minHeights)));

    // Basic result table math and condition warning.
    async function set(id,vendor,state,amount){
      const row=p.locator('[data-compare-row="'+id+'"]');
      await row.locator('[data-vendor="'+vendor+'"][data-state]').selectOption(state);
      await row.locator('[data-vendor="'+vendor+'"][data-amount]').fill(String(amount));
    }
    await set('demolition','a','included',100);
    await set('demolition','b','included',150);
    await set('demolition','c','included',120);
    await set('waste','a','separate',50);
    await set('waste','b','included',60);
    await set('waste','c','separate',70);
    await p.waitForTimeout(120);

    const totals={};
    for(const v of ['a','b','c'])totals[v]=await text(p.locator('[data-compact-vendor="'+v+'"] [data-compact-total]'));
    must(totals.a==='150만원'&&totals.b==='210만원'&&totals.c==='190만원','compact result totals are correct',JSON.stringify(totals));
    const counts=await p.evaluate(()=>Object.fromEntries(['a','b','c'].map(v=>{
      const row=document.querySelector('[data-compact-vendor="'+v+'"]');
      return [v,{
        included:row.querySelector('[data-compact-included]').textContent,
        separate:row.querySelector('[data-compact-separate]').textContent,
        missing:row.querySelector('[data-compact-missing]').textContent
      }];
    })));
    must(counts.a.included==='1'&&counts.a.separate==='1'&&counts.a.missing==='10','A state counts correct',JSON.stringify(counts.a));
    must(counts.b.included==='2'&&counts.b.separate==='0'&&counts.b.missing==='10','B state counts correct',JSON.stringify(counts.b));
    const note=await text(p.locator('[data-compact-result-note]'));
    must(note.includes('단순 총액 비교 불가')&&note.includes('폐기물'),'critical condition mismatch warning preserved',note);
    must((await text(p.locator('[data-compact-mismatch]')))==='조건 차이 1개','mismatch count correct',await text(p.locator('[data-compact-mismatch]')));

    // Difference-only filter still acts on the single input grid.
    await p.locator('[data-diff-only]').check();
    await p.waitForTimeout(80);
    must(await p.locator('[data-compare-row="demolition"]').isHidden(),'diff filter hides matching demolition row');
    must(await p.locator('[data-compare-row="waste"]').isVisible(),'diff filter keeps mismatched waste row');
    await p.locator('[data-diff-only]').uncheck();

    // Local CSV import remains wired and updates result + v7.
    must((await p.locator('[data-local-quote-import="compare"]').count())===1,'local import remains present');
    await p.evaluate(k=>localStorage.removeItem(k),REVIEW_KEY);
    await p.locator('[data-local-import-vendor]').selectOption('b');
    const csv='공종,상태,금액(만원),수량,단위,사양,메모\n철거,포함,500,1,식,철거,메모\n욕실,별도,250,1,식,욕실,메모';
    await p.locator('[data-local-import-file]').setInputFiles({name:'compact.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')});
    await p.waitForFunction(()=>document.querySelector('[data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}')?.flat?.['demolition:b:amount']==='500',REVIEW_KEY,{timeout:15000});
    must((await p.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue())==='500','CSV import still fills B vendor');
    const bTotalAfter=await text(p.locator('[data-compact-vendor="b"] [data-compact-total]'));
    must(bTotalAfter==='750만원','result table updates after CSV import',bTotalAfter);

    // Cross-tab sync must update the compact result, not just the inputs.
    const p2=await context.newPage();
    await candidate(p2);
    await p2.waitForSelector('[data-compact-compare-result]');
    await p.locator('[data-compare-row="flooring"] [data-vendor="c"][data-amount]').fill('333');
    await p2.waitForFunction(()=>document.querySelector('[data-compare-row="flooring"] [data-vendor="c"][data-amount]')?.value==='333',null,{timeout:15000});
    await p2.waitForFunction(()=>document.querySelector('[data-compact-vendor="c"] [data-compact-total]')?.textContent.includes('523'),null,{timeout:15000});
    must((await p2.locator('[data-compare-row="flooring"] [data-vendor="c"][data-amount]').inputValue())==='333','cross-tab input sync preserved');
    must((await text(p2.locator('[data-compact-vendor="c"] [data-compact-total]'))).includes('523'),'cross-tab compact result rerenders');

    // Reset still clears v7 and compact result resets.
    await Promise.all([
      p.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}),
      p.locator('[data-reset-compare]').click()
    ]);
    await p.waitForLoadState('networkidle');
    await p.waitForSelector('[data-compact-compare-result]');
    must((await p.evaluate(k=>localStorage.getItem(k),REVIEW_KEY))===null,'reset still clears v7');
    must((await text(p.locator('[data-compact-vendor="a"] [data-compact-total]')))==='0만원','compact result resets to zero');

    must(pageErrors.length===0,'no uncaught page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no 4xx/5xx responses',JSON.stringify(badResponses));

    const report={schema:'interior-p1-compare-density-qa/v1',generatedAt:new Date().toISOString(),beforeHeight:before.height,afterHeight:boot.height,heightRatio:ratio,passed:results.filter(r=>r.ok).length,failed:failures.length,results,failures,pageErrors,badResponses};
    await fs.writeFile(process.env.QA_RESULT_PATH||'interior-p1-compare-density-qa.json',JSON.stringify(report,null,2)+'\n','utf8');
    console.log('QA_TOTAL_ASSERTIONS='+results.length);
    console.log('QA_FAILURES='+failures.length);
    console.log('MOBILE_HEIGHT_BEFORE='+before.height);
    console.log('MOBILE_HEIGHT_AFTER='+boot.height);
    console.log('MOBILE_HEIGHT_RATIO='+ratio.toFixed(3));
  }catch(err){
    console.error(err?.stack||err);process.exitCode=1;
  }finally{await browser.close();}
})();
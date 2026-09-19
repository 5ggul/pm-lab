'use strict';

const fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const BASE=(process.env.QA_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const SITE='/pm-lab/interior-cost-preview';
const ITEMS=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
const LEGACY_KEYS=['interior-quote-v5','interior-compare-v5','interior-compare-v6'];
const REVIEW_KEY='interior-compare-v7';
const results=[],failures=[];

function record(name,ok,detail=''){
  results.push({name,ok:!!ok,detail:String(detail??'')});
  if(!ok)failures.push({name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
}
function must(ok,name,detail=''){record(name,ok,detail);if(!ok)throw new Error(name+(detail?': '+detail:''));}
function url(path){return BASE+SITE+path;}
async function goto(page,path){
  const r=await page.goto(url(path),{waitUntil:'domcontentloaded',timeout:60000});
  must(!!r&&r.ok(),'HTTP '+path,r?r.status():'no response');
}
async function raw(page,key){return page.evaluate(k=>localStorage.getItem(k),key);}
async function snapshot(page,keys){return page.evaluate(ks=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)])),keys);}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR',acceptDownloads:true});
  const pageErrors=[],badResponses=[],writeRequests=[];
  context.on('page',p=>{
    p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
    p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
    p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writeRequests.push({method:r.method(),url:r.url()});});
  });

  try{
    const q=await context.newPage();
    await goto(q,'/quote-check/');
    await q.waitForSelector('[data-local-quote-import="check"]');
    const api=await q.evaluate(()=>({
      present:!!window.InteriorLocalQuoteImportV1,
      secure:window.isSecureContext,
      max:window.InteriorLocalQuoteImportV1?.MAX_FILE_BYTES||0
    }));
    must(api.present,'local import API loaded on quote-check',JSON.stringify(api));
    must(api.secure,'quote-check secure context');
    must(api.max===2*1024*1024,'2MB local file limit',String(api.max));
    const checkImportAsset=await q.locator('script[src*="quote-local-import-v1.js"]').getAttribute('src');
    must((checkImportAsset||'').includes('quote-local-import-v1.js?v=c1f4a4894c42'),'quote-check importer cache key current',checkImportAsset||'');

    const legacyBaseline=await snapshot(q,LEGACY_KEYS);

    // Populate all 12 items, export CSV, then change the form and import the downloaded CSV back.
    for(let i=0;i<ITEMS.length;i++){
      const id=ITEMS[i],row=q.locator('[data-qrow="'+id+'"]');
      await row.locator('input[type="radio"][value="'+(i%3===0?'included':i%3===1?'separate':'missing')+'"]').check();
      await row.locator('[data-q-amount]').fill(String((i+1)*111));
      await row.locator('[data-q-qty]').fill(String(i+1));
      await row.locator('[data-q-unit]').fill(i%2?'식':'㎡');
      await row.locator('[data-q-spec]').fill(i===4?'화이트,우드 "상판"':'SPEC-'+id);
      await row.locator('[data-q-memo]').fill('MEMO-'+id);
    }
    const expected=await q.evaluate(items=>Object.fromEntries(items.map(id=>{
      const row=document.querySelector('[data-qrow="'+id+'"]');
      return [id,{
        state:row.querySelector('[name="state-'+id+'"]:checked')?.value||'',
        amount:row.querySelector('[data-q-amount]')?.value||'',
        qty:row.querySelector('[data-q-qty]')?.value||'',
        unit:row.querySelector('[data-q-unit]')?.value||'',
        spec:row.querySelector('[data-q-spec]')?.value||'',
        memo:row.querySelector('[data-q-memo]')?.value||''
      }];
    })),ITEMS);

    const [download]=await Promise.all([
      q.waitForEvent('download'),
      q.locator('[data-export-csv]').click()
    ]);
    const downloadPath=await download.path();
    must(!!downloadPath,'quote-check CSV export downloaded',download.suggestedFilename());
    const csvBuffer=await fs.readFile(downloadPath);
    must(csvBuffer.length>100,'exported CSV has content',String(csvBuffer.length));

    // Disturb every row so the import must actually restore values.
    for(const id of ITEMS){
      const row=q.locator('[data-qrow="'+id+'"]');
      await row.locator('input[type="radio"][value="missing"]').check();
      await row.locator('[data-q-amount]').fill('');
      await row.locator('[data-q-qty]').fill('');
      await row.locator('[data-q-unit]').fill('');
      await row.locator('[data-q-spec]').fill('');
      await row.locator('[data-q-memo]').fill('');
    }
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'roundtrip.csv',mimeType:'text/csv',buffer:csvBuffer
    });
    await q.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('12개 공종'),null,{timeout:15000});
    const restored=await q.evaluate(items=>Object.fromEntries(items.map(id=>{
      const row=document.querySelector('[data-qrow="'+id+'"]');
      return [id,{
        state:row.querySelector('[name="state-'+id+'"]:checked')?.value||'',
        amount:row.querySelector('[data-q-amount]')?.value||'',
        qty:row.querySelector('[data-q-qty]')?.value||'',
        unit:row.querySelector('[data-q-unit]')?.value||'',
        spec:row.querySelector('[data-q-spec]')?.value||'',
        memo:row.querySelector('[data-q-memo]')?.value||''
      }];
    })),ITEMS);
    must(JSON.stringify(restored)===JSON.stringify(expected),'export CSV round-trips all 12 quote rows');
    must(restored.kitchen.spec==='화이트,우드 "상판"','quoted comma and escaped quote round-trip',restored.kitchen.spec);

    // TXT/TSV with Korean state names.
    const txt='공종\t상태\t금액(만원)\t수량\t단위\t사양\t메모\n철거\t포함\t321\t1\t식\t철거 전체\tTXT 메모\n욕실\t별도\t654\t2\t개\t타일 600각\t별도 확인';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'sample.txt',mimeType:'text/plain',buffer:Buffer.from(txt,'utf8')
    });
    await q.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('2개 공종'),null,{timeout:15000});
    must((await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue())==='321','TXT import sets demolition amount');
    must((await q.locator('[name="state-bathroom"]:checked').getAttribute('value'))==='separate','TXT Korean state maps to separate');

    // Invalid input is atomic: no partial mutation.
    const beforeInvalid=await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue();
    const invalid='공종,상태,금액(만원),수량,단위,사양,메모\n철거,included,-1,1,식,오류,오류\n욕실,included,999,1,식,정상,정상';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from(invalid,'utf8')
    });
    await q.waitForFunction(()=>document.querySelector('[data-local-quote-import="check"] [data-local-import-status]')?.textContent.includes('가져오지 못했습니다'),null,{timeout:15000});
    must((await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue())===beforeInvalid,'invalid CSV does not partially mutate quote-check');

    // Direct parser rejects duplicate/unknown rows.
    const validation=await q.evaluate(()=>{
      const api=window.InteriorLocalQuoteImportV1;
      const out={duplicate:false,unknown:false};
      try{api.parseQuoteText('공종,상태,금액\n철거,included,1\n철거,separate,2');}catch{out.duplicate=true;}
      try{api.parseQuoteText('공종,상태,금액\n알수없음,included,1');}catch{out.unknown=true;}
      return out;
    });
    must(validation.duplicate&&validation.unknown,'parser rejects duplicate and unknown items',JSON.stringify(validation));

    // Independent parser integrity: fixed-schema rows must not silently drop extra cells.
    const parserEdges=await q.evaluate(()=>{
      const api=window.InteriorLocalQuoteImportV1;
      const out={extraCellRejected:false,duplicateSemanticHeaderRejected:false,unclosedQuoteRejected:false,extraCellParsed:null,shortRowAccepted:false,unknownHeaderAccepted:false};
      const extra='공종,상태,금액(만원),수량,단위,사양,메모\n철거,포함,100,1,식,가로,세로,중요메모';
      try{
        out.extraCellParsed=api.parseQuoteText(extra);
      }catch{
        out.extraCellRejected=true;
      }
      try{
        api.parseQuoteText('공종,item,상태,금액(만원)\n철거,욕실,포함,100');
      }catch{
        out.duplicateSemanticHeaderRejected=true;
      }
      try{
        api.parseQuoteText('공종,상태,금액(만원),메모\n철거,포함,100,"닫히지 않음');
      }catch{
        out.unclosedQuoteRejected=true;
      }
      try{
        const parsed=api.parseQuoteText('공종,상태,금액(만원),수량,단위,사양,메모\n철거,포함,100');
        out.shortRowAccepted=parsed?.data?.[0]?.item==='demolition'&&parsed.data[0].qty===''&&parsed.data[0].memo==='';
      }catch{}
      try{
        const parsed=api.parseQuoteText('공종,상태,금액(만원),업체내부코드\n철거,포함,100,X1');
        out.unknownHeaderAccepted=parsed?.data?.[0]?.amount==='100';
      }catch{}
      return out;
    });
    must(parserEdges.unclosedQuoteRejected,'parser rejects unclosed quoted CSV');
    must(parserEdges.shortRowAccepted,'parser keeps shorter optional-field rows compatible');
    must(parserEdges.unknownHeaderAccepted,'parser tolerates aligned unknown extra headers');
    record('parser rejects data rows wider than the fixed header',parserEdges.extraCellRejected,JSON.stringify(parserEdges.extraCellParsed));
    record('parser rejects duplicate semantic header aliases',parserEdges.duplicateSemanticHeaderRejected);

    // Wider malformed rows must also be atomic through the real file-input UI.
    const widthBefore=await q.evaluate(()=>({
      spec:document.querySelector('[data-qrow="demolition"] [data-q-spec]')?.value||'',
      memo:document.querySelector('[data-qrow="demolition"] [data-q-memo]')?.value||''
    }));
    const wider='공종,상태,금액(만원),수량,단위,사양,메모\n철거,포함,100,1,식,가로,세로,중요메모';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'wider-row.csv',mimeType:'text/csv',buffer:Buffer.from(wider,'utf8')
    });
    await q.waitForTimeout(300);
    const widthStatus=(await q.locator('[data-local-quote-import="check"] [data-local-import-status]').textContent())||'';
    const widthAfter=await q.evaluate(()=>({
      spec:document.querySelector('[data-qrow="demolition"] [data-q-spec]')?.value||'',
      memo:document.querySelector('[data-qrow="demolition"] [data-q-memo]')?.value||''
    }));
    record('wider malformed CSV reports rejection',widthStatus.includes('가져오지 못했습니다'),widthStatus);
    record('wider malformed CSV is rejected atomically',JSON.stringify(widthAfter)===JSON.stringify(widthBefore),JSON.stringify({before:widthBefore,after:widthAfter,status:widthStatus}));

    // Duplicate semantic headers must not silently choose the first alias.
    const dupBefore=await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue();
    const dupHeader='공종,item,상태,금액(만원)\n철거,욕실,포함,909';
    await q.locator('[data-local-quote-import="check"] [data-local-import-file]').setInputFiles({
      name:'duplicate-header.csv',mimeType:'text/csv',buffer:Buffer.from(dupHeader,'utf8')
    });
    await q.waitForTimeout(300);
    const dupStatus=(await q.locator('[data-local-quote-import="check"] [data-local-import-status]').textContent())||'';
    const dupAfter=await q.locator('[data-qrow="demolition"] [data-q-amount]').inputValue();
    record('duplicate semantic header reports rejection',dupStatus.includes('가져오지 못했습니다'),dupStatus);
    record('duplicate semantic header does not mutate quote-check',dupAfter===dupBefore,JSON.stringify({before:dupBefore,after:dupAfter,status:dupStatus}));

    // Compare import into B; only selected vendor changes and v7 autosaves.
    const c=await context.newPage();
    await goto(c,'/quote-compare/');
    await c.waitForSelector('[data-local-quote-import="compare"]');
    const compareImportAsset=await c.locator('script[src*="quote-local-import-v1.js"]').getAttribute('src');
    must((compareImportAsset||'').includes('quote-local-import-v1.js?v=c1f4a4894c42'),'quote-compare importer cache key current',compareImportAsset||'');
    await c.evaluate(keys=>keys.forEach(k=>localStorage.removeItem(k)),[REVIEW_KEY,'interior-compare-v7-reset-v1']);
    await c.reload({waitUntil:'domcontentloaded'});
    await c.waitForSelector('[data-local-quote-import="compare"]');
    const baselineCompare=await snapshot(c,LEGACY_KEYS);
    await c.locator('[data-local-quote-import="compare"] [data-local-import-vendor]').selectOption('b');
    await c.locator('[data-local-quote-import="compare"] [data-local-import-file]').setInputFiles({
      name:'roundtrip.csv',mimeType:'text/csv',buffer:csvBuffer
    });
    await c.waitForFunction(()=>document.querySelector('[data-local-quote-import="compare"] [data-local-import-status]')?.textContent.includes('12개 공종'),null,{timeout:15000});
    await c.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{}')?.flat?.['demolition:b:amount']==='111',REVIEW_KEY,{timeout:15000});
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue())==='111','compare import fills selected B vendor');
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue())==='','compare import leaves A untouched');
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="c"][data-amount]').inputValue())==='','compare import leaves C untouched');
    const review=JSON.parse((await raw(c,REVIEW_KEY))||'{}');
    must(review?.flat?.['kitchen:b:amount']==='555','compare import autosaves B vendor to v7',JSON.stringify(review?.flat?.['kitchen:b:amount']));
    must(JSON.stringify(await snapshot(c,LEGACY_KEYS))===JSON.stringify(baselineCompare),'compare import leaves legacy storage exact values unchanged');

    const current=new URL(c.url());
    must(!current.search&&!current.hash,'local import does not add file data to URL',c.url());

    // Oversize guard without mutating the form.
    const huge=Buffer.alloc(2*1024*1024+1,65);
    const bBefore=await c.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue();
    await c.locator('[data-local-quote-import="compare"] [data-local-import-file]').setInputFiles({
      name:'huge.txt',mimeType:'text/plain',buffer:huge
    });
    await c.waitForFunction(()=>document.querySelector('[data-local-quote-import="compare"] [data-local-import-status]')?.textContent.includes('2MB 이하'),null,{timeout:15000});
    must((await c.locator('[data-compare-row="demolition"] [data-vendor="b"][data-amount]').inputValue())===bBefore,'oversize file is rejected before mutation');

    // 375px mobile import controls remain usable and do not overflow.
    const mc=await browser.newContext({viewport:{width:375,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
    const mp=await mc.newPage();
    await goto(mp,'/quote-check/');
    await mp.waitForSelector('[data-local-quote-import="check"]');
    const mm=await mp.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      height:document.querySelector('[data-local-quote-import="check"] [data-local-import-open]')?.getBoundingClientRect().height||0
    }));
    must(!mm.overflow,'mobile 375 import UI no page overflow');
    must(mm.height>=44,'mobile 375 import action >=44px',String(mm.height));
    await mc.close();

    must(writeRequests.length===0,'local import sends no write requests',JSON.stringify(writeRequests));
    must(pageErrors.length===0,'no uncaught page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no 4xx/5xx responses',JSON.stringify(badResponses));

    const report={schema:'interior-final-import-qa/v1',generatedAt:new Date().toISOString(),passed:results.filter(r=>r.ok).length,failed:failures.length,results,failures,pageErrors,badResponses,writeRequests};
    await fs.writeFile(process.env.QA_RESULT_PATH||'final-import.json',JSON.stringify(report,null,2)+'\n','utf8');
    console.log('QA_TOTAL_ASSERTIONS='+results.length);
    console.log('QA_FAILURES='+failures.length);
    if(failures.length)process.exitCode=1;
  }catch(err){
    console.error(err?.stack||err);
    const report={schema:'interior-final-import-qa/v1',generatedAt:new Date().toISOString(),passed:results.filter(r=>r.ok).length,failed:failures.length+1,results,failures:[...failures,{name:'fatal',detail:String(err?.stack||err)}],pageErrors,badResponses,writeRequests};
    await fs.writeFile(process.env.QA_RESULT_PATH||'final-import.json',JSON.stringify(report,null,2)+'\n','utf8').catch(()=>{});
    process.exitCode=1;
  }finally{
    await browser.close();
  }
})();
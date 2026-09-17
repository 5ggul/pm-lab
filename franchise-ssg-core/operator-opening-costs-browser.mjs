import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/operator-opening-costs');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const targets=[
  {route:'brands/paiks-coffee/',name:'빽다방',source:'https://start.theborn.co.kr/paikdabang',rows:1,amount:'65,530,000원',basis:'10평 기준',vat:'VAT 별도'},
  {route:'brands/cu/',name:'CU',source:'https://cuopen.bgfretail.com/introduction.jsp',rows:4,amount:'22,000,000원',basis:'기본 필수 납입금',vat:'가입비 VAT 별도'}
];
const pageUrl=route=>new URL(route,base).href;

async function run(width,target){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,route:target.route,pass:false};
  try{
    const response=await page.goto(pageUrl(target.route),{waitUntil:'load'});assert.equal(response?.status(),200);
    assert.equal((await page.locator('h1').innerText()).trim(),target.name,'brand context must remain explicit in page H1');
    const block=page.locator('#official-current-cost');await block.waitFor();
    assert.equal((await block.locator('h2').innerText()).trim(),'본사 개설비','final v11.52 compact section heading changed unexpectedly');
    assert.equal(await block.locator('tbody tr').count(),target.rows);
    const text=await block.innerText();assert.ok(text.includes(target.amount));assert.ok(text.includes(target.basis));assert.ok(text.includes(target.vat));assert.ok(text.includes('확인일 2026-09-17'));
    const source=block.locator('a[rel*="external"]');assert.equal(await source.getAttribute('href'),target.source);
    assert.equal(await page.locator('[data-v39-evidence="1"]').count(),1,'FTC evidence layer must remain separate and present');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow,noarchive,nosnippet');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    if(width===390)await block.screenshot({path:path.join(output,`${engine}-${target.name==='CU'?'cu':'paiks'}-${width}.png`)});
    item.evidence={brand:target.name,heading:'본사 개설비',rows:target.rows,source:target.source,amount:target.amount,ftcLayerPreserved:true,noindex:true,overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-operator-cost-FAIL-${target.name}-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{
  browser=await tooling[engine].launch({headless:true});
  for(const target of targets)for(const width of [390,768,1440])await run(width,target);
}finally{
  await browser?.close();
  const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===6&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'First-party current opening-cost evidence for Paikdabang and CU remains separate from FTC disclosure data, preserves preview noindex, and renders without document overflow.'};
  fs.writeFileSync(path.join(output,`operator-opening-costs-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

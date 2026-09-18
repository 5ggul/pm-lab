import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/trust-consistency');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const pageUrl=route=>new URL(route.replace(/^\//,''),base).href;

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,pass:false};
  try{
    let response=await page.goto(pageUrl('methodology/'),{waitUntil:'load'});assert.equal(response?.status(),200);
    const gate=page.locator('[data-v52-trust-gate="1"]'),items=gate.locator('[data-v52-trust-gate-item]');await gate.waitFor();const gateText=await gate.innerText();assert.ok(gateText.includes('데이터 검수 단계'));assert.ok(!gateText.includes('DATA GATE'));assert.ok(!gateText.includes('데이터 공개 게이트'));
    assert.equal(await items.count(),3);assert.equal(await page.locator('h1').innerText(),'계산 기준');
    const values=await items.locator('strong').allTextContents();assert.deepEqual(values.map(x=>x.trim()),['170개','149개','136개']);
    const hrefs=await gate.locator('a').evaluateAll(xs=>xs.map(x=>new URL(x.href).pathname));for(const suffix of ['/sources/','/updates/','/disclaimer/'])assert.ok(hrefs.some(x=>x.endsWith(suffix)),suffix);
    const cols=await gate.locator('.v52-trust-gate-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);assert.equal(cols,width>900?3:1);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow,noarchive,nosnippet');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(width===390||width===1440)await page.screenshot({path:path.join(output,`${engine}-trust-methodology-${width}.png`),fullPage:true});

    response=await page.goto(pageUrl('updates/'),{waitUntil:'load'});assert.equal(response?.status(),200);const updates=await page.locator('article').innerText();
    assert.ok(updates.includes('170개'));assert.ok(updates.includes('149개'));assert.ok(updates.includes('136개'));assert.ok(!updates.includes('0개는 미매칭'));assert.ok(!updates.includes('0개는 명칭 중복 확인'));

    response=await page.goto(pageUrl('sources/'),{waitUntil:'load'});assert.equal(response?.status(),200);const sources=await page.locator('article').innerText();
    assert.ok(sources.includes('170개'));assert.ok(sources.includes('149개'));assert.ok(sources.includes('136개'));
    const operator=page.locator('[data-v52-operator-evidence="1"]');await operator.waitFor();const operatorText=await operator.innerText();assert.ok(operatorText.includes('가맹본부 직접 확인'));assert.ok(!operatorText.includes('FIRST-PARTY COST EVIDENCE'));
    assert.equal(await operator.locator('[data-v52-operator-brand]').count(),12);
    const stats=(await operator.locator('.v52-operator-stats strong').allTextContents()).map(x=>x.trim());assert.deepEqual(stats,['12개','2026-09-09 ~ 2026-09-17','45일 이내']);
    const sourceLinks=operator.locator('tbody a[rel*="external"]');assert.equal(await sourceLinks.count(),12);
    const names=(await operator.locator('tbody th').allTextContents()).map(x=>x.trim());for(const name of ['굽네치킨','한솥','프랭크버거','설빙','이마트24'])assert.ok(names.includes(name),name);
    const sourceDescription=await page.locator('meta[name="description"]').getAttribute('content');assert.ok(sourceDescription?.includes('가맹본부 공식 페이지'));
    const tableState=await operator.locator('.v52-operator-table-wrap').evaluate(el=>({overflowX:getComputedStyle(el).overflowX,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    if(width<=768){assert.equal(tableState.overflowX,'auto');assert.ok(tableState.scrollWidth>=tableState.clientWidth)}
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow,noarchive,nosnippet');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(width===390||width===1440)await operator.screenshot({path:path.join(output,`${engine}-operator-evidence-sources-${width}.png`)});
    assert.deepEqual(errors,[]);
    item.evidence={methodologyGateItems:3,counts:['170','149','136'],updatesContradictionRemoved:true,sourcesAligned:true,operatorEvidenceBrands:12,operatorDates:['2026-09-09','2026-09-17'],freshnessGateDays:45,firstPartyLinks:12,operatorTableOverflow:tableState.overflowX,layout:width>900?'3-col':'1-col',overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-trust-consistency-FAIL-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}
try{browser=await tooling[engine].launch({headless:true});for(const width of [390,768,1440])await run(width)}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===3&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Trust-page consistency plus 12-brand first-party opening-cost evidence scope, freshness and source links at 390/768/1440.'};
  fs.writeFileSync(path.join(output,`trust-consistency-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

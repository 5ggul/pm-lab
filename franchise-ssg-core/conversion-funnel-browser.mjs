import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname));
assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-funnel');
fs.mkdirSync(output,{recursive:true});
const cases=[],reuseCases=[];let browser;

async function inspectBrandDecision(page){
  await page.waitForFunction(()=>document.body.classList.contains('v52-brand-decision'));
  return page.evaluate(()=>{
    const kpis=[...document.querySelectorAll('.v35-kpis > div')],mobile=document.querySelector('[data-v52-mobile-actions]'),topActions=[...document.querySelectorAll('.brand-actions [data-v52-action]')];
    const boxes=kpis.map(el=>{const r=el.getBoundingClientRect();return{top:r.top,left:r.left,width:r.width,height:r.height,text:el.textContent.trim()}}),mobileStyle=mobile?getComputedStyle(mobile):null;
    const dominant=document.querySelector('.v35-comp-row.v52-dominant-cost'),benchmark=document.querySelector('.v52-benchmark-cards'),checks=document.querySelector('.v52-cost-checks .v49-check-list');
    const storeSummary=document.querySelector('[data-v52-store-summary]'),yearCards=document.querySelector('.v52-year-cards'),latestYear=document.querySelector('.v35-year.v52-latest-year'),rawGrid=document.querySelector('.v52-raw-panel .v35-raw-grid'),historyWrap=document.querySelector('.v52-history-table-wrap');
    return{
      kpiCount:kpis.length,kpiBoxes:boxes,mobileDisplay:mobileStyle?.display||null,mobileLabels:mobile?[...mobile.querySelectorAll('a')].map(a=>a.textContent.trim()):[],mobileHrefs:mobile?[...mobile.querySelectorAll('a')].map(a=>a.getAttribute('href')):[],topLabels:topActions.map(a=>a.textContent.trim()),bodyClass:document.body.classList.contains('v52-brand-decision'),overflow:document.documentElement.scrollWidth>innerWidth+1,
      dominantText:dominant?.textContent.trim()||'',dominantShare:dominant?.dataset.v35Share||null,checkCount:checks?.children.length||0,checkColumns:checks?getComputedStyle(checks).gridTemplateColumns:'',benchmarkDisplay:benchmark?getComputedStyle(benchmark).display:null,benchmarkOverflow:benchmark?getComputedStyle(benchmark).overflowX:null,benchmarkCount:benchmark?.children.length||0,
      storeSummaryCount:storeSummary?.children.length||0,storeSummaryText:storeSummary?.textContent.trim()||'',yearDisplay:yearCards?getComputedStyle(yearCards).display:null,yearOverflow:yearCards?getComputedStyle(yearCards).overflowX:null,yearCount:yearCards?.children.length||0,latestYear:latestYear?.dataset.v35Year||null,
      rawColumns:rawGrid?getComputedStyle(rawGrid).gridTemplateColumns:'',rawCount:rawGrid?.children.length||0,historyOverflow:historyWrap?getComputedStyle(historyWrap).overflowX:null,historyTabIndex:historyWrap?.getAttribute('tabindex')||null
    };
  });
}

function assertDecisionState(state,width,{expectHistory=true}={}){
  assert.equal(state.bodyClass,true);assert.equal(state.kpiCount,5);assert.deepEqual(state.topLabels,['비용 계산','브랜드 비교']);assert.equal(state.overflow,false);assert.ok(Number(state.dominantShare)>0);assert.equal(state.checkCount,3);assert.ok(state.benchmarkCount>=4);
  if(expectHistory){assert.equal(state.storeSummaryCount,3);assert.ok(state.yearCount>=2);assert.ok(state.latestYear);assert.ok(state.rawCount>=8);assert.equal(state.historyTabIndex,'0');}
  if(width===390){assert.equal(state.mobileDisplay,'grid');assert.deepEqual(state.mobileLabels,['비용 계산','브랜드 비교']);assert.equal(state.benchmarkDisplay,'flex');assert.equal(state.benchmarkOverflow,'auto');assert.equal(state.checkColumns.split(' ').length,1);if(expectHistory){assert.equal(state.yearDisplay,'flex');assert.equal(state.yearOverflow,'auto');assert.equal(state.rawColumns.split(' ').length,2);assert.equal(state.historyOverflow,'auto');}}
  else{assert.equal(state.mobileDisplay,'none');assert.equal(state.benchmarkDisplay,'grid');assert.ok(state.checkColumns.split(' ').length>=3);if(expectHistory){assert.ok(state.rawColumns.split(' ').length>=4);}}
}

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);
  const item={width,pass:false},errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===base.origin)failures.push({url:r.url(),status:r.status()})});
  try{
    let response=await page.goto(new URL('brands/',base).href,{waitUntil:'load'});assert.equal(response?.status(),200);const search=page.locator('#directorySearch');await search.fill('메가MGC커피');await page.waitForFunction(()=>document.querySelectorAll('#directoryTable tbody tr:not([hidden])').length===1);const result=page.locator('#directoryTable tbody tr:not([hidden]) a').first();assert.equal((await result.textContent()).trim(),'메가MGC커피');item.searchUrl=new URL(page.url()).searchParams.get('q');assert.equal(item.searchUrl,'메가MGC커피');await result.click();await page.waitForURL(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});assert.equal((await page.locator('main h1').textContent()).trim(),'메가MGC커피');
    const state=await inspectBrandDecision(page);assertDecisionState(state,width);item.detailReached=true;assert.ok(state.dominantText.includes('기타'));assert.ok(Number(state.dominantShare)>70);assert.ok(state.storeSummaryText.includes('+644개'));assert.ok(state.storeSummaryText.includes('657개'));assert.ok(state.storeSummaryText.includes('13개'));assert.equal(state.latestYear,'2025');
    if(width===390){assert.ok(state.mobileHrefs[0]?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));assert.ok(state.mobileHrefs[1]?.includes('/compare/?a=mega-mgc-coffee'));const fourth=state.kpiBoxes[3],fifth=state.kpiBoxes[4];assert.ok(Math.abs(fourth.top-fifth.top)<=2);assert.ok(Math.abs(fourth.width-fifth.width)<=2);}
    item.brandDecisionLayout=true;item.costDecisionLayout=true;item.storeHistoryLayout=true;if(width===390)await page.screenshot({path:path.join(output,`${engine}-funnel-detail-${width}.png`),animations:'disabled',fullPage:true});
    const compareHref=await page.locator('.brand-actions a').filter({hasText:'비교'}).getAttribute('href');assert.ok(compareHref?.includes('/compare/?a=mega-mgc-coffee'));await page.locator('.brand-actions a').filter({hasText:'비교'}).click();await page.waitForURL(url=>url.pathname.endsWith('/compare/')&&url.searchParams.get('a')==='mega-mgc-coffee',{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('[data-v34-pick]')?.value==='mega-mgc-coffee');assert.ok((await page.locator('[data-v49-compare-chips]').textContent()).includes('메가MGC커피'));item.comparePreservedBrand=true;
    await page.goto(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});const calculator=page.locator('.brand-actions a').filter({hasText:'계산'});assert.ok((await calculator.getAttribute('href'))?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));await calculator.click();await page.waitForURL(url=>url.pathname.endsWith('/tools/startup-cost/')&&url.searchParams.get('brand')==='mega-mgc-coffee',{waitUntil:'load'});const workspace=page.locator('[data-v36-startup]');await workspace.waitFor({state:'visible'});const selected=page.locator('[data-v36-brand]');assert.equal(await selected.inputValue(),'mega-mgc-coffee');assert.equal(await workspace.getAttribute('data-v36-default-cost'),'7847.4');item.calculatorPreservedBrand=true;item.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(item.horizontalOverflow,false);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);item.pass=true;
  }catch(e){item.error=e.message;item.pageErrors=errors;item.localFailures=failures;await page.screenshot({path:path.join(output,`${engine}-funnel-FAIL-${width}.png`),animations:'disabled',fullPage:true}).catch(()=>{})}
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

async function runReuseSample(slug,width=390){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);const item={slug,width,pass:false},errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{const response=await page.goto(new URL(`brands/${slug}/`,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);const state=await inspectBrandDecision(page);assertDecisionState(state,width,{expectHistory:state.yearCount>=2});assert.deepEqual(errors,[]);item.h1=(await page.locator('main h1').textContent()).trim();item.dominantShare=Number(state.dominantShare);item.historyYears=state.yearCount;item.pass=true;}catch(e){item.error=e.message;item.pageErrors=errors;await page.screenshot({path:path.join(output,`${engine}-reuse-FAIL-${slug}.png`),animations:'disabled',fullPage:true}).catch(()=>{})}reuseCases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const width of[390,1440])await run(width);for(const slug of['bhc-chicken','baskin-robbins','bonjuk-bibimbap'])await runReuseSample(slug)}finally{const report={engine,browserVersion:browser?.version()||null,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,reuseTotal:reuseCases.length,reusePassed:reuseCases.filter(c=>c.pass).length,reuseFailed:reuseCases.filter(c=>!c.pass).length,pass:cases.length===2&&cases.every(c=>c.pass)&&reuseCases.length===3&&reuseCases.every(c=>c.pass),cases,reuseCases,productionDeploy:false,indexPolicyChanged:false,scope:'Real loopback user funnel plus cross-category detail reuse, including store-history summaries, year cards, raw data and scrollable history table.'};await browser?.close();fs.writeFileSync(path.join(output,'conversion-funnel.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined,reuseCases:undefined}));if(!report.pass)process.exitCode=1}

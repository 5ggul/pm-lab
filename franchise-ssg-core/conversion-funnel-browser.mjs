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
const cases=[];
const reuseCases=[];
let browser;

async function inspectBrandDecision(page,width){
  await page.waitForFunction(()=>document.body.classList.contains('v52-brand-decision'));
  return page.evaluate(()=>{
    const kpis=[...document.querySelectorAll('.v35-kpis > div')];
    const mobile=document.querySelector('[data-v52-mobile-actions]');
    const topActions=[...document.querySelectorAll('.brand-actions [data-v52-action]')];
    const boxes=kpis.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,text:el.textContent.trim()};});
    const mobileStyle=mobile?getComputedStyle(mobile):null;
    const dominant=document.querySelector('.v35-comp-row.v52-dominant-cost');
    const benchmark=document.querySelector('.v52-benchmark-cards');
    const checks=document.querySelector('.v52-cost-checks .v49-check-list');
    return {
      kpiCount:kpis.length,kpiBoxes:boxes,
      mobileDisplay:mobileStyle?.display||null,
      mobileLabels:mobile?[...mobile.querySelectorAll('a')].map(a=>a.textContent.trim()):[],
      mobileHrefs:mobile?[...mobile.querySelectorAll('a')].map(a=>a.getAttribute('href')):[],
      topLabels:topActions.map(a=>a.textContent.trim()),
      bodyClass:document.body.classList.contains('v52-brand-decision'),
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      dominantText:dominant?.textContent.trim()||'',dominantShare:dominant?.dataset.v35Share||null,
      checkCount:checks?.children.length||0,checkColumns:checks?getComputedStyle(checks).gridTemplateColumns:'',
      benchmarkDisplay:benchmark?getComputedStyle(benchmark).display:null,
      benchmarkOverflow:benchmark?getComputedStyle(benchmark).overflowX:null,
      benchmarkCount:benchmark?.children.length||0
    };
  });
}

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={width,pass:false},errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===base.origin)failures.push({url:r.url(),status:r.status()});});
  try{
    let response=await page.goto(new URL('brands/',base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    const search=page.locator('#directorySearch');await search.fill('메가MGC커피');
    await page.waitForFunction(()=>document.querySelectorAll('#directoryTable tbody tr:not([hidden])').length===1);
    const result=page.locator('#directoryTable tbody tr:not([hidden]) a').first();
    assert.equal((await result.textContent()).trim(),'메가MGC커피');
    item.searchUrl=new URL(page.url()).searchParams.get('q');assert.equal(item.searchUrl,'메가MGC커피');
    await result.click();
    await page.waitForURL(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});
    assert.equal((await page.locator('main h1').textContent()).trim(),'메가MGC커피');
    const detailState=await inspectBrandDecision(page,width);item.detailReached=true;
    assert.equal(detailState.bodyClass,true);assert.equal(detailState.kpiCount,5);
    assert.deepEqual(detailState.topLabels,['비용 계산','브랜드 비교']);assert.equal(detailState.overflow,false);
    assert.ok(detailState.dominantText.includes('기타'));assert.ok(Number(detailState.dominantShare)>70);
    assert.equal(detailState.checkCount,3);assert.ok(detailState.benchmarkCount>=4);
    if(width===390){
      assert.equal(detailState.mobileDisplay,'grid');assert.deepEqual(detailState.mobileLabels,['비용 계산','브랜드 비교']);
      assert.ok(detailState.mobileHrefs[0]?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));
      assert.ok(detailState.mobileHrefs[1]?.includes('/compare/?a=mega-mgc-coffee'));
      const fourth=detailState.kpiBoxes[3],fifth=detailState.kpiBoxes[4];
      assert.ok(Math.abs(fourth.top-fifth.top)<=2,'last two KPIs must share the same mobile row');
      assert.ok(Math.abs(fourth.width-fifth.width)<=2,'last two KPIs must use balanced columns');
      assert.equal(detailState.benchmarkDisplay,'flex');assert.equal(detailState.benchmarkOverflow,'auto');
      assert.equal(detailState.checkColumns.split(' ').length,1);
    }else{
      assert.equal(detailState.mobileDisplay,'none');assert.equal(detailState.benchmarkDisplay,'grid');
      assert.ok(detailState.checkColumns.split(' ').length>=3);
    }
    item.brandDecisionLayout=true;item.costDecisionLayout=true;
    if(width===390)await page.screenshot({path:path.join(output,`${engine}-funnel-detail-${width}.png`),animations:'disabled',fullPage:true});

    const compareHref=await page.locator('.brand-actions a').filter({hasText:'비교'}).getAttribute('href');
    assert.ok(compareHref?.includes('/compare/?a=mega-mgc-coffee'));
    await page.locator('.brand-actions a').filter({hasText:'비교'}).click();
    await page.waitForURL(url=>url.pathname.endsWith('/compare/')&&url.searchParams.get('a')==='mega-mgc-coffee',{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('[data-v34-pick]')?.value==='mega-mgc-coffee');
    assert.ok((await page.locator('[data-v49-compare-chips]').textContent()).includes('메가MGC커피'));item.comparePreservedBrand=true;
    if(width===1440)await page.screenshot({path:path.join(output,`${engine}-funnel-compare-${width}.png`),animations:'disabled'});

    await page.goto(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});
    const calculator=page.locator('.brand-actions a').filter({hasText:'계산'});
    assert.ok((await calculator.getAttribute('href'))?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));
    await calculator.click();
    await page.waitForURL(url=>url.pathname.endsWith('/tools/startup-cost/')&&url.searchParams.get('brand')==='mega-mgc-coffee',{waitUntil:'load'});
    const workspace=page.locator('[data-v36-startup]');await workspace.waitFor({state:'visible'});
    const selected=page.locator('[data-v36-brand]');assert.equal(await selected.inputValue(),'mega-mgc-coffee');
    assert.ok((await selected.locator('option:checked').textContent()).includes('메가MGC커피'));
    assert.equal(await workspace.getAttribute('data-v36-default'),'mega-mgc-coffee');assert.equal(await workspace.getAttribute('data-v36-default-cost'),'7847.4');
    await page.waitForFunction(()=>document.querySelector('[data-v49-startup-public]')?.textContent?.includes('7,847')||document.querySelector('[data-v46-public]')?.textContent?.includes('7,847'));
    const publicSummary=((await page.locator('[data-v49-startup-public]').textContent().catch(()=>''))||(await page.locator('[data-v46-public]').textContent().catch(()=>''))).trim();assert.ok(publicSummary.includes('7,847'));
    const totalSummary=((await page.locator('[data-v49-startup-total]').textContent().catch(()=>''))||(await page.locator('[data-v46-total]').textContent().catch(()=>''))).trim();assert.ok(totalSummary.includes('7,847'));
    item.calculatorPreservedBrand=true;item.publicCost='7847.4';item.publicSummary=publicSummary;item.totalSummary=totalSummary;
    item.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(item.horizontalOverflow,false);
    if(width===390)await page.screenshot({path:path.join(output,`${engine}-funnel-calculator-${width}.png`),animations:'disabled'});
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);item.pass=true;
  }catch(e){item.error=e.message;item.pageErrors=errors;item.localFailures=failures;await page.screenshot({path:path.join(output,`${engine}-funnel-FAIL-${width}.png`),animations:'disabled',fullPage:true}).catch(()=>{});}
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

async function runReuseSample(slug,width=390){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={slug,width,pass:false},errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const response=await page.goto(new URL(`brands/${slug}/`,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    const state=await inspectBrandDecision(page,width);
    assert.equal(state.bodyClass,true);assert.equal(state.kpiCount,5);assert.equal(state.checkCount,3);assert.ok(state.benchmarkCount>=4);
    assert.ok(Number(state.dominantShare)>0);assert.equal(state.overflow,false);
    assert.equal(state.mobileDisplay,'grid');assert.equal(state.benchmarkDisplay,'flex');assert.equal(state.benchmarkOverflow,'auto');
    assert.deepEqual(state.mobileLabels,['비용 계산','브랜드 비교']);assert.deepEqual(errors,[]);
    item.h1=(await page.locator('main h1').textContent()).trim();item.dominantShare=Number(state.dominantShare);item.pass=true;
  }catch(e){item.error=e.message;item.pageErrors=errors;await page.screenshot({path:path.join(output,`${engine}-reuse-FAIL-${slug}.png`),animations:'disabled',fullPage:true}).catch(()=>{});}
  reuseCases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{
  browser=await tooling[engine].launch({headless:true});
  for(const width of [390,1440])await run(width);
  for(const slug of ['bhc-chicken','baskin-robbins','bonjuk-bibimbap'])await runReuseSample(slug);
}finally{
  const report={engine,browserVersion:browser?.version()||null,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,reuseTotal:reuseCases.length,reusePassed:reuseCases.filter(c=>c.pass).length,reuseFailed:reuseCases.filter(c=>!c.pass).length,pass:cases.length===2&&cases.every(c=>c.pass)&&reuseCases.length===3&&reuseCases.every(c=>c.pass),cases,reuseCases,productionDeploy:false,indexPolicyChanged:false,scope:'Real loopback user funnel plus cross-category brand detail reuse: KPI/cost/check/benchmark decision UX.'};
  await browser?.close();fs.writeFileSync(path.join(output,'conversion-funnel.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined,reuseCases:undefined}));if(!report.pass)process.exitCode=1;
}

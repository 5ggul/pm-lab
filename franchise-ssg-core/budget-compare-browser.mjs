import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/budget-compare');fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const pick='[data-v52-budget-pick]';
const selected=page=>page.locator(pick+':checked').evaluateAll(xs=>xs.map(x=>x.dataset.v52BudgetPick));
const state=page=>page.evaluate(()=>({count:document.querySelector('[data-v52-budget-count]').textContent,chips:[...document.querySelectorAll('[data-v52-budget-remove]')].map(x=>x.dataset.v52BudgetRemove),overflow:document.documentElement.scrollWidth>innerWidth+1,params:Object.fromEntries(new URLSearchParams(location.search)),visible:[...document.querySelectorAll('[data-budget-row]:not([hidden])')].map(x=>({cat:x.dataset.cat,cost:Number(x.dataset.cost)})),dock:(()=>{const r=document.querySelector('[data-v52-budget-compare]').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()}));
async function open(page,query='?budget=10000&cat=cafe'){
  const response=await page.goto(new URL('explore/'+query,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
  await page.locator('section[data-v52-budget-compare]').waitFor();
}
async function run(name,width,fn,{blockedStorage=false,reducedMotion='reduce'}={}){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion});
  if(blockedStorage)await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Disabled for QA','SecurityError')}}));
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).origin===base.origin&&r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  const item={name,width,pass:false};
  try{item.evidence=await fn(page);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);item.pass=true;}
  catch(e){item.error=e.stack||e.message;await page.screenshot({path:path.join(output,`${engine}-budget-FAIL-${name}-${width}.png`)}).catch(()=>{});}
  item.pageErrors=errors;item.localFailures=failures;cases.push(item);console.log(JSON.stringify(item));await context.close();
}
async function journey(page,width){
  await open(page);
  const original=await page.locator('[data-budget-row]').evaluateAll(rows=>rows.map(r=>({...r.dataset})).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);
  const wanted=await inputs.evaluateAll(xs=>xs.slice(0,2).map(x=>x.dataset.v52BudgetPick));assert.equal(wanted.length,2);
  await inputs.nth(0).focus();await inputs.nth(0).press('Space');
  assert.deepEqual(await selected(page),[wanted[0]]);assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  await inputs.nth(1).check();assert.deepEqual((await selected(page)).sort(),[...wanted].sort());
  assert.equal(await inputs.nth(2).isDisabled(),true);
  assert.equal(await page.locator('[data-v52-budget-submit]').isEnabled(),true);
  const before=await state(page);assert.deepEqual(before.chips,wanted);assert.equal(before.overflow,false);
  if(width<=760){assert.ok(before.dock.left>=0&&before.dock.right<=width+1);assert.ok(before.dock.top>=0&&before.dock.bottom<=901);}
  await page.screenshot({path:path.join(output,`${engine}-budget-two-${width}.png`)});
  await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();
  assert.deepEqual((await state(page)).chips,wanted);
  assert.deepEqual((await state(page)).params,{budget:'10000',cat:'cafe'});
  // Compare must hydrate exactly the selected pair, not the page's default brands.
  await page.locator('[data-v52-budget-submit]').click();await page.waitForURL('**/compare/?**');
  await page.waitForFunction(expected=>{const vals=[...document.querySelectorAll('[data-v34-pick]')].map(x=>x.value).filter(Boolean);return JSON.stringify(vals)===JSON.stringify(expected);},wanted);
  const params=Object.fromEntries(new URL(page.url()).searchParams);assert.equal(params.a,wanted[0]);assert.equal(params.b,wanted[1]);
  const compared=await page.locator('[data-v34-pick]').evaluateAll(xs=>xs.map(x=>x.value).filter(Boolean));assert.deepEqual(compared,wanted);
  // Browser history and same-tab persistence must work together.
  await page.goBack({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();
  assert.deepEqual((await state(page)).chips,wanted);
  assert.equal(await page.locator('[data-budget-form] [name=cat]').inputValue(),'cafe');
  await page.locator('[data-v52-budget-remove]').first().click();assert.equal((await selected(page)).length,1);
  assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  await page.locator('[data-v52-budget-clear]').click();assert.deepEqual(await selected(page),[]);
  assert.equal(await page.locator('[data-v52-budget-remove]').count(),0);
  const after=await page.locator('[data-budget-row]').evaluateAll(rows=>rows.map(r=>({...r.dataset})).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.deepEqual(after,original);
  return{wanted,compared,keyboard:true,limit:true,reload:true,historyBack:true,remove:true,clear:true,officialRowDataUnchanged:true,initialState:before};
}
try{
  browser=await tooling[engine].launch({headless:true});
  for(const width of [360,390,768,1440])await run('pair-journey',width,p=>journey(p,width));
  await run('filter-pruning',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    const saved=(await state(page)).chips;
    await page.locator('[data-budget-form] [name=sort]').selectOption('stores');assert.deepEqual((await state(page)).chips,saved);
    await page.locator('[data-budget-form] [name=cat]').selectOption('chicken');assert.deepEqual(await selected(page),[]);
    assert.match(await page.locator('[data-v52-budget-status]').textContent(),/조건에서 제외/);
    await page.locator('[data-budget-form] [name=cat]').selectOption('cafe');
    assert.deepEqual(await selected(page),[]);await page.locator('[data-budget-row]:not([hidden]) '+pick).first().check();
    await page.locator('[data-budget-form] [name=stores]').fill('9999999');assert.deepEqual(await selected(page),[]);
    assert.equal(await page.locator('[data-budget-row]:not([hidden])').count(),0);assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
    await page.screenshot({path:path.join(output,`${engine}-budget-empty-390.png`)});
    await page.locator('[data-budget-reset]').click();assert.deepEqual(await selected(page),[]);
    assert.equal(await page.locator('[data-budget-form] [name=budget]').inputValue(),'10000');assert.equal(await page.locator('[data-budget-form] [name=cat]').inputValue(),'');
    return{sortRetainsSelection:true,categoryPrunes:true,zeroResultsClears:true,resetClears:true,overflow:(await state(page)).overflow};
  });
  await run('preset-pruning',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    await page.locator('[data-budget="5000"]').click();assert.equal(await page.locator('[data-budget-form] [name=budget]').inputValue(),'5000');
    assert.equal(await page.locator('[data-budget-row][hidden] '+pick+':checked').count(),0);
    const result=await state(page);assert.ok(result.visible.every(r=>r.cost<=5000));assert.equal(result.overflow,false);return result;
  });
  await run('storage-disabled',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    assert.equal(await page.locator('[data-v52-budget-submit]').isEnabled(),true);return{memorySelectionWorks:true,selected:(await state(page)).chips};
  },{blockedStorage:true});
  await run('motion-restoration',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    const wanted=(await state(page)).chips;
    await page.reload({waitUntil:'load'});await page.evaluate(()=>scrollTo(0,0));
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]')?.parentElement===document.body);
    const dock=await state(page);assert.deepEqual(dock.chips,wanted);assert.ok(dock.dock.top>=0&&dock.dock.bottom<=901);
    assert.equal(await page.locator('[data-v52-budget-compare]').evaluate(el=>{for(let p=el;p;p=p.parentElement)if(getComputedStyle(p).opacity==='0')return false;return true;}),true);
    await page.screenshot({path:path.join(output,`${engine}-budget-motion-restored-390.png`)});
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]').parentElement.classList.contains('v52-budget-dock-space'));
    await page.setViewportSize({width:390,height:640});
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]').parentElement===document.body);
    const short=await state(page);assert.ok(short.dock.top>=0&&short.dock.bottom<=641);assert.equal(short.overflow,false);
    await page.locator('[data-v52-budget-submit]').click();await page.waitForURL('**/compare/?**');
    await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('[data-v34-pick]')].map(x=>x.value).filter(Boolean))===JSON.stringify(expected),wanted);
    return{motionEnabled:true,restoredDockVisibleAtPageTop:true,desktopMobileResize:true,shortViewport:true,comparePairPreserved:true};
  },{reducedMotion:'no-preference'});
  await run('untrusted-saved-state',390,async page=>{
    await open(page);await page.evaluate(()=>sessionStorage.setItem('v11.52:budget-compare:'+location.pathname,JSON.stringify(['not-a-brand','<img src=x onerror=alert(1)>',null,{},'not-a-brand'])));
    await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();assert.deepEqual(await selected(page),[]);
    await page.evaluate(()=>sessionStorage.setItem('v11.52:budget-compare:'+location.pathname,'{invalid-json'));
    await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();assert.deepEqual(await selected(page),[]);return{invalidSlugsIgnored:true,invalidJSONSafe:true};
  });
}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===9&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,scope:'Loopback Playwright engine/viewport testing; not a physical-device or Safari-app certification.'};
  fs.writeFileSync(path.join(output,'budget-compare.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

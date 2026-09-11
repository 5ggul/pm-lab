const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const release=JSON.parse(fs.readFileSync(path.join(ROOT,'data','release-url-set-v19.json'),'utf8'));
const artifactDir=path.resolve('artifacts/v19-browser');
fs.mkdirSync(artifactDir,{recursive:true});
const route=p=>p==='index.html'?'':p.replace(/index\.html$/,'');
const url=p=>`${BASE}/${route(p)}`;
const saveAudit=(name,results,issues)=>fs.writeFileSync(path.join(artifactDir,`${name}-audit.json`),JSON.stringify({version:'19.0.0',release_count:release.urls.length,viewport:name,checked:results.length,results,issues},null,2));

async function auditViewport(browser,vp){
  const issues=[];const results=[];
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    for(const item of release.urls){
      const errors=[];
      const onPageError=e=>errors.push(`pageerror:${e.message}`);
      const onConsole=m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)};
      page.on('pageerror',onPageError);page.on('console',onConsole);
      let status=0;let metrics={overflow:false,h1:0,main:false,skip:false,ready:false,smallControls:[]};
      try{
        const response=await page.goto(url(item.path),{waitUntil:'domcontentloaded',timeout:7000});
        status=response?.status()||0;
        await page.waitForTimeout(60);
        metrics=await page.evaluate(()=>{
          const controls=[...document.querySelectorAll('button,input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]),select,textarea')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0});
          const small=controls.filter(el=>el.getBoundingClientRect().height<36).map(el=>({tag:el.tagName,h:Math.round(el.getBoundingClientRect().height),name:el.getAttribute('name')||el.getAttribute('data-vendor')||el.textContent?.trim().slice(0,30)||''}));
          return {overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,main:Boolean(document.querySelector('main#main-content')),skip:Boolean(document.querySelector('a[href="#main-content"]')),ready:document.body?.dataset?.v19Ready==='1',smallControls:small};
        });
        if(status>=400||status===0)issues.push({viewport:vp.name,path:item.path,type:'http',status});
        if(metrics.overflow)issues.push({viewport:vp.name,path:item.path,type:'horizontal-overflow'});
        if(metrics.h1!==1)issues.push({viewport:vp.name,path:item.path,type:'h1-count',value:metrics.h1});
        if(!metrics.main||!metrics.skip||!metrics.ready)issues.push({viewport:vp.name,path:item.path,type:'landmark',metrics});
        if(vp.name==='mobile'&&metrics.smallControls.length)issues.push({viewport:vp.name,path:item.path,type:'small-controls',items:metrics.smallControls.slice(0,12)});
        if(errors.length)issues.push({viewport:vp.name,path:item.path,type:'runtime-errors',errors:errors.slice(0,12)});
      }catch(error){
        issues.push({viewport:vp.name,path:item.path,type:'exception',message:error.message});
      }
      results.push({viewport:vp.name,path:item.path,status,...metrics,errors});
      saveAudit(vp.name,results,issues);
      page.off('pageerror',onPageError);page.off('console',onConsole);
    }
  }finally{
    saveAudit(vp.name,results,issues);
    await context.close().catch(()=>{});
  }
  return {results,issues};
}

test('65 mobile release candidates render without runtime or viewport errors',async({browser})=>{
  test.setTimeout(240000);
  const out=await auditViewport(browser,{name:'mobile',width:390,height:844});
  expect(out.results).toHaveLength(65);
  expect(out.issues,JSON.stringify(out.issues.slice(0,30),null,2)).toEqual([]);
});

test('65 desktop release candidates render without runtime or viewport errors',async({browser})=>{
  test.setTimeout(240000);
  const out=await auditViewport(browser,{name:'desktop',width:1440,height:900});
  expect(out.results).toHaveLength(65);
  expect(out.issues,JSON.stringify(out.issues.slice(0,30),null,2)).toEqual([]);
});

test('core tools update live state from real user input',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});

  await page.goto(url('calculator/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
  const budgetRow=page.locator('[data-budget-row="demolition"]');
  await budgetRow.locator('[data-qty]').fill('2');
  await budgetRow.locator('[data-unit-price]').fill('100');
  await expect(page.locator('[data-budget-total]')).toContainText('200');
  await expect(page.locator('[data-v19-budget-filled]')).toContainText('1 /');

  await page.goto(url('quote-compare/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
  const first=page.locator('[data-compare-row]').first();
  for(const [vendor,amount] of [['a','100'],['b','120'],['c','90']]){
    await first.locator(`select[data-vendor="${vendor}"][data-state]`).selectOption('included');
    await first.locator(`input[data-vendor="${vendor}"][data-amount]`).fill(amount);
  }
  await expect(page.locator('[data-total="a"]')).toContainText('100');
  await expect(page.locator('[data-total="b"]')).toContainText('120');
  await expect(page.locator('[data-total="c"]')).toContainText('90');
  await expect(page.locator('[data-v19-compare-amounts]')).toHaveText('3');

  await page.goto(url('quote-check/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
  await page.locator('input[name="state-demolition"][value="included"]').check();
  await page.locator('[data-qrow="demolition"] [data-q-amount]').fill('80');
  await expect(page.locator('[data-v19-quote-done]')).toContainText('1 /');

  await page.goto(url('checklist/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
  const firstCheck=page.locator('input[data-check-id]').first();
  await firstCheck.check();
  await expect(page.locator('[data-v19-check-done]')).toContainText('1 /');

  await page.goto(url('quote-paste/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
  await page.locator('[data-v10-paste]').fill('욕실 2개 860만원\n도배 310만원');
  await page.locator('[data-v10-run]').click();
  await expect(page.locator('[data-v10-matched]')).not.toHaveText('0줄');
  await expect(page.locator('[data-v19-paste-match]')).not.toHaveText('0줄');
  fs.writeFileSync(path.join(artifactDir,'interaction-audit.json'),JSON.stringify({version:'19.0.0',passed:true,tools:['calculator','quote-compare','quote-check','checklist','quote-paste']},null,2));
});

test('representative mobile and desktop screenshots are captured',async({browser})=>{
  test.setTimeout(90000);
  const shots=[
    {path:'index.html',name:'mobile-home.png',viewport:{width:390,height:844}},
    {path:'calculator/index.html',name:'mobile-calculator.png',viewport:{width:390,height:844}},
    {path:'quote-compare/index.html',name:'mobile-quote-compare.png',viewport:{width:390,height:844}},
    {path:'index.html',name:'desktop-home.png',viewport:{width:1440,height:900}}
  ];
  for(const shot of shots){
    const context=await browser.newContext({viewport:shot.viewport,deviceScaleFactor:1});const page=await context.newPage();
    await page.goto(url(shot.path),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body?.dataset?.v19Ready==='1',null,{timeout:2500});
    await page.screenshot({path:path.join(artifactDir,shot.name),fullPage:true});await context.close();
  }
  for(const shot of shots)expect(fs.existsSync(path.join(artifactDir,shot.name))).toBeTruthy();
});

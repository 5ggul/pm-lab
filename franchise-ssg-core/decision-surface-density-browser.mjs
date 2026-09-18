import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/decision-surface-density');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const url=route=>new URL(route.replace(/^\//,''),base).href;

async function compactGrid(page,selector,cardSelector,width,{desktopMax=125,mobileMax=90}={}){
  const section=page.locator(selector);await section.waitFor();
  const cards=section.locator(cardSelector);assert.equal(await cards.count(),4);
  const grid=section.locator(cardSelector.includes('home')?'.v52-home-start-grid':cardSelector.includes('tools')?'.v52-tools-start-grid':'.v52-discovery-cards');
  const style=await grid.evaluate(el=>({display:getComputedStyle(el).display,overflowX:getComputedStyle(el).overflowX,cols:getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length}));
  assert.equal(style.display,'grid');
  assert.equal(style.cols,width<=760?1:width<=980?2:4);
  const heights=await cards.evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().height));
  assert.ok(heights.every(h=>h>=36&&h<=(width<=760?mobileMax:desktopMax)),`${selector} heights ${heights}`);
  if(width<=760){
    assert.notEqual(style.overflowX,'auto');
    const rects=await cards.evaluateAll(xs=>xs.map(x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right})));
    assert.ok(rects.every(r=>r.left>=-1&&r.right<=width+1));
  }
  const radius=await section.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius)||0);assert.ok(radius<=2,`${selector} radius ${radius}`);
}

async function run(width){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,pass:false};
  try{
    let response=await page.goto(base.href,{waitUntil:'load'});assert.equal(response?.status(),200);
    await compactGrid(page,'[data-v52-home-start="1"]','[data-v52-home-start-card]',width,{desktopMax:120,mobileMax:82});
    const homeText=await page.locator('[data-v52-home-start="1"]').innerText();assert.ok(homeText.includes('탐색 기준'));assert.ok(!homeText.includes('START HERE'));
    if(width===390)await page.locator('[data-v52-home-start="1"]').screenshot({path:path.join(output,`${engine}-compact-home-${width}.png`)});

    response=await page.goto(url('tools/'),{waitUntil:'load'});assert.equal(response?.status(),200);
    await compactGrid(page,'[data-v52-tools-start="1"]','[data-v52-tools-start-card]',width,{desktopMax:120,mobileMax:82});

    for(const kind of ['brands','categories','explore']){
      response=await page.goto(url(kind+'/'),{waitUntil:'load'});assert.equal(response?.status(),200);
      await compactGrid(page,`[data-v52-discovery-rail="${kind}"]`,'.v52-discovery-card',width,{desktopMax:115,mobileMax:78});
      const text=await page.locator(`[data-v52-discovery-rail="${kind}"]`).innerText();
      for(const banned of ['STEP 1','STEP 2','STEP 3','STEP 4'])assert.ok(!text.includes(banned),`${kind}: ${banned}`);
    }
    if(width===1440)await page.locator('[data-v52-discovery-rail="brands"]').screenshot({path:path.join(output,`${engine}-compact-brands-${width}.png`)});

    response=await page.goto(url('methodology/'),{waitUntil:'load'});assert.equal(response?.status(),200);
    const gate=page.locator('[data-v52-trust-gate="1"]');await gate.waitFor();const trustText=await gate.innerText();
    assert.ok(trustText.includes('데이터 검수 단계'));assert.ok(!trustText.includes('DATA GATE'));assert.ok(!trustText.includes('데이터 공개 게이트'));
    const trustRadius=await gate.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius)||0);assert.ok(trustRadius<=2);
    const trustItems=gate.locator('[data-v52-trust-gate-item]');assert.equal(await trustItems.count(),3);
    if(width<=900){const cols=await gate.locator('.v52-trust-gate-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);assert.equal(cols,1)}

    response=await page.goto(url('sources/'),{waitUntil:'load'});assert.equal(response?.status(),200);
    const op=page.locator('[data-v52-operator-evidence="1"]');await op.waitFor();const opText=await op.innerText();assert.ok(opText.includes('가맹본부 직접 확인'));assert.ok(!opText.includes('FIRST-PARTY COST EVIDENCE'));
    const opRadius=await op.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius)||0);assert.ok(opRadius<=2);

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
    item.pass=true;item.evidence={homeCompact:true,toolsCompact:true,discoveryCompact:['brands','categories','explore'],trustKoreanLabels:true,mobileStacked:width<=760,noHorizontalOverflow:true};
  }catch(error){item.error=error.stack||error.message;item.pageErrors=errors;await page.screenshot({path:path.join(output,`${engine}-decision-surface-FAIL-${width}.png`),fullPage:true}).catch(()=>{})}
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const width of [390,1440])await run(width)}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===2&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Compact Korean-first decision surfaces on home/tools/discovery/trust at 390 and 1440.'};
  fs.writeFileSync(path.join(output,`decision-surface-density-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

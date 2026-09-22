import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/legacy-compare-decision');
fs.mkdirSync(output,{recursive:true});

const routes={
  'bhc-chicken-vs-bbq-chicken':{
    values:['9,003만원','9,079만원','2,228개','2,316개','52,972만원','50,879만원','-2.7%','정보 없음'],
    diffs:['두 값 차이 76만원','두 값 차이 88개','두 값 차이 2,093만원'],
    title:'bhc치킨 vs BBQ치킨',grammar:'bhc치킨과 BBQ치킨',badGrammar:'bhc치킨와 BBQ치킨',calculator:'brand=bhc-chicken'
  },
  'cu-vs-gs25':{
    values:['7,423만원','7,270만원','18,255개','17,989개','63,384만원','64,372만원','+3.9%','정보 없음'],
    diffs:['두 값 차이 153만원','두 값 차이 266개','두 값 차이 988만원'],
    title:'CU vs GS25',grammar:'CU와 GS25',badGrammar:null,calculator:'brand=cu'
  }
};
const widths=[390,768,1440],cases=[];let browser;

async function run(slug,width){
  const expected=routes[slug],context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={slug,width,pass:false};
  try{
    const response=await page.goto(new URL(`compare/${slug}/`,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    const decision=page.locator('section[data-v52-legacy-compare-decision="1"]');await decision.waitFor();
    assert.equal(await page.locator('body.v52-legacy-compare main[data-v52-legacy-compare="1"]').count(),1);
    assert.equal(await page.locator('[data-v34-workspace]').count(),0);
    assert.equal(await decision.locator('[data-v52-legacy-metric]').count(),4);
    const decisionText=await decision.innerText();
    for(const token of expected.values)assert.ok(decisionText.includes(token),`${slug}: ${token}`);
    for(const token of expected.diffs)assert.ok(decisionText.includes(token),`${slug}: ${token}`);
    assert.ok(decisionText.includes('공개값이 한쪽에만 있어 차이를 계산하지 않습니다.'));
    assert.equal(await decision.locator('[data-v52-legacy-missing="1"]').count(),1);
    const title=await page.title(),description=await page.locator('meta[name="description"]').getAttribute('content'),bodyText=await page.locator('body').innerText();
    assert.ok(title.includes(expected.title));assert.ok(description?.includes(expected.grammar));
    if(expected.badGrammar){assert.ok(!description?.includes(expected.badGrammar));assert.ok(!bodyText.includes(expected.badGrammar))}
    assert.equal(await page.locator('[data-v52-legacy-cost]').count(),1);assert.equal(await page.locator('[data-v52-legacy-trend]').count(),1);assert.equal(await page.locator('[data-v52-legacy-warning]').count(),1);assert.equal(await page.locator('[data-v52-legacy-source]').count(),1);
    assert.equal(await page.locator('[data-v52-legacy-chart-scroll]').count(),2);assert.equal(await page.locator('[data-v52-legacy-mobile-cards]').count(),1);assert.equal(await page.locator('[data-v52-legacy-actions]').count(),1);
    const actions=page.locator('[data-v52-legacy-actions] a');assert.equal(await actions.count(),2);assert.ok((await actions.first().getAttribute('href'))?.includes(expected.calculator));
    assert.ok(bodyText.includes('데이터 갱신 2026-09-12'));
    if(width<=760){
      const wrappers=page.locator('[data-v52-legacy-chart-scroll]');
      for(let i=0;i<await wrappers.count();i++){const wrap=wrappers.nth(i);assert.equal(await wrap.evaluate(el=>getComputedStyle(el).overflowX),'auto');const dims=await wrap.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(dims.scroll>dims.client,JSON.stringify(dims))}
      const cards=page.locator('[data-v52-legacy-mobile-cards]');assert.equal(await cards.evaluate(el=>getComputedStyle(el).display),'flex');assert.equal(await cards.evaluate(el=>getComputedStyle(el).overflowX),'auto');assert.ok((await cards.locator(':scope > article').count())>=8);
      const firstCard=cards.locator(':scope > article').first();assert.ok((await firstCard.evaluate(el=>el.getBoundingClientRect().width))<width);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
    assert.deepEqual(errors,[]);
    if(slug==='bhc-chicken-vs-bbq-chicken'&&(width===390||width===1440))await page.screenshot({path:path.join(output,`${engine}-legacy-compare-${width}.png`),fullPage:true});
    item.evidence={decisionMetrics:4,missingPreserved:true,legacyPages:2,overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-legacy-compare-FAIL-${slug}-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const slug of Object.keys(routes))for(const width of widths)await run(slug,width)}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===6&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Two legacy body comparison pages at 390/768/1440 with missing-value preservation and Korean particle repair.'};
  fs.writeFileSync(path.join(output,`legacy-compare-decision-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/home-decision');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,pass:false};
  try{
    const response=await page.goto(base.href,{waitUntil:'load'});assert.equal(response?.status(),200);
    const start=page.locator('[data-v52-home-start="1"]'),cards=start.locator('[data-v52-home-start-card]');await start.waitFor();
    assert.equal(await cards.count(),4);assert.equal(await page.locator('form[data-v25-search]').count(),1);assert.equal(await page.locator('script[data-v25-search-map]').count(),1);
    const headings=await page.locator('.v25-sec h2').allTextContents();assert.ok(headings.includes('업종별 창업비용'));assert.ok(headings.includes('예산'));
    const hrefs=await cards.evaluateAll(xs=>xs.map(x=>new URL(x.href).pathname));for(const suffix of ['/brands/','/explore/','/categories/','/compare/'])assert.ok(hrefs.some(x=>x.endsWith(suffix)),suffix);
    const targets=await cards.evaluateAll(xs=>xs.map(x=>({text:x.textContent.trim(),h:x.getBoundingClientRect().height})));assert.ok(targets.every(x=>x.h>=110));
    const grid=start.locator('.v52-home-start-grid');
    if(width<=760){assert.equal(await grid.evaluate(el=>getComputedStyle(el).display),'flex');assert.equal(await grid.evaluate(el=>getComputedStyle(el).overflowX),'auto');const w=await cards.first().evaluate(el=>el.getBoundingClientRect().width);assert.ok(w>=240&&w<width)}
    else{assert.equal(await grid.evaluate(el=>getComputedStyle(el).display),'grid');const cols=await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,width<=900?2:4)}
    const robots=await page.locator('meta[name="robots"]').getAttribute('content');assert.equal(robots,'noindex,nofollow,noarchive,nosnippet');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);assert.deepEqual(errors,[]);
    if(width===390||width===1440)await page.screenshot({path:path.join(output,`${engine}-home-decision-${width}.png`),fullPage:true});
    item.evidence={cards:4,searchPreserved:true,dataSections:['업종별 창업비용','예산'],layout:width<=760?'scroll':width<=900?'2-col':'4-col',overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-home-decision-FAIL-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}
try{browser=await tooling[engine].launch({headless:true});for(const width of [390,768,1440])await run(width)}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===3&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Task-first home entry at 390/768/1440 while preserving brand search, category/budget sections and preview noindex.'};
  fs.writeFileSync(path.join(output,`home-decision-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

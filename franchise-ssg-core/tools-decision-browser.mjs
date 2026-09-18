import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/tools-decision');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,pass:false};
  try{
    const response=await page.goto(new URL('tools/',base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    const start=page.locator('[data-v52-tools-start="1"]'),cards=start.locator('[data-v52-tools-start-card]'),faq=page.locator('[data-v52-tools-faq="1"]');
    await start.waitFor();assert.equal(await cards.count(),4);assert.equal(await faq.count(),1);assert.equal(await faq.locator('details').count(),4);
    assert.equal(await page.locator('.v25-toolset').first().locator(':scope > a').count(),8);
    assert.equal(await page.locator('.v25-toolset').nth(1).locator(':scope > a').count(),9);
    const hrefs=await cards.evaluateAll(xs=>xs.map(x=>new URL(x.href).pathname));
    for(const suffix of ['/tools/startup-cost/','/tools/monthly-profit-simulator/','/tools/brand-filter/','/tools/category-median/'])assert.ok(hrefs.some(x=>x.endsWith(suffix)),suffix);
    const jsonText=await page.locator('script[data-v52-tools-faq-jsonld]').textContent(),json=JSON.parse(jsonText);assert.equal(json['@type'],'FAQPage');assert.equal(json.mainEntity.length,4);
    const firstFaq=faq.locator('details').first(),summary=firstFaq.locator('summary');assert.ok((await summary.evaluate(el=>el.getBoundingClientRect().height))>=44);await summary.click();assert.equal(await firstFaq.getAttribute('open'),'');
    const robots=await page.locator('meta[name="robots"]').getAttribute('content');assert.equal(robots,'noindex,nofollow,noarchive,nosnippet');
    const grid=start.locator('.v52-tools-start-grid');const heights=await cards.evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=54&&h<=125));assert.equal(await grid.evaluate(el=>getComputedStyle(el).display),'grid');const cols=await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);assert.equal(cols,width<=760?1:width<=900?2:4);if(width<=760){assert.notEqual(await grid.evaluate(el=>getComputedStyle(el).overflowX),'auto');const rects=await cards.evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect()));assert.ok(rects.every(r=>r.left>=0&&r.right<=width+1))}
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);assert.deepEqual(errors,[]);
    if(width===390||width===1440)await page.screenshot({path:path.join(output,`${engine}-tools-decision-${width}.png`),fullPage:true});
    item.evidence={cards:4,faq:4,toolLinks:[8,9],layout:width<=760?'1-col':width<=900?'2-col':'4-col',overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-tools-decision-FAIL-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const width of [390,768,1440])await run(width)}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===3&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Task-first tools hub at 390/768/1440, including static FAQ JSON-LD, original tool-link preservation and responsive overflow.'};
  fs.writeFileSync(path.join(output,`tools-decision-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

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
let browser;

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
    item.detailReached=true;
    if(width===390)await page.screenshot({path:path.join(output,`${engine}-funnel-detail-${width}.png`),animations:'disabled'});

    const compareHref=await page.locator('.brand-actions a').filter({hasText:'비교'}).getAttribute('href');
    assert.ok(compareHref?.includes('/compare/?a=mega-mgc-coffee'));
    await page.locator('.brand-actions a').filter({hasText:'비교'}).click();
    await page.waitForURL(url=>url.pathname.endsWith('/compare/')&&url.searchParams.get('a')==='mega-mgc-coffee',{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('[data-v34-pick]')?.value==='mega-mgc-coffee');
    assert.ok((await page.locator('[data-v49-compare-chips]').textContent()).includes('메가MGC커피'));
    item.comparePreservedBrand=true;
    if(width===1440)await page.screenshot({path:path.join(output,`${engine}-funnel-compare-${width}.png`),animations:'disabled'});

    await page.goto(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});
    const calculator=page.locator('.brand-actions a').filter({hasText:'계산'});
    assert.ok((await calculator.getAttribute('href'))?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));
    await calculator.click();
    await page.waitForURL(url=>url.pathname.endsWith('/tools/startup-cost/')&&url.searchParams.get('brand')==='mega-mgc-coffee',{waitUntil:'load'});
    const selected=page.locator('form[data-tool="startup-cost-v10"] [name="brand"]');
    assert.equal(await selected.inputValue(),'mega-mgc-coffee');
    const publicCost=page.locator('form[data-tool="startup-cost-v10"] [name="publicCost"]');
    assert.equal(await publicCost.inputValue(),'7847.4');
    assert.equal((await page.locator('[data-startup-total]').textContent()).trim(),'7,847만원');
    assert.ok((await page.locator('[data-brand-basis]').textContent()).includes('2025'));
    item.calculatorPreservedBrand=true;
    item.publicCost='7847.4';
    item.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(item.horizontalOverflow,false);
    if(width===390)await page.screenshot({path:path.join(output,`${engine}-funnel-calculator-${width}.png`),animations:'disabled'});
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);item.pass=true;
  }catch(e){item.error=e.message;item.pageErrors=errors;item.localFailures=failures;await page.screenshot({path:path.join(output,`${engine}-funnel-FAIL-${width}.png`),animations:'disabled'}).catch(()=>{});}
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const width of [390,1440])await run(width);}finally{
  const report={engine,browserVersion:browser?.version()||null,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,pass:cases.length===2&&cases.every(c=>c.pass),cases,productionDeploy:false,indexPolicyChanged:false,scope:'Real loopback user funnel: directory search → brand detail → compare and startup-cost calculator branches.'};
  await browser?.close();fs.writeFileSync(path.join(output,'conversion-funnel.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

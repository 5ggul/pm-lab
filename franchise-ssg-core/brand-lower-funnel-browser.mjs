import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['chromium','webkit'].includes(engine));
assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-lower-funnel');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;

async function run(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={width,pass:false},errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const response=await page.goto(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    await page.waitForSelector('[data-v52-total-funnel]');
    const state=await page.evaluate(()=>{
      const panel=document.querySelector('[data-v52-total-funnel]');
      const cards=[...panel.querySelectorAll('.v52-total-funnel-card')];
      const link=panel.querySelector('[data-v52-total-calculator]');
      const style=getComputedStyle(panel);
      return {labels:cards.map(c=>c.querySelector('span')?.textContent.trim()),values:cards.map(c=>c.querySelector('strong')?.textContent.trim()),columns:style.gridTemplateColumns,href:link?.getAttribute('href'),buttonText:link?.textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.deepEqual(state.labels,['공정위 공개비용','본사 개설비','별도 확인']);
    assert.equal(state.values[0],'7,847만원');assert.equal(state.values[1],'74,235,500원');assert.equal(state.values[2],'3개 항목');
    assert.equal(state.buttonText,'총 준비자금 계산하기');assert.ok(state.href?.includes('/tools/startup-cost/?brand=mega-mgc-coffee'));assert.equal(state.overflow,false);
    if(width===390)assert.equal(state.columns.split(' ').length,1);else assert.ok(state.columns.split(' ').length>=3);
    await page.locator('[data-v52-total-calculator]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/tools/startup-cost/')&&url.searchParams.get('brand')==='mega-mgc-coffee',{waitUntil:'load'});
    await page.waitForSelector('[data-v36-startup]');
    assert.equal(await page.locator('[data-v36-brand]').inputValue(),'mega-mgc-coffee');
    assert.equal(await page.locator('[data-v36-startup]').getAttribute('data-v36-default-cost'),'7847.4');
    assert.deepEqual(errors,[]);item.pass=true;item.state=state;
    await page.screenshot({path:path.join(output,`${engine}-lower-funnel-${width}.png`),animations:'disabled',fullPage:true});
  }catch(error){item.error=error.message;item.pageErrors=errors;await page.screenshot({path:path.join(output,`${engine}-lower-funnel-FAIL-${width}.png`),animations:'disabled',fullPage:true}).catch(()=>{});}
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{browser=await tooling[engine].launch({headless:true});for(const width of [390,1440])await run(width);}finally{
  const report={engine,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,pass:cases.length===2&&cases.every(c=>c.pass),cases,productionDeploy:false,indexPolicyChanged:false};
  await browser?.close();fs.writeFileSync(path.join(output,`${engine}-lower-funnel.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

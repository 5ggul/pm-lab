import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/compare-decision');fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
async function run(name,width,fn){const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={name,width,pass:false};try{item.evidence=await fn(page);assert.deepEqual(errors,[]);item.pass=true}catch(e){item.error=e.stack||e.message;await page.screenshot({path:path.join(output,`${engine}-compare-decision-FAIL-${name}-${width}.png`)}).catch(()=>{})}cases.push(item);console.log(JSON.stringify(item));await context.close()}
async function scanEvidence(page,width){
  const cost=page.locator('[data-v52-compare-section="cost"] .v34-rings');
  const refs=page.locator('[data-v52-benchmark-reference]');
  const keys=page.locator('[data-v52-compare-section="sales"] .v34-benchmark-key');
  const diff=page.locator('[data-v52-compare-diff]');
  const firstDiff=diff.locator('.v34-diff th:first-child').first();
  assert.equal(await page.locator('[data-v52-compare-cost-cards]').count(),1);
  assert.equal(await refs.count(),2);
  assert.equal(await diff.count(),1);
  if(width<=760){
    assert.equal(await cost.evaluate(el=>getComputedStyle(el).display),'flex');
    assert.equal(await cost.evaluate(el=>getComputedStyle(el).overflowX),'auto');
    assert.equal(await refs.first().evaluate(el=>getComputedStyle(el).display),'flex');
    const refText=await refs.allInnerTexts();for(const text of refText){assert.ok(text.includes('업종 기준'));assert.ok(text.includes('전체 기준'))}
    assert.equal(await keys.first().evaluate(el=>getComputedStyle(el).display),'none');
    assert.equal(await diff.evaluate(el=>getComputedStyle(el).overflowX),'auto');
    assert.equal(await firstDiff.evaluate(el=>getComputedStyle(el).position),'sticky');
    const cardWidth=await page.locator('[data-v52-compare-section="cost"] .v34-ring-card').first().evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(cardWidth>=250&&cardWidth<width,`mobile cost card width ${cardWidth}`);
  }else{
    assert.equal(await cost.evaluate(el=>getComputedStyle(el).display),'grid');
    assert.equal(await refs.first().evaluate(el=>getComputedStyle(el).display),'none');
    assert.notEqual(await keys.first().evaluate(el=>getComputedStyle(el).display),'none');
    assert.notEqual(await firstDiff.evaluate(el=>getComputedStyle(el).position),'sticky');
  }
  return{costCards:await page.locator('[data-v52-compare-section="cost"] .v34-ring-card').count(),benchmarkReferences:await refs.count(),stickyDiff:width<=760};
}
async function verify(page,width){const url=new URL('compare/?a=mega-mgc-coffee&b=compose-coffee',base);const r=await page.goto(url.href,{waitUntil:'load'});assert.equal(r?.status(),200);await page.locator('[data-v52-compare-decision]').waitFor();const cards=page.locator('[data-v52-compare-metric]');assert.equal(await cards.count(),4);const text=await page.locator('[data-v52-compare-decision]').innerText();for(const token of ['메가MGC커피','컴포즈커피','7,847.4만원','8,348.2만원','3,325개','2,649개','38,844.3만원','27,188.3만원','+24%','+12.2%'])assert.ok(text.includes(token),token);const cost=page.locator('[data-v52-compare-metric="cost"]');assert.ok((await cost.innerText()).includes('낮은 값 기준 차이 500.8만원'));const stores=page.locator('[data-v52-compare-metric="stores"]');assert.ok((await stores.innerText()).includes('높은 값 기준 차이 676개'));const initialScan=await scanEvidence(page,width);const picks=page.locator('[data-v34-pick]');await picks.nth(1).selectOption('paiks-coffee');await page.waitForFunction(()=>document.querySelector('[data-v52-compare-decision]')?.textContent.includes('빽다방'));await page.waitForFunction(()=>document.querySelectorAll('[data-v52-benchmark-reference]').length===2);const changed=await page.locator('[data-v52-compare-decision]').innerText();assert.ok(changed.includes('7,687.2만원'));assert.ok(changed.includes('+18.2%'));assert.ok(!changed.includes('컴포즈커피'));const changedScan=await scanEvidence(page,width);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);if(width<=760){const display=await page.locator('[data-v52-compare-decision-grid]').evaluate(el=>getComputedStyle(el).display);assert.equal(display,'flex');const overflowX=await page.locator('[data-v52-compare-decision-grid]').evaluate(el=>getComputedStyle(el).overflowX);assert.equal(overflowX,'auto')}else{const display=await page.locator('[data-v52-compare-decision-grid]').evaluate(el=>getComputedStyle(el).display);assert.equal(display,'grid')}await page.screenshot({path:path.join(output,`${engine}-compare-decision-${width}.png`),fullPage:true});return{updatedSelection:true,metrics:4,overflow:false,initialScan,changedScan}}
try{browser=await tooling[engine].launch({headless:true});for(const width of [390,768,1440])await run('summary',width,p=>verify(p,width));}finally{await browser?.close();const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===3&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false};fs.writeFileSync(path.join(output,'compare-decision.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;}

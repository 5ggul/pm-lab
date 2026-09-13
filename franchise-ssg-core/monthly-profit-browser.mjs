import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Only a local preview may be tested');
assert.ok(process.env.SSG_QA_DEP_ROOT,'SSG_QA_DEP_ROOT is required');
const {chromium}=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const out=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-layout-containment');
fs.mkdirSync(out,{recursive:true});
const expected={revenue:'5000',materialRate:'30',platformRate:'5',royaltyRate:'5',labor:'1000',rent:'500',utilities:'200',other:'300'};
const cases=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function state(page){return page.evaluate(()=>({
  url:location.href,
  params:Object.fromEntries(new URLSearchParams(location.search)),
  values:Object.fromEntries([...document.querySelectorAll('form[data-tool="monthly-profit-v10"] input')].map(el=>[el.name,el.value])),
  balance:document.querySelector('[data-profit-balance]')?.textContent.trim(),
  variable:document.querySelector('[data-profit-variable]')?.textContent.trim(),
  fixed:document.querySelector('[data-profit-fixed]')?.textContent.trim(),
  breakEven:document.querySelector('[data-profit-breakeven]')?.textContent.trim(),
  overflow:document.documentElement.scrollWidth>innerWidth+1
}));}

function assertExpected(s){
  assert.deepEqual(s.values,expected);
  assert.deepEqual(s.params,expected);
  assert.equal(s.balance,'1,000만원');
  assert.equal(s.variable,'2,000만원');
  assert.equal(s.fixed,'2,000만원');
  assert.equal(s.breakEven,'3,333만원');
  assert.equal(s.overflow,false);
}

try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:980},reducedMotion:'reduce'});
    const item={name:'monthly-profit-origin-persistence',width,pass:false};
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      const response=await page.goto(new URL('tools/monthly-profit-simulator/',base).href,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      const form=page.locator('form[data-tool="monthly-profit-v10"]');await form.waitFor();
      for(const [name,value] of Object.entries(expected)) await form.locator(`input[name="${name}"]`).fill(value);
      await page.waitForTimeout(100);
      item.afterInput=await state(page);assertExpected(item.afterInput);
      const expectedUrl=page.url();
      await page.reload({waitUntil:'domcontentloaded'});await form.waitFor();await page.waitForTimeout(80);
      item.afterReload=await state(page);assertExpected(item.afterReload);
      assert.equal(page.url(),expectedUrl,'Reload changed the persisted query URL');
      assert.deepEqual(errors,[],'Uncaught browser errors');
      item.pass=true;
    }catch(error){item.error=String(error.message||error);item.browserErrors=errors;}
    item.screenshot=`monthly-profit-${width}.png`;
    await page.screenshot({path:path.join(out,item.screenshot),fullPage:true,animations:'disabled'});
    cases.push(item);console.log(JSON.stringify(item));await page.close();
  }
}finally{
  await browser.close();
  const report={kind:'monthly-profit-origin-persistence',generatedAt:new Date().toISOString(),pass:cases.length===2&&cases.every(c=>c.pass),total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,cases,productionDeploy:false};
  fs.writeFileSync(path.join(out,'monthly-profit-origin.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.pass)process.exitCode=1;
}

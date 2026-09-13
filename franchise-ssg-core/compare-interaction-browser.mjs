import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const base = new URL(process.env.SSG_QA_BASE_URL || 'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname), 'Only a local preview may be tested');
assert.ok(process.env.SSG_QA_DEP_ROOT, 'SSG_QA_DEP_ROOT is required');
const {chromium} = await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const out = path.resolve(process.env.SSG_QA_OUTPUT || 'artifacts/franchise-layout-containment');
fs.mkdirSync(out,{recursive:true});

const targets=['mega-mgc-coffee','compose-coffee','paiks-coffee','ediya-coffee'];
const expected=['메가MGC커피','컴포즈커피','빽다방','이디야커피'];
const cases=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function snapshotState(page){
  return page.evaluate(()=>{
    const selected=Array.from(document.querySelectorAll('[data-v34-pick]'),el=>({value:el.value,text:el.selectedOptions[0]?.textContent.trim()||''}));
    const chips=Array.from(document.querySelectorAll('[data-v49-compare-chips] button'),el=>el.textContent.replace('×','').trim());
    const pickers=Array.from(document.querySelectorAll('[data-v34-pick]'),el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};});
    const workspaceEl=document.querySelector('[data-v34-workspace]');
    const workspaceRect=workspaceEl?.getBoundingClientRect();
    return {
      workspaceCount:document.querySelector('[data-v34-count]')?.textContent.trim()||'',
      liveCount:document.querySelector('[data-v49-compare-count]')?.textContent.trim()||'',
      selected,
      chips,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
      workspace:workspaceRect?{left:workspaceRect.left,right:workspaceRect.right,width:workspaceRect.width,viewport:innerWidth}:null,
      pickers,
      pageErrors:window.__compareErrors||[]
    };
  });
}

async function selectFour(page){
  const picks=page.locator('[data-v34-pick]');
  assert.equal(await picks.count(),4,'Expected four comparison pickers');
  for(let i=0;i<4;i++) await picks.nth(i).selectOption(targets[i]);
  await page.waitForTimeout(120);
  const state=await snapshotState(page);
  assert.equal(state.workspaceCount,'4/4');
  assert.equal(state.liveCount,'4개');
  assert.deepEqual(state.selected.map(x=>x.value),targets);
  assert.deepEqual(state.chips,expected);
  assert.equal(state.horizontalOverflow,false,'Page has horizontal overflow');
  assert.ok(state.workspace && state.workspace.left>=-1 && state.workspace.right<=state.workspace.viewport+1,'Compare workspace clipped');
  assert.ok(state.pickers.every(r=>r.left>=-1&&r.right<=state.workspace.viewport+1),'Compare picker clipped');
  return state;
}

try{
  for(const width of [390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:980},reducedMotion:'reduce'});
    const item={name:'four-brand-compare',width,pass:false};
    const browserErrors=[];
    page.on('pageerror',e=>browserErrors.push(e.message));
    await page.addInitScript(()=>{window.__compareErrors=[];window.addEventListener('error',e=>window.__compareErrors.push(String(e.error?.message||e.message||e.error||'error')));});
    try{
      const response=await page.goto(new URL('compare/',base).href,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.locator('[data-v34-workspace]').waitFor();
      item.afterFour=await selectFour(page);
      assert.deepEqual(browserErrors,[],'Uncaught browser error while selecting four');

      const remove=page.locator('[data-v49-compare-chips] button').nth(2);
      await remove.click();
      await page.waitForTimeout(80);
      item.afterRemove=await snapshotState(page);
      assert.equal(item.afterRemove.workspaceCount,'3/4');
      assert.equal(item.afterRemove.liveCount,'3개');
      assert.equal(item.afterRemove.chips.length,3);
      assert.ok(!item.afterRemove.chips.includes('빽다방'));

      const clear=page.locator('[data-v49-compare-clear]');
      await clear.click();
      await page.waitForTimeout(80);
      item.afterClear=await snapshotState(page);
      assert.equal(item.afterClear.workspaceCount,'0/4');
      assert.equal(item.afterClear.liveCount,'0개');
      assert.deepEqual(item.afterClear.selected.map(x=>x.value),['','','','']);
      assert.equal(item.afterClear.chips.length,0);

      item.afterReselect=await selectFour(page);
      assert.deepEqual(browserErrors,[],'Uncaught browser errors');
      assert.deepEqual(item.afterReselect.pageErrors,[],'Window error event recorded');
      item.pass=true;
    }catch(error){item.error=String(error.message||error);item.browserErrors=browserErrors;}
    item.screenshot=`compare-four-brands-${width}.png`;
    await page.screenshot({path:path.join(out,item.screenshot),fullPage:true,animations:'disabled'});
    cases.push(item);
    console.log(JSON.stringify(item));
    await page.close();
  }
}finally{
  await browser.close();
  const report={kind:'four-brand-compare-browser-qa',generatedAt:new Date().toISOString(),pass:cases.length===3&&cases.every(c=>c.pass),total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,cases,productionDeploy:false};
  fs.writeFileSync(path.join(out,'compare-interactions.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.pass) process.exitCode=1;
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/retention-workspace');
assert.ok(['chromium','webkit'].includes(engine));assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
fs.mkdirSync(output,{recursive:true});
const browser=await tooling[engine].launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},locale:'ko-KR',reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(10000);
const cases=[];
async function run(name,fn){const item={name,pass:false};try{await fn();item.pass=true}catch(error){item.error=error.stack||error.message}cases.push(item);console.log(JSON.stringify(item))}
const url=p=>new URL(p,base).href;

try{
  await run('save brand and persist checklist',async()=>{
    await page.goto(url('brands/mega-mgc-coffee/'),{waitUntil:'load'});
    await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'load'});
    const save=page.locator('[data-v52-save-brand]');await save.click();
    assert.equal(await save.getAttribute('aria-pressed'),'true');
    let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabShortlistV1')||'[]'));
    assert.equal(state.length,1);assert.equal(state[0].slug,'mega-mgc-coffee');
    await page.locator('.v52-checklist summary').click();
    const check=page.locator('[data-v52-check="disclosure"]');await check.check();await page.reload({waitUntil:'load'});
    await page.locator('.v52-checklist summary').click();
    assert.equal(await page.locator('[data-v52-check="disclosure"]').isChecked(),true);
    assert.equal((await page.locator('[data-v52-check-progress]').textContent()).trim(),'1/6');
    const rec=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabRecentV1')||'[]'));assert.equal(rec[0],'mega-mgc-coffee');
    assert.ok((await page.locator('[data-v52-brand-workspace]').boundingBox()).width>100);
  });
  await run('home restores saved and recent brands',async()=>{
    await page.goto(url(''),{waitUntil:'load'});
    assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('메가MGC커피'));
    assert.ok((await page.locator('[data-v52-recent-list]').innerText()).includes('메가MGC커피'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await run('second saved brand loads into compare workspace',async()=>{
    await page.goto(url('brands/compose-coffee/'),{waitUntil:'load'});
    await page.locator('[data-v52-save-brand]').click();
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabShortlistV1')||'[]'));
    assert.deepEqual(state.slice(0,2).map(x=>x.slug),['compose-coffee','mega-mgc-coffee']);
    await page.goto(url('compare/'),{waitUntil:'load'});
    const load=page.locator('[data-v52-load-saved]');assert.equal(await load.isDisabled(),false);await load.click();await page.waitForTimeout(400);
    const values=await page.locator('select[data-v34-pick]').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.deepEqual(values.slice(0,2),['compose-coffee','mega-mgc-coffee']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await run('saved baseline detects later snapshot and metric change',async()=>{
    await page.evaluate(()=>{
      const list=JSON.parse(localStorage.getItem('franchiseLabShortlistV1')||'[]');
      const mega=list.find(x=>x.slug==='mega-mgc-coffee');mega.snapshotId='older-snapshot';mega.metrics.stores=3225;
      localStorage.setItem('franchiseLabShortlistV1',JSON.stringify(list));
    });
    await page.goto(url(''),{waitUntil:'load'});
    const alert=page.locator('[data-v52-retention-alert]');assert.equal(await alert.isVisible(),true);
    const savedText=await page.locator('[data-v52-saved-list]').innerText();assert.ok(savedText.includes('가맹점 +100개'));
    await page.goto(url('updates/'),{waitUntil:'load'});
    assert.equal(await page.locator('.v52-change-radar-row').count(),12);
    assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('가맹점 +100개'));
  });
  await run('methodology explains added publisher value',async()=>{
    await page.goto(url('methodology/'),{waitUntil:'load'});
    const section=page.locator('[data-v52-publisher-value="1"]');assert.equal(await section.count(),1);
    const text=await section.innerText();
    for(const token of ['원천 공개데이터에 더하는 것','업종 분포 계산','저장 후 변화 확인','페이지가 만들어지고 검수되는 방식'])assert.ok(text.includes(token));
    assert.ok((await section.locator('.check-item').count())>=6);
  });
  await page.screenshot({path:path.join(output,`${engine}-retention-workspace-390.png`),animations:'disabled',fullPage:true});
}finally{
  await context.close();await browser.close();
  const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===5&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  fs.writeFileSync(path.join(output,`retention-workspace-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

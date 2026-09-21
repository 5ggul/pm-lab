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
    await page.locator('.v52-candidate-note summary').click();
    const note=page.locator('[data-v52-candidate-note]'),noteValue='전기증설 비용 확인 <img src=x onerror=alert(1)>';
    await note.fill(noteValue);assert.equal((await page.locator('[data-v52-note-count]').textContent()).trim(),noteValue.length+'/240');
    await page.reload({waitUntil:'load'});await page.locator('.v52-candidate-note summary').click();
    assert.equal(await page.locator('[data-v52-candidate-note]').inputValue(),noteValue);
    const storedNote=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabNoteV1:mega-mgc-coffee')||'""'));assert.equal(storedNote,noteValue);
    await page.locator('.v52-candidate-plan summary').click();
    await page.locator('[data-v52-candidate-status]').selectOption('hq');
    const nextAction='본사에 20평 기준 최신 견적 요청';await page.locator('[data-v52-next-action]').fill(nextAction);
    await page.reload({waitUntil:'load'});await page.locator('.v52-candidate-plan summary').click();
    assert.equal(await page.locator('[data-v52-candidate-status]').inputValue(),'hq');assert.equal(await page.locator('[data-v52-next-action]').inputValue(),nextAction);
    const storedPlan=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabPlanV1:mega-mgc-coffee')||'{}'));assert.equal(storedPlan.status,'hq');assert.equal(storedPlan.nextAction,nextAction);
    const rec=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabRecentV1')||'[]'));assert.equal(rec[0],'mega-mgc-coffee');
    assert.ok((await page.locator('[data-v52-brand-workspace]').boundingBox()).width>100);
  });
  await run('home restores saved and recent brands',async()=>{
    await page.goto(url(''),{waitUntil:'load'});
    assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('메가MGC커피'));
    assert.ok((await page.locator('[data-v52-recent-list]').innerText()).includes('메가MGC커피'));
    const savedText=await page.locator('[data-v52-saved-list]').innerText();
    assert.ok(savedText.includes('계약 전 확인 1/6'));assert.ok(savedText.includes('전기증설 비용 확인 <img src=x onerror=alert(1)>'));assert.ok(savedText.includes('본사 문의'));assert.ok(savedText.includes('다음: 본사에 20평 기준 최신 견적 요청'));
    assert.equal(await page.locator('[data-v52-dashboard-saved]').innerText(),'1');assert.equal(await page.locator('[data-v52-dashboard-checks]').innerText(),'1/6');assert.equal(await page.locator('[data-v52-dashboard-changes]').innerText(),'0');
    assert.equal(await page.locator('[data-v52-saved-list] img').count(),0);
    await page.locator('[data-v52-status-filter="hq"]').click();assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('메가MGC커피'));
    await page.locator('[data-v52-status-filter="site"]').click();assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('선택한 상태의 저장 후보가 없습니다'));
    await page.locator('[data-v52-status-filter="all"]').click();
    assert.equal(await page.locator('[data-v52-editorial-rail="home"] .v52-editorial-link').count(),3);
    assert.ok((await page.locator('[data-v52-editorial-rail="home"]').innerText()).includes('프랜차이즈 정보공개서는 어떤 순서로 봐야 하나'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await run('second saved brand loads into compare workspace',async()=>{
    await page.goto(url('brands/compose-coffee/'),{waitUntil:'load'});
    await page.locator('[data-v52-save-brand]').click();
    await page.locator('.v52-candidate-plan summary').click();await page.locator('[data-v52-candidate-status]').selectOption('site');await page.locator('[data-v52-next-action]').fill('상권 후보지 2곳 확인');
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabShortlistV1')||'[]'));
    assert.deepEqual(state.slice(0,2).map(x=>x.slug),['compose-coffee','mega-mgc-coffee']);
    await page.goto(url('compare/'),{waitUntil:'load'});
    const load=page.locator('[data-v52-load-saved]');assert.equal(await load.isDisabled(),false);await load.click();await page.waitForTimeout(400);
    const values=await page.locator('select[data-v34-pick]').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.deepEqual(values.slice(0,2),['compose-coffee','mega-mgc-coffee']);
    assert.equal(await page.locator('[data-v52-editorial-rail="compare"] .v52-editorial-link').count(),3);
    assert.ok((await page.locator('[data-v52-editorial-rail="compare"]').innerText()).includes('가맹점이 많으면 수익도 높은가'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await run('shortlist backup export and restore preserves workflow',async()=>{
    await page.goto(url(''),{waitUntil:'load'});
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-v52-export-shortlist]').click();const download=await downloadPromise,downloadPath=await download.path();assert.ok(downloadPath);
    const backup=JSON.parse(fs.readFileSync(downloadPath,'utf8'));assert.equal(backup.schema,'franchiseLabShortlistBackup');assert.equal(backup.version,1);assert.equal(backup.saved.length,2);assert.equal(backup.plans['mega-mgc-coffee'].status,'hq');assert.equal(backup.notes['mega-mgc-coffee'].includes('전기증설 비용 확인'),true);
    await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'load'});assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('관심 브랜드 저장'));
    await page.locator('[data-v52-import-file]').setInputFiles(downloadPath);await page.waitForFunction(()=>document.querySelector('[data-v52-backup-status]')?.textContent?.includes('복원 완료'));
    assert.equal(await page.locator('[data-v52-dashboard-saved]').innerText(),'2');assert.equal(await page.locator('[data-v52-dashboard-checks]').innerText(),'1/12');
    await page.locator('[data-v52-status-filter="hq"]').click();let filtered=await page.locator('[data-v52-saved-list]').innerText();assert.ok(filtered.includes('메가MGC커피'));assert.equal(filtered.includes('컴포즈커피'),false);
    await page.locator('[data-v52-status-filter="site"]').click();filtered=await page.locator('[data-v52-saved-list]').innerText();assert.ok(filtered.includes('컴포즈커피'));assert.equal(filtered.includes('메가MGC커피'),false);
    await page.locator('[data-v52-status-filter="all"]').click();assert.equal(await page.locator('[data-v52-saved-list] img').count(),0);
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
    assert.equal(await page.locator('[data-v52-dashboard-changes]').innerText(),'1');assert.equal(await page.locator('[data-v52-change-filter-count]').innerText(),'1');
    const homeInbox=page.locator('[data-v52-change-inbox="home"]');assert.equal(await homeInbox.isVisible(),true);assert.equal(await homeInbox.locator('[data-v52-change-item]').count(),1);assert.ok((await homeInbox.innerText()).includes('가맹점 +100개'));
    await page.locator('[data-v52-change-only]').click();let filtered=await page.locator('[data-v52-saved-list]').innerText();assert.ok(filtered.includes('메가MGC커피'));assert.equal(filtered.includes('컴포즈커피'),false);
    await page.locator('[data-v52-change-only]').click();
    await page.goto(url('updates/'),{waitUntil:'load'});
    assert.equal(await page.locator('.v52-change-radar-row').count(),12);
    assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('가맹점 +100개'));
    const updatesInbox=page.locator('[data-v52-change-inbox="updates"]');assert.equal(await updatesInbox.isVisible(),true);assert.equal(await updatesInbox.locator('[data-v52-change-item]').count(),1);assert.ok((await updatesInbox.innerText()).includes('가맹점 +100개'));
    await updatesInbox.locator('[data-v52-ack-saved-change="mega-mgc-coffee"]').click();assert.equal(await updatesInbox.isVisible(),false);
    assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('저장 후 확인된 수치 변화 없음'));
    const accepted=await page.evaluate(()=>JSON.parse(localStorage.getItem('franchiseLabShortlistV1')||'[]').find(x=>x.slug==='mega-mgc-coffee'));
    assert.equal(accepted.snapshotId,'trusted-2025-2026-09-21');assert.equal(accepted.metrics.stores,3325);
    assert.equal(await page.locator('[data-v52-editorial-rail="updates"] .v52-editorial-link').count(),3);
    assert.ok((await page.locator('[data-v52-editorial-rail="updates"]').innerText()).includes('공정위 조회 숫자와 이 사이트 숫자가 다를 수 있는 이유'));
    await page.goto(url(''),{waitUntil:'load'});assert.equal(await page.locator('[data-v52-dashboard-changes]').innerText(),'0');assert.equal(await page.locator('[data-v52-retention-alert]').isVisible(),false);
    await page.locator('[data-v52-change-only]').click();assert.ok((await page.locator('[data-v52-saved-list]').innerText()).includes('저장 후 달라진 후보가 없습니다.'));
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
  const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===6&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  fs.writeFileSync(path.join(output,`retention-workspace-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

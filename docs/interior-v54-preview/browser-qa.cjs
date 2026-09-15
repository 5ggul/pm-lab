const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');fs.mkdirSync(OUT,{recursive:true});
const FULL_FILE=path.join(OUT,'v54-full-backup.json');
const SELECTIVE_FILE=path.join(OUT,'v54-selective-backup.json');
const FAIL_FILE=path.join(OUT,'v54-fail-backup.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS=['interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46','interior-contract-reflection-v48','interior-review-baseline-v49','interior-review-revalidation-v50'];
const CP='interior-review-restore-checkpoint-v54';
const raw=n=>JSON.stringify({marker:n});

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(220)}
async function seed(page){await page.evaluate(({keys,cp})=>{localStorage.clear();keys.forEach((k,i)=>localStorage.setItem(k,JSON.stringify({marker:`CURRENT-${i}`})));localStorage.setItem('unrelated-v54','KEEP-ME');localStorage.removeItem(cp)},{keys:KEYS,cp:CP})}
async function snap(page){return page.evaluate(({keys,cp})=>({tracked:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),checkpoint:localStorage.getItem(cp),unrelated:localStorage.getItem('unrelated-v54')}),{keys:KEYS,cp:CP})}
function backup(values){return {format:'interior-review-backup',version:1,createdAt:'2026-09-15T08:00:00.000Z',values}}
function fullBackup(){return backup(Object.fromEntries(KEYS.map((k,i)=>[k,i===6?null:raw(`FULL-${i}`)]))}
function selectiveBackup(){const vals=Object.fromEntries(KEYS.map((k,i)=>[k,raw(`CURRENT-${i}`)]));vals['interior-quote-v5']=raw('SELECTIVE-QUOTE');vals['interior-review-progress-v46']=raw('SELECTIVE-PROGRESS');return backup(vals)}
function failBackup(){const vals=Object.fromEntries(KEYS.map((k,i)=>[k,raw(`CURRENT-${i}`)]));vals['interior-quote-v5']=raw('FAIL-QUOTE');vals['interior-review-progress-v46']=raw('FAIL-PROGRESS');return backup(vals)}

async function runFullUndo(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});const errors=watchErrors(page,'full');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  for(const name of ['InteriorQuoteReview52','InteriorQuoteReview53','InteriorQuoteReview54'])assert.equal(await page.evaluate(n=>typeof window[n],name),'object',`${name} did not auto-load`);
  assert.equal(await page.$eval('[data-v52-apply]',el=>el.dataset.v54Wrapped),'','v52 apply was not wrapped by v54');assert.equal(await page.$eval('[data-v53-apply]',el=>el.dataset.v54Wrapped),'','v53 apply was not wrapped by v54');
  const before=await snap(page);fs.writeFileSync(FULL_FILE,JSON.stringify(fullBackup()));const input=await page.$('[data-v52-file]');await input.uploadFile(FULL_FILE);await sleep(180);page.on('dialog',d=>d.accept());await page.click('[data-v52-apply]');await page.waitForNavigation({waitUntil:'domcontentloaded'}).catch(()=>{});await settle(page);
  const after=await snap(page);const cp=JSON.parse(after.checkpoint);assert.equal(cp.version,1);assert.equal(cp.mode,'full');assert.deepEqual([...cp.keys].sort(),[...KEYS].sort());for(const k of KEYS)assert.equal(cp.values[k],before.tracked[k],`checkpoint lost pre-restore value for ${k}`);
  const expected=fullBackup().values;for(const k of KEYS)assert.equal(after.tracked[k],expected[k],`full restore mismatch ${k}`);assert.equal(after.unrelated,'KEEP-ME');assert.match(await page.$eval('[data-v54-card]',el=>el.innerText),/전체 복원 전 상태 · 7개 영역/);
  await page.click('[data-v54-undo]');await page.waitForNavigation({waitUntil:'domcontentloaded'}).catch(()=>{});await settle(page);const undone=await snap(page);assert.deepEqual(undone.tracked,before.tracked,'full undo did not restore all seven pre-restore values');assert.equal(undone.checkpoint,null,'checkpoint not cleared after successful undo');assert.equal(undone.unrelated,'KEEP-ME');
  await page.screenshot({path:path.join(OUT,'desktop-v54-full-undo.png'),fullPage:true});assert.deepEqual(errors,[],`full browser errors:\n${errors.join('\n')}`);report.fullUndo='PASS';await page.close();
}

async function runSelectiveUndo(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1280,height:1000});const errors=watchErrors(page,'selective');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);const before=await snap(page);fs.writeFileSync(SELECTIVE_FILE,JSON.stringify(selectiveBackup()));const input=await page.$('[data-v53-file]');await input.uploadFile(SELECTIVE_FILE);await sleep(180);
  const checked=await page.$$eval('[data-v53-key]:checked',els=>els.map(x=>x.value).sort());assert.deepEqual(checked,['interior-quote-v5','interior-review-progress-v46'].sort());page.on('dialog',d=>d.accept());await page.click('[data-v53-apply]');await page.waitForNavigation({waitUntil:'domcontentloaded'}).catch(()=>{});await settle(page);
  let after=await snap(page);let cp=JSON.parse(after.checkpoint);assert.equal(cp.mode,'selective');assert.deepEqual([...cp.keys].sort(),['interior-quote-v5','interior-review-progress-v46'].sort());assert.equal(cp.values['interior-quote-v5'],before.tracked['interior-quote-v5']);assert.equal(cp.values['interior-review-progress-v46'],before.tracked['interior-review-progress-v46']);
  assert.equal(after.tracked['interior-quote-v5'],selectiveBackup().values['interior-quote-v5']);assert.equal(after.tracked['interior-review-progress-v46'],selectiveBackup().values['interior-review-progress-v46']);
  await page.evaluate(()=>localStorage.setItem('interior-compare-v5',JSON.stringify({marker:'MANUAL-AFTER-RESTORE'})));await page.click('[data-v54-undo]');await page.waitForNavigation({waitUntil:'domcontentloaded'}).catch(()=>{});await settle(page);after=await snap(page);
  assert.equal(after.tracked['interior-quote-v5'],before.tracked['interior-quote-v5']);assert.equal(after.tracked['interior-review-progress-v46'],before.tracked['interior-review-progress-v46']);assert.equal(after.tracked['interior-compare-v5'],raw('MANUAL-AFTER-RESTORE'),'undo incorrectly reverted a non-selected tracked key changed after restore');for(const k of KEYS.filter(k=>!['interior-quote-v5','interior-review-progress-v46','interior-compare-v5'].includes(k)))assert.equal(after.tracked[k],before.tracked[k],`selective undo touched ${k}`);assert.equal(after.checkpoint,null);assert.equal(after.unrelated,'KEEP-ME');
  assert.deepEqual(errors,[],`selective browser errors:\n${errors.join('\n')}`);report.selectiveUndo='PASS';await page.close();
}

async function runFailurePreservesCheckpoint(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1100,height:900});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  await page.evaluate(()=>window.InteriorQuoteReview54.prepareCheckpoint('selective',['interior-review-baseline-v49']));const priorCheckpoint=await page.evaluate(cp=>localStorage.getItem(cp),CP);const before=await snap(page);fs.writeFileSync(FAIL_FILE,JSON.stringify(failBackup()));const input=await page.$('[data-v53-file]');await input.uploadFile(FAIL_FILE);await sleep(160);page.on('dialog',d=>d.accept());
  await page.evaluate(()=>{const proto=Storage.prototype,orig=proto.setItem;proto.setItem=function(k,v){if(k==='interior-review-progress-v46'){proto.setItem=orig;throw new Error('forced restore write failure')}return orig.call(this,k,v)};window.__v54OrigSetItem=orig});await page.click('[data-v53-apply]');await sleep(220);await page.evaluate(()=>{if(window.__v54OrigSetItem)Storage.prototype.setItem=window.__v54OrigSetItem});
  const after=await snap(page);assert.deepEqual(after.tracked,before.tracked,'failed restore changed tracked values');assert.equal(after.checkpoint,priorCheckpoint,'failed restore replaced the previous successful checkpoint');assert.equal(after.unrelated,'KEEP-ME');assert.match(await page.$eval('[data-v53-message]',el=>el.textContent),/오류|유지/);
  report.failureCheckpoint='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page);await page.reload({waitUntil:'domcontentloaded'});await settle(page);await page.evaluate(()=>window.InteriorQuoteReview54.prepareCheckpoint('selective',['interior-quote-v5','interior-review-progress-v46']));await page.evaluate(()=>window.InteriorQuoteReview54.render());const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);assert.ok(await page.$eval('[data-v54-undo]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile undo button hidden');await page.emulateMediaType('print');assert.equal(await page.$eval('[data-v54-undo-section]',el=>getComputedStyle(el).display),'none');await page.emulateMediaType('screen');await page.screenshot({path:path.join(OUT,'mobile-v54-restore-undo.png'),fullPage:true});assert.deepEqual(errors,[],`mobile errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',fullUndo:'NOT RUN',selectiveUndo:'NOT RUN',failureCheckpoint:'NOT RUN',mobile:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runFullUndo(browser,report);await runSelectiveUndo(browser,report);await runFailurePreservesCheckpoint(browser,report);await runMobile(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V54 RESTORE UNDO QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V54 RESTORE UNDO QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

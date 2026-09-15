const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');

const ROOT='http://127.0.0.1:4173/pm-lab/interior-cost-preview/quote-review-report/';
const OUT=path.join(__dirname,'browser-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS=['interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46','interior-contract-reflection-v48','interior-review-baseline-v49','interior-review-revalidation-v50'];

function watchErrors(page,label){const errors=[];page.on('pageerror',e=>errors.push(`${label}: pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: console.error: ${m.text()}`)});return errors}
async function settle(page){await page.waitForNetworkIdle({idleTime:150,timeout:4000}).catch(()=>{});await sleep(220)}
async function snapshot(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),KEYS)}
async function seed(page,prefix='current'){await page.evaluate(({keys,prefix})=>{localStorage.clear();keys.forEach((key,i)=>localStorage.setItem(key,JSON.stringify({prefix,index:i,text:`${prefix}-${i}`,nested:{ok:true}})));localStorage.setItem('unrelated-local-key','DO-NOT-TOUCH')},{keys:KEYS,prefix})}

async function runDesktop(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});const errors=watchErrors(page,'desktop');
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page,'current');await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview52),'object','v52 did not auto-load from actual HTML');
  assert.ok(await page.$('[data-v52-backup-section]'),'v52 section missing');
  assert.equal(await page.$$eval('[data-v52-backup-section] .v52-panel',els=>els.length),2);

  const current=await snapshot(page);const built=await page.evaluate(()=>window.InteriorQuoteReview52.buildBackup());
  assert.equal(built.format,'interior-review-backup');assert.equal(built.version,1);assert.deepEqual(Object.keys(built.values).sort(),[...KEYS].sort());
  for(const key of KEYS)assert.equal(built.values[key],current[key],`backup did not preserve raw ${key}`);
  assert.equal(Object.prototype.hasOwnProperty.call(built.values,'unrelated-local-key'),false,'backup included unrelated localStorage');

  await page._client().send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:OUT});
  const beforeDownloads=new Set(fs.readdirSync(OUT));await page.click('[data-v52-export]');
  let downloaded=null;for(let i=0;i<30;i++){await sleep(100);downloaded=fs.readdirSync(OUT).find(name=>name.startsWith('interior-review-backup-')&&!beforeDownloads.has(name)&&!name.endsWith('.crdownload'));if(downloaded)break}
  assert.ok(downloaded,'export did not download JSON');const disk=JSON.parse(fs.readFileSync(path.join(OUT,downloaded),'utf8'));assert.equal(disk.format,'interior-review-backup');for(const key of KEYS)assert.equal(disk.values[key],current[key]);

  const invalidPath=path.join(OUT,'invalid-extra-key.json');fs.writeFileSync(invalidPath,JSON.stringify({format:'interior-review-backup',version:1,createdAt:new Date().toISOString(),values:{...Object.fromEntries(KEYS.map(k=>[k,null])),evil:'x'}}));
  const input=await page.$('[data-v52-file]');await input.uploadFile(invalidPath);await sleep(120);assert.match(await page.$eval('[data-v52-message]',el=>el.textContent),/허용되지 않은/);assert.equal(await page.$eval('[data-v52-preview]',el=>el.hidden),true);assert.deepEqual(await snapshot(page),current,'invalid preview mutated sources');

  const restoreValues=Object.fromEntries(KEYS.map((key,i)=>[key,i===5?null:JSON.stringify({prefix:'restored',index:i,payload:`backup-${i}`})]));
  const backup={format:'interior-review-backup',version:1,createdAt:'2026-09-15T04:00:00.000Z',values:restoreValues};
  const validPath=path.join(OUT,'valid-backup.json');fs.writeFileSync(validPath,JSON.stringify(backup,null,2));
  await input.uploadFile(validPath);await sleep(150);assert.equal(await page.$eval('[data-v52-preview]',el=>el.hidden),false);assert.equal(await page.$$eval('[data-v52-list] .v52-item',els=>els.length),7);assert.match(await page.$eval('[data-v52-count]',el=>el.textContent),/6 \/ 7/);assert.deepEqual(await snapshot(page),current,'preview mutated current data');

  const rollbackBefore=await snapshot(page);
  const rollbackResult=await page.evaluate(backup=>{const original=Storage.prototype.setItem;let count=0;Storage.prototype.setItem=function(k,v){count++;if(count===3){Storage.prototype.setItem=original;throw new Error('forced write failure')}return original.call(this,k,v)};let threw=false;try{window.InteriorQuoteReview52.applyBackup(backup)}catch{threw=true}finally{Storage.prototype.setItem=original}return threw},backup);
  assert.equal(rollbackResult,true,'forced restore failure did not throw');assert.deepEqual(await snapshot(page),rollbackBefore,'failed restore did not roll back');assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-local-key')),'DO-NOT-TOUCH');

  page.on('dialog',d=>d.accept());await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('[data-v52-apply]')]);await settle(page);
  const restored=await snapshot(page);for(const key of KEYS)assert.equal(restored[key],restoreValues[key],`restore mismatch ${key}`);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-local-key')),'DO-NOT-TOUCH','restore touched unrelated key');assert.equal(await page.evaluate(()=>typeof window.InteriorQuoteReview52),'object');

  await page.emulateMediaType('print');assert.equal(await page.$eval('[data-v52-backup-section]',el=>getComputedStyle(el).display),'none','backup controls should be hidden in print');await page.emulateMediaType('screen');
  await page.screenshot({path:path.join(OUT,'desktop-v52-local-backup.png'),fullPage:true});assert.deepEqual(errors,[],`desktop browser errors:\n${errors.join('\n')}`);report.desktop='PASS';await page.close();
}

async function runAPIValidation(browser,report){
  const page=await browser.newPage();await page.setViewport({width:1024,height:800});await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page,'api');await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const current=await snapshot(page);
  const result=await page.evaluate(()=>{const api=window.InteriorQuoteReview52;const backup=api.buildBackup();const text=JSON.stringify(backup);const parsed=api.parseBackupText(text);let badFormat=false,badKeys=false,badType=false;try{api.parseBackupText(JSON.stringify({...backup,format:'wrong'}))}catch{badFormat=true}try{api.parseBackupText(JSON.stringify({...backup,values:{...backup.values,unknown:'x'}}))}catch{badKeys=true}try{const v={...backup.values};v['interior-quote-v5']={};api.parseBackupText(JSON.stringify({...backup,values:v}))}catch{badType=true}return {parsed,badFormat,badKeys,badType}});
  assert.equal(result.badFormat,true);assert.equal(result.badKeys,true);assert.equal(result.badType,true);for(const key of KEYS)assert.equal(result.parsed.values[key],current[key]);assert.deepEqual(await snapshot(page),current,'validation mutated data');report.validation='PASS';await page.close();
}

async function runMobile(browser,report){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});const errors=watchErrors(page,'mobile');await page.goto(ROOT,{waitUntil:'domcontentloaded'});await settle(page);await seed(page,'mobile');await page.reload({waitUntil:'domcontentloaded'});await settle(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);assert.ok(overflow<=1,`document horizontal overflow: ${overflow}px`);assert.ok(await page.$eval('.v52-file-label',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}),'mobile file picker hidden');await page.screenshot({path:path.join(OUT,'mobile-v52-local-backup.png'),fullPage:true});assert.deepEqual(errors,[],`mobile browser errors:\n${errors.join('\n')}`);report.mobile='PASS';await page.close();
}

(async()=>{const report={engine:'Chromium via puppeteer-core',desktop:'NOT RUN',validation:'NOT RUN',mobile:'NOT RUN',finishedAt:null};const browser=await puppeteer.launch({executablePath:process.env.BROWSER_BIN,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});try{await runDesktop(browser,report);await runAPIValidation(browser,report);await runMobile(browser,report);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('INTERIOR V52 LOCAL BACKUP QA: PASS');console.log(JSON.stringify(report,null,2))}catch(error){report.finishedAt=new Date().toISOString();report.error=error.stack||String(error);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error('INTERIOR V52 LOCAL BACKUP QA: FAIL');console.error(error);process.exitCode=1}finally{await browser.close()}})();

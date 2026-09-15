import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname));
assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-directory');
fs.mkdirSync(output,{recursive:true});
const cases=[];
let browser;

const visibleRows=page=>page.locator('#directoryTable tbody tr:not([hidden])');
async function run(width){
 const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR'});const page=await context.newPage();page.setDefaultTimeout(10000);
 const item={width,pass:false},errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const start=new URL('brands/',base);start.search='?q=%EC%B9%B4%ED%8E%98&category=cafe&cost=10000&stores=500&growth=up&sort=growthDesc';
  const response=await page.goto(start.href,{waitUntil:'load'});assert.equal(response?.status(),200);
  const values=await page.locator('.directory-controls input,.directory-controls select').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.id,el.value])));
  assert.deepEqual(values,{directorySearch:'카페',directoryCategory:'cafe',directoryCost:'10000',directoryStores:'500',directoryGrowth:'up',directorySort:'growthDesc'});
  const first=await visibleRows(page).evaluateAll(rows=>rows.map(r=>({name:r.dataset.name,cat:r.dataset.cat,cost:Number(r.dataset.cost),stores:Number(r.dataset.stores),growth:Number(r.dataset.growth),category:r.cells[1].textContent.trim()})));
  assert.ok(first.length>0);assert.ok(first.every(r=>r.cat==='cafe'&&r.category.includes('카페')&&r.cost<=10000&&r.stores>=500&&r.growth>0));
  assert.deepEqual(first.map(r=>r.growth),[...first].map(r=>r.growth).sort((a,b)=>b-a));
  const saved=page.url();await page.reload({waitUntil:'load'});assert.equal(page.url(),saved);assert.equal(await visibleRows(page).count(),first.length);item.reloadRestored=true;

  const search=page.locator('#directorySearch');await search.fill('베이커리');await page.locator('#directoryCategory').selectOption('all');await page.locator('#directoryCost').selectOption('');await page.locator('#directoryStores').selectOption('');await page.locator('#directoryGrowth').selectOption('all');await page.locator('#directorySort').selectOption('name');
  const bakery=await visibleRows(page).evaluateAll(rows=>rows.map(r=>r.cells[1].textContent.trim()));assert.ok(bakery.length>0);assert.ok(bakery.every(v=>v.includes('베이커리')));item.categoryTextSearch=true;
  const params=new URL(page.url()).searchParams;assert.equal(params.get('q'),'베이커리');for(const k of ['category','cost','stores','growth','sort'])assert.equal(params.has(k),false);

  await search.fill('');await page.locator('#directorySort').selectOption('growthDesc');
  const growth=await visibleRows(page).evaluateAll(rows=>rows.map(r=>r.dataset.growth===''?null:Number(r.dataset.growth)));
  const finite=growth.filter(v=>v!=null);assert.deepEqual(finite,[...finite].sort((a,b)=>b-a));
  const firstMissing=growth.findIndex(v=>v==null);if(firstMissing>=0)assert.ok(growth.slice(firstMissing).every(v=>v==null));item.zeroGrowthSortedNumerically=finite.includes(0)?true:'no-zero-row';
  await page.locator('.directory-controls').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`${engine}-directory-${width}.png`),animations:'disabled'});
  assert.deepEqual(errors,[]);item.pass=true;
 }catch(e){item.error=e.message;item.pageErrors=errors;await page.screenshot({path:path.join(output,`${engine}-directory-FAIL-${width}.png`),animations:'disabled'}).catch(()=>{});}
 cases.push(item);console.log(JSON.stringify(item));await context.close();
}
try{browser=await tooling[engine].launch({headless:true});for(const width of [390,1440])await run(width);}finally{const report={engine,browserVersion:browser?.version()||null,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,pass:cases.length===2&&cases.every(c=>c.pass),cases,productionDeploy:false,indexPolicyChanged:false};await browser?.close();fs.writeFileSync(path.join(output,'directory-filter.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;}

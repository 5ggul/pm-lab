import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {patchHeaderNavigation} from './navigation-markup.mjs';

const engine=process.env.SSG_QA_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'Known browser engine required');
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Loopback only');
assert.ok(process.env.SSG_QA_DEP_ROOT,'Explicit isolated browser dependency root required');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-keyboard');
fs.mkdirSync(output,{recursive:true});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs/franchise-ssg-preview');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);
const pages=walk(root);
assert.equal(pages.length,311);
for(const file of pages){const html=fs.readFileSync(file,'utf8');assert.equal(patchHeaderNavigation(html),html,`Header repair missing from ${file}`);}
const routes=['','brands/','categories/','compare/','tools/','explore/','sources/','methodology/','about/','contact/','privacy/','terms/','rankings/','updates/','cost-components/','categories/cafe/','categories/bakery/','categories/laundry/','brands/mega-mgc-coffee/','compare/mega-mgc-coffee-vs-compose-coffee/','tools/startup-cost/','tools/monthly-profit-simulator/'];
const cases=[];
let browser;
const focused=page=>page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim().slice(0,80),name:document.activeElement?.getAttribute('name'),className:document.activeElement?.className}));
const assertFocus=async(page,selector)=>assert.equal(await page.locator(selector).evaluate(el=>el===document.activeElement),true,`Keyboard focus should be on ${selector}`);
async function shot(page,item,name){
 const file=`${engine}-${name}-${item.width}.png`;
 await page.screenshot({path:path.join(output,file),animations:'disabled',fullPage:false});
 (item.screenshots??=[]).push(file);
}
async function visit(page,route){
 const response=await page.goto(new URL(route,base).href,{waitUntil:'load'});
 assert.equal(response?.status(),200);
 await page.locator('main h1').first().waitFor({state:'visible'});
 await page.evaluate(()=>document.fonts.ready);
}
async function run(name,width,route,check){
 const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const item={name,width,route,pass:false},errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===base.origin)requests.push({url:r.url(),status:r.status()});});
 page.on('requestfailed',r=>{if(new URL(r.url()).origin===base.origin)requests.push({url:r.url(),failure:r.failure()?.errorText});});
 try{
  await visit(page,route);
  await check(page,item);
  assert.deepEqual(errors,[],'Uncaught browser errors');assert.deepEqual(requests,[],'Local resource failures');
  item.pass=true;
 }catch(e){item.error=e.message;item.focus=await focused(page).catch(()=>null);await shot(page,item,'FAIL-'+name).catch(()=>{});}
 item.pageErrors=errors;item.localFailures=requests;
 cases.push(item);console.log(JSON.stringify(item));await context.close();
}
async function navigation(page,item){
 const button=page.locator('.nav-toggle'),nav=page.locator('.site-header nav');
 assert.equal(await button.getAttribute('aria-controls'),await nav.getAttribute('id'));
 assert.equal(await button.getAttribute('aria-expanded'),'false');
 await page.locator('.site-header .logo').focus();await page.keyboard.press('Tab');
 item.compact=await button.isVisible();
 if(item.compact){
  await assertFocus(page,'.nav-toggle');
  await page.keyboard.press('Enter');await nav.waitFor({state:'visible'});
  assert.equal(await button.getAttribute('aria-label'),'메뉴 닫기');
  await page.keyboard.press('Tab');await assertFocus(page,'.site-header nav a:first-child');
  item.focusOutline=await nav.locator('a').first().evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
  assert.notEqual(item.focusOutline.style,'none');assert.ok(parseFloat(item.focusOutline.width)>=2);
  if(item.width===390)await shot(page,item,'menu-open-keyboard');
  await page.keyboard.press('Escape');await nav.waitFor({state:'hidden'});
  await assertFocus(page,'.nav-toggle');
  assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await button.getAttribute('aria-label'),'메뉴 열기');
  item.escapeRestoredFocus=true;
  await page.keyboard.press('Space');await page.keyboard.press('Tab');
  await assertFocus(page,'.site-header nav a:first-child');
  await page.keyboard.press('Shift+Tab');await assertFocus(page,'.nav-toggle');
  await page.keyboard.press('Tab');
  for(let i=1;i<await nav.locator('a').count();i++)await page.keyboard.press('Tab');
  await assertFocus(page,'.site-header nav a:last-child');
  await page.keyboard.press('Tab');await nav.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.querySelector('.site-header').contains(document.activeElement)),false);
  item.tabExitClosed=true;
  await button.focus();await page.keyboard.press('Enter');await nav.waitFor({state:'visible'});
  await page.locator('.preview-bar').click();await nav.waitFor({state:'hidden'});item.outsideClickClosed=true;
  await button.focus();await page.keyboard.press('Enter');
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>document.querySelector('.nav-toggle').getAttribute('aria-expanded')==='false');
  await assertFocus(page,'.site-header nav a:first-child');
  await page.setViewportSize({width:item.width,height:900});await nav.waitFor({state:'hidden'});
  await assertFocus(page,'.nav-toggle');item.resizeRecoveredFocus=true;
  if(item.width===390)await shot(page,item,'menu-closed-keyboard');
 }else{
  await assertFocus(page,'.site-header nav a:first-child');
  await page.keyboard.press('Escape');assert.equal(await nav.isVisible(),true);
  item.desktopLinksRemainVisible=true;
 }
 // Activate a real link by keyboard, not page.goto.
 if(item.compact){await button.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');}
 await assertFocus(page,'.site-header nav a:first-child');await page.keyboard.press('Enter');
 await page.waitForURL(new URL('brands/',base).href,{waitUntil:'load'});
 await page.locator('main h1').waitFor({state:'visible'});item.keyboardNavigation=true;
}
const slugs=['mega-mgc-coffee','compose-coffee','paiks-coffee','ediya-coffee'];
const chosen=page=>page.locator('[data-v34-pick]').evaluateAll(els=>els.map(el=>el.value).filter(Boolean));
const waitCount=(page,n)=>page.waitForFunction(count=>document.querySelector('[data-v49-compare-count]')?.textContent.trim()===count+'개',n);
async function compare(page,item){
 await waitCount(page,2);
 const input=page.locator('[data-v46-compare-search]');
 const enter=async text=>{await input.focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text);await page.keyboard.press('Enter');};
 await enter('빽다방');await waitCount(page,3);
 await enter('이디야커피');await waitCount(page,4);
 assert.deepEqual(await chosen(page),slugs);
 await enter('빽다방');assert.equal(await page.locator('[data-v46-compare-note]').textContent(),'이미 선택한 브랜드입니다.');
 assert.deepEqual(await chosen(page),slugs);item.duplicatePrevented=true;
 await enter('더벤티');assert.equal(await page.locator('[data-v46-compare-note]').textContent(),'최대 4개까지 비교할 수 있습니다.');item.limitPrevented=true;
 const params=new URL(page.url()).searchParams;
 assert.deepEqual(['a','b','c','d'].map(k=>params.get(k)),slugs);
 await page.reload({waitUntil:'load'});await waitCount(page,4);assert.deepEqual(await chosen(page),slugs);item.urlReloadRestored=true;
 if([390,1440].includes(item.width))await shot(page,item,'compare-four');
 await page.locator('[data-v49-compare-clear]').focus();await page.keyboard.press('Enter');await waitCount(page,0);
 assert.deepEqual(await chosen(page),[]);assert.ok(['a','b','c','d'].every(k=>!new URL(page.url()).searchParams.has(k)));
 item.keyboardClear=true;
}
const profitFields={revenue:'5000',materialRate:'30',platformRate:'5',royaltyRate:'5',labor:'1000',rent:'500',utilities:'200',other:'300'};
async function profit(page,item){
 await page.locator('form[data-tool="monthly-profit-v10"] [name="revenue"]').focus();
 for(const [name,value] of Object.entries(profitFields)){
  await assertFocus(page,`form[data-tool="monthly-profit-v10"] [name="${name}"]`);
  await page.keyboard.type(value);await page.keyboard.press('Tab');
 }
 const values=()=>page.locator('form[data-tool="monthly-profit-v10"] input').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.name,el.value])));
 assert.deepEqual(await values(),profitFields);
 assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams),profitFields);
 const expected={'data-profit-balance':'1,000만원','data-profit-variable':'2,000만원','data-profit-fixed':'2,000만원','data-profit-breakeven':'3,333만원'};
 for(const [key,value] of Object.entries(expected))assert.equal(await page.locator(`[${key}]`).textContent(),value);
 await page.reload({waitUntil:'load'});assert.deepEqual(await values(),profitFields);
 for(const [key,value] of Object.entries(expected))assert.equal(await page.locator(`[${key}]`).textContent(),value);
 item.keyboardEightFields=true;item.urlReloadRestored=true;item.results=expected;
 await page.locator('.calc-result-panel').scrollIntoViewIfNeeded();await shot(page,item,'monthly-profit');
}
async function smoke(page,item){
 item.dom=await page.evaluate(()=>{
  const h=document.querySelector('main h1'),r=h.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(h);
  return {heading:h.textContent.trim(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,textFits:[...range.getClientRects()].every(x=>x.left>=-1&&x.right<=innerWidth+1),noindex:document.querySelector('meta[name="robots"]')?.content.includes('noindex'),canonical:document.querySelector('link[rel="canonical"]')?.href};
 });
 const d=item.dom;assert.ok(d.heading);assert.ok(d.scrollWidth<=d.width+1,'Page overflow');assert.ok(d.left>=-1&&d.right<=d.width+1&&d.textFits,'Heading clipped');
 assert.ok(d.noindex);assert.ok(d.canonical.startsWith('https://5ggul.github.io/pm-lab/franchise-ssg-preview'));
 if(['','brands/','tools/startup-cost/'].includes(item.route))await shot(page,item,'page-'+(item.route.replaceAll('/','-')||'home'));
}
try{
 browser=await tooling[engine].launch({headless:true});
 for(const width of [360,390,768,1440])await run('navigation-keyboard',width,'',navigation);
 for(const width of [390,768,1440])await run('compare-keyboard',width,'compare/',compare);
 for(const width of [390,1440])await run('profit-keyboard',width,'tools/monthly-profit-simulator/',profit);
 for(const route of routes)for(const width of [360,1440])await run('route-smoke',width,route,smoke);
}finally{
 const version=browser?.version()||null;await browser?.close();
 const expected=9+routes.length*2;
 const report={engine,browserVersion:version,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,generatedAt:new Date().toISOString(),markupPages:pages.length,expected,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,pass:cases.length===expected&&cases.every(c=>c.pass),cases,productionDeploy:false,indexPolicyChanged:false,scope:'Real loopback origin. Playwright engine and viewport tests; not branded Safari, a physical iPhone or a screen-reader certification.'};
 fs.writeFileSync(path.join(output,'keyboard-webkit.json'),JSON.stringify(report,null,2)+'\n');
 console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
 if(!report.pass)process.exitCode=1;
}

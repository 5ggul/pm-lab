import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import {siteConfig} from './site-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const output=fileURLToPath(new URL('../../../output/review/full-service/',import.meta.url));fs.mkdirSync(output,{recursive:true});
const failures=[],pages=[],titles=new Map(),descriptions=new Map();
function fail(scope,message){failures.push({scope,message});}
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory()){if(!['assets','scripts','data'].includes(ent.name))walk(f)}else if(ent.name==='index.html')pages.push(f)}}walk(root);
let checkedLinks=0,checkedScripts=0;
for(const file of pages){
 const html=fs.readFileSync(file,'utf8'),rel=path.relative(root,file).replaceAll('\\','/'),route=rel.replace(/index.html$/,'');
 for(const [map,value,label] of [[titles,html.match(/<title>([^<]*)<\/title>/)?.[1],'title'],[descriptions,html.match(/<meta name="description" content="([^"]*)"/)?.[1],'description']]){if(!value)fail(rel,'missing '+label);else{const peers=map.get(value)||[];peers.push(rel);map.set(value,peers)}}
 const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 if((markup.match(/<h1(?:\s|>)/g)||[]).length!==1)fail(rel,'H1 count');
 if(!/noindex/.test(html.match(/<meta name="robots"[^>]*>/)?.[0]||''))fail(rel,'preview noindex missing');
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(/application\/ld\+json|application\/json/.test(m[1])){try{JSON.parse(m[2])}catch(e){fail(rel,'invalid JSON: '+e.message)}}else if(m[2].trim()&&!/type="module"/.test(m[1])){try{new vm.Script(m[2]);checkedScripts++}catch(e){fail(rel,'inline syntax: '+e.message)}}}
 for(const m of markup.matchAll(/<(a|script|img|link|source)\b[^>]*\b(?:href|src)="([^"]+)"/g)){
  const value=m[2].replaceAll('&amp;','&');if(!value||/^(?:https?:|mailto:|tel:|data:|#|javascript:)/i.test(value))continue;
  const url=new URL(value,new URL(route+'index.html',base+'/'));if(url.origin!==new URL(base).origin)continue;
  const prefix=new URL(base+'/').pathname;if(!url.pathname.startsWith(prefix))continue;
  let target=path.join(root,decodeURIComponent(url.pathname.slice(prefix.length)));if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  checkedLinks++;if(!fs.existsSync(target))fail(rel,'missing local link/asset: '+value);
 }
}
for(const [label,map] of [['title',titles],['description',descriptions]])for(const [value,peers] of map)if(peers.length>1)fail(peers.join(', '),'duplicate '+label+': '+value);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
let renderChecks=0,interactionChecks=0;
try{
 const tasks=pages.flatMap(file=>[360,375,390,430,1280].map(width=>({route:path.relative(root,file).replaceAll('\\','/').replace(/index.html$/,''),width})));let index=0;
 await Promise.all(Array.from({length:4},async()=>{
  const page=await newQaPage(browser);let scope='';
  page.on('pageerror',e=>fail(scope,'pageerror: '+e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)fail(scope,'HTTP '+r.status()+': '+r.url())});
  while(index<tasks.length){const task=tasks[index++];scope=task.width+' '+task.route;try{
   await page.setViewportSize({width:task.width,height:812});const response=await page.goto(base+'/'+task.route,{waitUntil:'domcontentloaded'});if(response?.status()!==200)fail(scope,'page status '+response?.status());
   await page.waitForFunction(()=>!document.querySelector('#familySearch')||document.documentElement.dataset.costMode,{timeout:10000});
   if(task.route==='compare/')await page.waitForFunction(()=>document.querySelector('#compareTable').textContent.trim());
   if(task.route==='tools/annual-cost/')await page.waitForFunction(()=>document.querySelector('#sourceRow').value);
   if(task.route==='cars/'){
     await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
     await page.locator('.catalog-extra').evaluate(e=>e.open=true);
   }
   const issues=await page.evaluate(()=>{
    const issues=[];if(document.documentElement.scrollWidth>innerWidth+1)issues.push('horizontal overflow '+(document.documentElement.scrollWidth-innerWidth));
    const controls=Array.from(document.querySelectorAll('input:not([type=hidden]),select,button')).filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('details:not([open])'));
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)issues.push('overlapping controls '+(controls[i].id||controls[i].textContent.slice(0,20))+' / '+(controls[j].id||controls[j].textContent.slice(0,20)));}
    return issues;
   });issues.forEach(message=>fail(scope,message));renderChecks++;
   if([375,1280].includes(task.width)&&['','cars/','compare/','tools/annual-cost/','cars/kia/sorento-mq4/','rankings/','rankings/annual-energy-cost/'].includes(task.route))await page.screenshot({path:path.join(output,task.width+'-'+(task.route.replaceAll('/','-')||'home')+'.png'),fullPage:true});
  }catch(e){fail(scope,e.message)}}await page.close();
 }));
 const page=await newQaPage(browser,{viewport:{width:375,height:812}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function check(name,fn){try{await fn();interactionChecks++;}catch(e){fail(name,e.message)}}
 for(const mode of ['all','reviewed'])await check('compare matrix '+mode,async()=>{
  await page.goto(base+'/compare/'+(mode==='reviewed'?'?mode=reviewed&a=grandeur-gn7&b=k8-gl3':''));await page.waitForFunction(()=>document.querySelector('#compareTable').textContent.trim());
  for(const value of ['', '0','-1000','999','100001']){await page.locator('#km').fill(value);assert.equal(await page.locator('#compareTable').textContent(),'');assert.equal(await page.locator('#compareConclusion').textContent(),'');}
  await page.locator('#km').fill('15000');assert.match(await page.locator('#compareAnswer').textContent(),/15,000km/);
  for(const value of ['', '0','-1800']){await page.locator('#gas').fill(value);assert(!/-[\d,]+원/.test(await page.locator('#compareTable').textContent()));assert(!(await page.locator('#compareConclusion').textContent()).includes('만 원 낮게'));}
  await page.locator('#gas').fill('1800');assert.match(await page.locator('#compareAnswer').textContent(),/원/);
  if(mode==='all')for(const side of ['A','B']){const input=page.locator('#family'+side),before=await input.inputValue();await input.fill('존재하지 않는 차량');assert.equal(await page.locator('#compareTable').textContent(),'');assert.equal(await page.locator('#compareLinks').textContent(),'');await input.fill(before);assert.match(await page.locator('#compareTable').textContent(),/자동차세/);}
 });
 await check('all reviewed calculator vehicles and variants',async()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
  for(const car of catalog.cars.filter(c=>c.indexable)){
   await page.goto(base+'/tools/annual-cost/?car='+car.id);await page.waitForFunction(()=>document.documentElement.dataset.costMode==='reviewed');
   for(const v of car.variants){await page.locator('#variant').selectOption(v.id);await page.locator('#price').fill('1800');await page.locator('#km').fill('15000');const expected=Math.round(15000/v.combined*1800);assert.equal(await page.locator('#energy').textContent(),expected.toLocaleString('ko-KR')+'원');for(const invalid of ['', '0','-1000']){await page.locator('#price').fill(invalid);assert(!/\d/.test(await page.locator('#energy').textContent()));}await page.locator('#price').fill('1800');assert.equal(await page.locator('#energy').textContent(),expected.toLocaleString('ko-KR')+'원');interactionChecks++;}
  }
 });
 await check('all popular detail variants',async()=>{
  const models=JSON.parse(fs.readFileSync(path.join(root,'data/popular-models-reviewed.json'),'utf8')).models;
  for(const model of models){await page.goto(base+'/'+model.path);for(const variant of model.variants){await page.locator('#pm-variant').selectOption(variant.id);await page.locator('#pm-distance').fill('15000');await page.locator('#pm-price').fill('1800');assert.match(await page.locator('#pm-energy').textContent(),/원/);await page.locator('#pm-price').fill('');assert(!/\d/.test(await page.locator('#pm-energy').textContent()));interactionChecks++;}}
 });

 await check('contact email and clipboard recovery',async()=>{
  await page.goto(base+'/contact/');await page.locator('[name=url]').fill('https://example.com/cars/');await page.locator('[name=type]').selectOption({label:'연비·전비'});await page.locator('[name=detail]').fill('표시 연비 확인\n출처: 공개 자료');
  const href=await page.locator('#reportEmail').getAttribute('href'),url=new URL(href);assert.equal(url.pathname,siteConfig.contactEmail);assert.match(url.searchParams.get('body'),/오류 주소: https:\/\/example.com\/cars\/\n항목: 연비·전비\n내용: 표시 연비 확인\n출처: 공개 자료/);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedReport=value}}}));await page.locator('#errorReport button').click();await page.waitForFunction(()=>window.__copiedReport);assert.equal(await page.evaluate(()=>window.__copiedReport),url.searchParams.get('body'));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('disabled')}}}));await page.locator('#errorReport button').click();await page.waitForSelector('#reportCopyFallback');assert.equal(await page.locator('#reportCopyFallback').inputValue(),url.searchParams.get('body'));
 });
 if(errors.length)fail('interaction pageerrors',errors.join('\n'));await page.close();
}finally{await browser.close()}
const report={generatedAt:new Date().toISOString(),base,htmlPages:pages.length,checkedLinks,checkedScripts,renderChecks,interactionChecks,widths:[360,375,390,430,1280],externalPhotos:'Wikimedia fixture used; live external image health is a separate check',failures};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));assert.equal(failures.length,0,'full-service QA failed; see output/review/full-service/report.json');

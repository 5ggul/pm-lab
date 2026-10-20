import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview',widths=[[375,812],[390,844],[430,932],[768,1024],[1280,900],[1440,900]];
const routes=['/','/cars/','/cars/hyundai/','/cars/kia/','/cars/genesis/','/cars/hyundai/grandeur-gn7/','/cars/kia/sorento-mq4/','/cars/hyundai/tucson-nx4/','/cars/hyundai/ioniq-5/','/cars/kia/ev6/','/cars/genesis/g80-rg3/','/cars/family/?id=hyundai-nexo','/cars/family/?id=family-018d643a22b2de5c','/compare/','/compare/sorento-vs-santafe/','/rankings/','/rankings/fuel-economy/','/tools/annual-cost/','/tools/car-tax/','/tools/fuel-cost/','/tools/ev-charge-cost/','/recalls/','/guide/','/about/','/methodology/','/data-sources/','/terms/','/privacy/','/contact/'];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})}),failures=[];let checks=0;
// Negative tabindex is valid only for inactive tabs in a fully checked roving
// tablist. Other visible links and controls retain the original focus check.
function inspectPageReadiness(){
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const validRovingTabs=new Set(),rovingTabFailures=[];
  for(const list of [...document.querySelectorAll('[role="tablist"]')].filter(visible)){
    const tabs=[...list.querySelectorAll('[role="tab"]')].filter(tab=>tab.closest('[role="tablist"]')===list);
    // Validate a roving exception only where a tab actually requests one. Lists
    // whose controls all have nonnegative tabindex keep the original checks.
    if(!tabs.some(tab=>tab.tabIndex<0))continue;
    const selected=tabs.filter(tab=>tab.getAttribute('aria-selected')==='true');
    const panels=tabs.map(tab=>document.getElementById(tab.getAttribute('aria-controls')||''));
    const valid=tabs.length>=2&&selected.length===1&&new Set(panels).size===tabs.length&&tabs.every((tab,i)=>{
      const active=tab===selected[0],panel=panels[i];
      return visible(tab)&&tab.getAttribute('aria-selected')===String(active)&&tab.getAttribute('tabindex')===String(active?0:-1)&&tab.tabIndex===(active?0:-1)&&tab.id&&panel?.getAttribute('role')==='tabpanel'&&panel.getAttribute('aria-labelledby')===tab.id&&visible(panel)===active;
    });
    if(valid)tabs.forEach(tab=>validRovingTabs.add(tab));
    else rovingTabFailures.push(list.outerHTML.slice(0,160));
  }
  const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
  const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
  const unlabelled=[...document.querySelectorAll('input,select,textarea,button')].filter(visible).filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!String(el.textContent||'').trim()).map(el=>el.outerHTML.slice(0,120));
  const images=[...document.images].filter(visible).filter(img=>!img.hasAttribute('alt')).map(img=>img.src);
  const localBroken=[...document.images].filter(visible).filter(img=>new URL(img.currentSrc||img.src,location.href).origin===location.origin&&img.complete&&!img.naturalWidth).map(img=>img.src);
  const focusFailures=[...document.querySelectorAll('a[href],button,input,select,textarea')].filter(visible).slice(0,24).filter(el=>el.tabIndex<0&&!validRovingTabs.has(el)).map(el=>el.outerHTML.slice(0,100));
  const resources=performance.getEntriesByType('resource').map(r=>({name:r.name,size:r.transferSize||r.encodedBodySize||0}));
  return {overflow:document.documentElement.scrollWidth-innerWidth,h1:document.querySelectorAll('main h1').length,duplicates,unlabelled,images,localBroken,focusFailures,rovingTabFailures,cls:window.__releaseCls||0,monolith:resources.filter(r=>r.name.includes('all-car-calc-index.json')),jsonBytes:resources.filter(r=>/data\/generated\/.+\.json/.test(r.name)).reduce((n,r)=>n+r.size,0)};
}
try{for(const [width,height] of widths){const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});for(const route of routes){const page=await context.newPage(),scope=`${width}x${height} ${route}`;page.on('pageerror',error=>failures.push(`${scope}: ${error.message}`));await page.addInitScript(()=>{window.__releaseCls=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__releaseCls+=entry.value}).observe({type:'layout-shift',buffered:true})});try{await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000});if(route==='/cars/')await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready',{timeout:15000});if(route.startsWith('/cars/family/'))await page.waitForSelector('[data-family-universal="ready"]',{timeout:15000});if(route==='/compare/'||route==='/tools/annual-cost/')await page.waitForFunction(()=>document.querySelectorAll('option').length>5,{timeout:15000});await page.waitForTimeout(120);const result=await page.evaluate(inspectPageReadiness);assert.ok(result.overflow<=1,`overflow ${result.overflow}`);assert.equal(result.h1,1,'H1 count');assert.deepEqual(result.duplicates,[],'duplicate IDs');assert.deepEqual(result.unlabelled,[],'unlabelled controls');assert.deepEqual(result.images,[],'images without alt');assert.deepEqual(result.localBroken,[],'broken local images');assert.deepEqual(result.rovingTabFailures,[],'invalid roving tab structure');assert.deepEqual(result.focusFailures,[],'unfocusable controls');assert.ok(result.cls<0.1,`CLS ${result.cls}`);assert.deepEqual(result.monolith,[],'monolithic calculation payload requested');assert.ok(result.jsonBytes<1800000,`initial JSON payload ${result.jsonBytes}`);checks++}catch(error){failures.push(`${scope}: ${error.message}`)}finally{await page.close()}}await context.close()}}finally{await browser.close()}
const report={checked_at:new Date().toISOString(),routes:routes.length,widths:widths.map(([w,h])=>`${w}x${h}`),checks,failures};fs.mkdirSync(new URL('../../../output/review/full-service/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../../../output/review/full-service/release-readiness.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;

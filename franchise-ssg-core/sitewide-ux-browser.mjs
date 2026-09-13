import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Inspect the freshly built preview, never production or a synthetic DOM.
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../docs/franchise-ssg-preview');
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Loopback preview only');
assert.ok(process.env.SSG_QA_DEP_ROOT,'SSG_QA_DEP_ROOT required');
const {chromium}=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-sitewide-ux');
fs.mkdirSync(output,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'route-manifest.json'),'utf8'));
assert.equal(manifest.uiVersion,'11.52','Build the locked preview before QA');
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(item.name.endsWith('.html'))files.push(file);}}
walk(root);
assert.equal(files.length,311,'Unexpected route coverage');
const routes=files.map(file=>path.relative(root,file).split(path.sep).join('/').replace(/index\.html$/,'')).sort();
const highlighted=new Set(['','brands/','categories/','compare/','tools/','explore/','sources/','methodology/','about/','contact/','privacy/','terms/','rankings/','updates/','cost-components/','categories/cafe/','categories/bakery/','categories/laundry/','brands/mega-mgc-coffee/','compare/mega-mgc-coffee-vs-compose-coffee/','tools/startup-cost/','tools/monthly-profit-simulator/']);
const jobs=routes.flatMap(route=>(highlighted.has(route)?[360,390,768,1440]:[360,1440]).map(width=>({route,width})));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[],journeys=[];
let cursor=0, failureShots=0;
const shotRoute=new Set(['','brands/','categories/cafe/','compare/','tools/','sources/']);

async function audit({route,width}){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'ko-KR'});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const errors=[],localFailures=[],externalFailures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)(new URL(r.url()).origin===base.origin?localFailures:externalFailures).push({url:r.url(),status:r.status()});});
  const result={route:'/'+route,width,pass:false};
  try{
    const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(response?.status(),200,'HTTP status');
    await page.locator('main h1').first().waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
    result.dom=await page.evaluate(()=>{
      const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
      const headings=[...document.querySelectorAll('main h1')].map(el=>{const r=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);return {text:el.textContent.trim(),box:rect(r),textRects:[...range.getClientRects()].map(rect)};});
      const labels=[...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea')].filter(el=>el.getClientRects().length&&!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.getAttribute('title')).map(el=>({tag:el.tagName,name:el.name||null,placeholder:el.getAttribute('placeholder')}));
      const wide=[...document.querySelectorAll('main h2,main h3')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).slice(0,10).map(el=>el.textContent.trim());
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings,mainTextLength:document.querySelector('main')?.innerText.trim().length||0,robots:document.querySelector('meta[name=robots]')?.content||'',canonical:document.querySelector('link[rel=canonical]')?.href||'',unnamedControls:labels,wideSectionHeadings:wide};
    });
    assert.equal(result.dom.headings.length,1,'One visible main heading');
    assert.ok(result.dom.mainTextLength>20,'Meaningful main content');
    assert.ok(result.dom.robots.includes('noindex'),'Preview must remain noindex');
    assert.ok(result.dom.canonical.startsWith('https://5ggul.github.io/pm-lab/franchise-ssg-preview'),'Preview canonical');
    assert.ok(result.dom.scrollWidth<=width+1,`Page overflow ${result.dom.scrollWidth}/${width}`);
    const h=result.dom.headings[0];
    assert.ok(h.box.left>=-1&&h.box.right<=width+1,'H1 box clipped');
    assert.ok(h.textRects.length&&h.textRects.every(r=>r.left>=-1&&r.right<=width+1),'H1 text clipped even when page overflow is hidden');
    // Trigger lower-page lazy UI and check errors after real scrolling.
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.deepEqual(errors,[],'Uncaught page errors');
    assert.deepEqual(localFailures,[],'Failed same-origin resources');
    result.pass=true;
  }catch(e){result.error=e.message;}
  result.pageErrors=errors;
  if(localFailures.length)result.localFailures=localFailures;
  if(externalFailures.length)result.externalFailures=externalFailures;
  if((shotRoute.has(route)&&[360,1440].includes(width))||(!result.pass&&failureShots++<20)){
    try{await page.evaluate(()=>window.scrollTo(0,0));result.screenshot=`page-${String(jobs.findIndex(x=>x.route===route&&x.width===width)).padStart(3,'0')}-${width}.png`;await page.screenshot({path:path.join(output,result.screenshot),animations:'disabled',timeout:10000});}catch(e){result.screenshotError=e.message;}
  }
  cases.push(result);
  if(!result.pass)console.log('PAGE_FAIL '+JSON.stringify(result));
  if(cases.length%100===0)console.log('PAGES_CHECKED '+cases.length+'/'+jobs.length);
  await context.close();
}

async function navigationJourney(width){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'ko-KR'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const result={name:'header-navigation',width,pass:false,visited:[]},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    for(const suffix of ['brands/','categories/','compare/','tools/','guide/low-price-coffee/','sources/']){
      await page.goto(base.href,{waitUntil:'domcontentloaded'});
      const toggle=page.locator('.nav-toggle');
      if(await toggle.isVisible()){
        await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      }
      const link=page.locator(`.site-header nav a[href$="/${suffix}"]`);
      await link.click();
      await page.waitForURL(new URL(suffix,base).href,{waitUntil:'domcontentloaded'});
      await page.locator('main h1').waitFor({state:'visible'});
      result.visited.push(suffix);
    }
    assert.deepEqual(errors,[],'Header journey browser errors');result.pass=true;
  }catch(e){result.error=e.message;}
  result.pageErrors=errors;journeys.push(result);console.log('JOURNEY '+JSON.stringify(result));await context.close();
}

try{
  await Promise.all(Array.from({length:3},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];await audit(job);}}));
  for(const width of [360,390,768,1440])await navigationJourney(width);
}finally{
  await browser.close();
  cases.sort((a,b)=>a.route.localeCompare(b.route)||a.width-b.width);
  const failed=cases.filter(x=>!x.pass),failedJourneys=journeys.filter(x=>!x.pass);
  const report={kind:'fresh-build-sitewide-ux',generatedAt:new Date().toISOString(),sourceHead:process.env.SSG_QA_SOURCE_SHA||null,checkoutSha:process.env.GITHUB_SHA||null,uiVersion:manifest.uiVersion,htmlPages:files.length,expectedPageCases:jobs.length,pageCases:cases.length,passed:cases.length-failed.length,failed:failed.length,journeys,pass:cases.length===jobs.length&&!failed.length&&journeys.length===4&&!failedJourneys.length,cases,productionDeploy:false,indexPolicyChanged:false,scope:'Chromium render/heading/HTTP/console/noindex for all HTML; header journeys plus separately run comparison and calculator regressions. Not a full accessibility, external-source, or real-device certification.'};
  fs.writeFileSync(path.join(output,'sitewide-ux.json'),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

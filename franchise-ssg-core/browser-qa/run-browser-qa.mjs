import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve('docs/franchise-ssg-preview');
const out = path.resolve(process.env.SSG_QA_OUTPUT || 'artifacts/franchise-browser-qa');
const base = new URL(process.env.SSG_QA_BASE_URL || 'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('QA accepts loopback origins only; production must not be tested or changed.');
if (!base.pathname.endsWith('/')) throw new Error('SSG_QA_BASE_URL must end with /.');
const deps = process.env.SSG_QA_DEP_ROOT;
if (!deps) throw new Error('Set SSG_QA_DEP_ROOT to the temporary directory containing node_modules/playwright.');
const { chromium } = await import(pathToFileURL(path.join(deps, 'node_modules/playwright/index.mjs')).href);
fs.mkdirSync(out, { recursive: true });
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]).sort(); }
function fingerprint() { const h=createHash('sha256'); for(const f of walk(root)) h.update(path.relative(root,f)).update('\0').update(fs.readFileSync(f)).update('\0'); return h.digest('hex'); }
const before = fingerprint();
const routes = walk(root).filter(f=>f.endsWith('/index.html')).map(f=>path.relative(root,path.dirname(f)).replaceAll(path.sep,'/')).map(p=>p ? p+'/' : '');
const chosen = new Set(['','brands/','categories/','compare/','explore/','tools/','sources/','guide/low-price-coffee/'].filter(r=>routes.includes(r)));
for(const prefix of ['brands/','categories/','compare/','guide/','rankings/','tools/']) {
  const children = routes.filter(r=>r.startsWith(prefix) && r!==prefix);
  for(const r of children.slice(0,prefix==='tools/' ? 10 : 2)) chosen.add(r);
}
const viewports=[{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}];
const report={ schemaVersion:1, kind:'REAL_CHROMIUM_BROWSER_QA', commit:process.env.GITHUB_SHA||null, branch:process.env.GITHUB_REF_NAME||null, startedAt:new Date().toISOString(), readOnly:true, productionDeploy:false, allHtmlCount:walk(root).filter(f=>f.endsWith('.html')).length, sampledRoutes:[...chosen], viewports, checks:[], interactions:[], previewHashBefore:before, manualScreenshotReview:'NOT_PERFORMED_BY_AUTOMATION' };
let browser;
function slug(s) { return (s||'home').replaceAll('/','--').replace(/[^\p{L}\p{N}_.-]/gu,'_').slice(0,100); }
async function saveScreenshot(page,name) { const file=slug(name)+'.png'; await page.screenshot({path:path.join(out,file),fullPage:true,animations:'disabled',timeout:20000}); return file; }
async function inspect(page) {
  return page.evaluate(()=>{
    const visible=e=>!!(e.getClientRects().length && getComputedStyle(e).visibility!=='hidden' && getComputedStyle(e).display!=='none');
    const describe=e=>({tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,120),text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,100)});
    const scrollParent=e=>{for(let p=e.parentElement;p && p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX) && p.scrollWidth>p.clientWidth+1)return true;}return false;};
    const controls=[...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea,main button')].filter(visible).map(e=>({...describe(e),type:e.type,name:e.name,value:e.value,ariaLabel:e.getAttribute('aria-label'),label:[...(e.labels||[])].map(l=>l.textContent.trim()).join(' '),options:e.tagName==='SELECT'?[...e.options].slice(0,6).map(o=>({value:o.value,text:o.text})):undefined}));
    const clipped=[...document.querySelectorAll('main a,main button,main input,main select,main h1,main h2')].filter(visible).filter(e=>!scrollParent(e)).filter(e=>{const r=e.getBoundingClientRect();return r.left < -2 || r.right>innerWidth+2;}).slice(0,25).map(describe);
    return {title:document.title,h1:[...document.querySelectorAll('h1')].filter(visible).map(e=>e.textContent.trim()),viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,robots:document.querySelector('meta[name=robots]')?.content||'',canonical:document.querySelector('link[rel=canonical]')?.href||'',mainTextLength:(document.querySelector('main')?.innerText||'').trim().length,brokenImages:[...document.images].filter(e=>e.complete && e.naturalWidth===0).map(e=>({src:e.currentSrc||e.src,alt:e.alt})),controls,clipped,bodyText:(document.body.innerText||'').slice(0,22000)};
  });
}
async function settle(page) { await page.evaluate(()=>document.fonts ? Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]) : null); await page.waitForTimeout(200); }
async function interaction(name,fn) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const item={name,pass:false};
  try { item.evidence=await fn(page); item.pass=true; } catch(e) { item.error=String(e.message||e); }
  try { item.url=page.url();item.screenshot=await saveScreenshot(page,'interaction-'+name);item.finalState=await inspect(page); } catch(e) {item.captureError=String(e.message||e);}
  report.interactions.push(item);console.log(JSON.stringify({interaction:name,pass:item.pass,error:item.error}));await page.close();
}
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  report.browserVersion=browser.version();
  for(const vp of viewports) {
    const context=await browser.newContext({viewport:vp,reducedMotion:'reduce'});
    for(const route of chosen) {
      const page=await context.newPage();
      const item={route,width:vp.width,failures:[],pageErrors:[],consoleErrors:[],internalHttpErrors:[],externalRequestFailures:[]};
      page.on('pageerror',e=>item.pageErrors.push(String(e.message)));
      page.on('console',m=>{if(m.type()==='error')item.consoleErrors.push(m.text().slice(0,500));});
      page.on('response',r=>{if(r.status()>=400 && new URL(r.url()).origin===base.origin)item.internalHttpErrors.push({url:r.url(),status:r.status()});});
      page.on('requestfailed',r=>{if(new URL(r.url()).origin!==base.origin)item.externalRequestFailures.push({url:r.url(),error:r.failure()?.errorText});});
      try {
        const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded',timeout:30000});
        item.httpStatus=response?.status();await settle(page);item.dom=await inspect(page);
        if(item.httpStatus!==200)item.failures.push('document HTTP status is not 200');
        if(item.dom.h1.length!==1)item.failures.push('expected one visible h1');
        if(!/\bnoindex\b/i.test(item.dom.robots))item.failures.push('preview noindex missing');
        if(item.dom.mainTextLength<40)item.failures.push('main content missing');
        if(item.dom.documentWidth>vp.width+2)item.failures.push('document horizontal overflow');
        if(item.pageErrors.length)item.failures.push('uncaught JavaScript error');
        if(item.internalHttpErrors.length)item.failures.push('internal resource failed');
        if(item.dom.brokenImages.some(i=>new URL(i.src,base).origin===base.origin))item.failures.push('broken internal image');
        if(vp.width===390 || vp.width===1440 || item.failures.length)item.screenshot=await saveScreenshot(page,slug(route)+'-'+vp.width);
      } catch(e) { item.failures.push(String(e.message||e)); }
      item.pass=item.failures.length===0;report.checks.push(item);
      console.log(JSON.stringify({route,width:vp.width,pass:item.pass,failures:item.failures}));await page.close();
    }
    await context.close();
  }
  await interaction('mobile-menu',async page=>{
    await page.goto(base.href);const button=page.locator('.nav-toggle');
    if(await button.count()!==1 || !await button.isVisible())throw new Error('mobile navigation button is not visible');
    await button.click();if(await button.getAttribute('aria-expanded')!=='true')throw new Error('aria-expanded did not become true');
    const target=page.locator('header nav a').first();if(!await target.isVisible())throw new Error('navigation link remains hidden');
    await target.click();await page.waitForLoadState('domcontentloaded');
    if(page.url().replace(/\/$/,'')===base.href.replace(/\/$/,''))throw new Error('navigation link did not navigate');
    return {navigatedTo:page.url()};
  });
  await interaction('home-search-brand',async page=>{
    await page.goto(base.href);const search=page.locator('form[data-v25-search]');
    if(await search.count()!==1)throw new Error('expected home search form was not found');
    await search.locator('input[name=q]').fill('메가MGC커피');await search.locator('button').click();await page.waitForLoadState('domcontentloaded');await settle(page);
    const state=await inspect(page);if(!state.bodyText.includes('메가'))throw new Error('searched brand is not present after submission');
    if(page.url().replace(/\/$/,'')===base.href.replace(/\/$/,''))throw new Error('home search did not navigate');
    return {url:page.url(),h1:state.h1};
  });
  await interaction('home-search-empty-results',async page=>{
    await page.goto(base.href);const search=page.locator('form[data-v25-search]');
    await search.locator('input[name=q]').fill('QA존재하지않는브랜드999');await search.locator('button').click();await page.waitForLoadState('domcontentloaded');await settle(page);
    const text=await page.locator('main').innerText();
    if(!/검색[^\n]{0,30}(없|0)|결과[^\n]{0,30}(없|0)|찾[^\n]{0,20}없|0\s*개/.test(text))throw new Error('no explicit zero-results message was observed');
    const recovery=page.locator('main button,main a').filter({hasText:/초기화|전체|다시|업종|브랜드/});
    if(await recovery.count()===0)throw new Error('no obvious recovery control from empty search');
    return {url:page.url(),recoveryControls:await recovery.allTextContents()};
  });
} catch(e) {report.fatalError=String(e.stack||e);}
finally {
  if(browser)await browser.close();report.previewHashAfter=fingerprint();report.previewUnchanged=report.previewHashAfter===before;
  report.finishedAt=new Date().toISOString();report.summary={pageChecks:report.checks.length,passedPageChecks:report.checks.filter(c=>c.pass).length,failedPageChecks:report.checks.filter(c=>!c.pass).length,interactions:report.interactions.length,failedInteractions:report.interactions.filter(c=>!c.pass).length};
  report.pass=!report.fatalError && report.previewUnchanged && report.summary.failedPageChecks===0 && report.summary.failedInteractions===0 && report.summary.pageChecks>0;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# Franchise real-browser QA','',`Commit: ${report.commit}`,`Browser: ${report.browserVersion||'not launched'}`,`Result: ${report.pass?'PASS':'FAIL'}`,`Preview tree unchanged: ${report.previewUnchanged}`,`Pages: ${report.summary.passedPageChecks}/${report.summary.pageChecks}`,`Interactions: ${report.summary.interactions-report.summary.failedInteractions}/${report.summary.interactions}`,'','This run does not deploy, change indexing, generate production candidates, or prove AdSense approval. Screenshots require a separate human/vision review.','',...report.checks.filter(c=>!c.pass).map(c=>`- ${c.width}px ${c.route||'/'}: ${c.failures.join('; ')}`),...report.interactions.filter(c=>!c.pass).map(c=>`- ${c.name}: ${c.error}`),report.fatalError||''].join('\n');
  fs.writeFileSync(path.join(out,'REPORT.md'),md+'\n');console.log(JSON.stringify(report.summary));if(!report.pass)process.exitCode=1;
}

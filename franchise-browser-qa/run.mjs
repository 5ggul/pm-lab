import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../docs/franchise-ssg-preview');
const results = path.join(here, 'results');
await fs.mkdir(path.join(results, 'screenshots'), { recursive: true });
const prefix = '/pm-lab/franchise-ssg-preview';
const snapshot = JSON.parse(await fs.readFile(path.join(root, 'data-snapshot-v11-26.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'route-manifest.json'), 'utf8'));
const longest = snapshot.brands.slice().sort((a,b) => b.name.length-a.name.length)[0];
const routes = ['/', '/brands/', '/categories/cafe/', '/categories/chicken/', '/compare/', '/explore/', '/rankings/', '/cost-components/', '/sources/', '/tools/', '/tools/startup-cost/', '/tools/brand-filter/', '/tools/break-even/', '/tools/category-median/', '/tools/disclosure-decoder/', '/tools/monthly-fixed-cost/', '/tools/monthly-profit-simulator/', '/tools/open-close-rate/', '/brands/mega-mgc-coffee/', longest.route];
const widths = [320, 360, 390, 430, 1440];
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!(url.pathname === prefix || url.pathname.startsWith(prefix + '/'))) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length));
    let file = path.resolve(root, '.' + (relative || '/'));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({ headless:true });
const layout = [], journeys = [], errors = [], failedRequests = [];
const safeName = route => route === '/' ? 'home' : route.replace(/^\/|\/$/g,'').replaceAll('/','--');
const number = text => Number(String(text).replace(/[^\d.\-]/g,''));
const browserVersion = browser.version();
async function settle(page) {
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve=>setTimeout(resolve,1500))]));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function open(page, route) {
  const response = await page.goto(base + route, { waitUntil:'domcontentloaded', timeout:20000 });
  assert.equal(response.status(), 200, 'page HTTP status');
  await settle(page);
}
function observe(page, tag, localErrors) {
  page.on('pageerror', e => { const row={tag,message:e.message}; errors.push(row); localErrors.push(row); });
  page.on('requestfailed', req => failedRequests.push({tag,url:req.url(),error:req.failure()?.errorText}));
}
try {
  // Independent real Chromium contexts, not source-code checks or device emulation claims.
  await Promise.all(widths.map(async width => {
    const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion:'reduce', locale:'ko-KR' });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    let currentTag=''; let localErrors=[];
    page.on('pageerror', e=> { const row={tag:currentTag,message:e.message}; errors.push(row); localErrors.push(row); });
    page.on('requestfailed', req=>failedRequests.push({tag:currentTag,url:req.url(),error:req.failure()?.errorText}));
    for (const route of routes) {
      currentTag=`${width}:${route}`; localErrors=[];
      const row={route,width,status:'PASS'};
      try {
        await open(page,route);
        const metrics = await page.evaluate(() => {
          const h = document.querySelector('h1'), r = h?.getBoundingClientRect();
          const clips = [...document.querySelectorAll('input:not([type=hidden]),select,button')].filter(el=>{
            const s=getComputedStyle(el),b=el.getBoundingClientRect();
            if (!b.width||!b.height||s.visibility==='hidden'||s.display==='none') return false;
            let p=el.parentElement; while(p){const ps=getComputedStyle(p);if(/auto|scroll/.test(ps.overflowX))return false;p=p.parentElement;}
            return b.left < -2 || b.right > innerWidth+2;
          }).map(el=>({tag:el.tagName,name:el.getAttribute('name')||el.textContent.trim().slice(0,45),left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right)}));
          return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1Count:document.querySelectorAll('h1').length,h1Text:h?.textContent,h1:r?{left:r.left,right:r.right,width:r.width,height:r.height}:null,mainVisible:!!document.querySelector('main')?.getBoundingClientRect().height,controlsOutsideViewport:clips,robots:document.querySelector('meta[name=robots]')?.content,images:[...document.images].map(i=>({src:i.currentSrc||i.src,loaded:i.complete&&i.naturalWidth>0,visible:!!i.getBoundingClientRect().width&&!!i.getBoundingClientRect().height}))};
        });
        Object.assign(row,metrics);
        assert.equal(metrics.h1Count,1,'exactly one H1');
        assert(metrics.mainVisible,'main visible');
        assert(metrics.robots?.includes('noindex'),'preview remains noindex');
        assert(metrics.scrollWidth<=width+2,`page overflow ${metrics.scrollWidth}/${width}`);
        assert(metrics.h1 && metrics.h1.left>=-2 && metrics.h1.right<=width+2,`H1 clipped: ${JSON.stringify(metrics.h1)}`);
        assert.equal(localErrors.length,0,'no uncaught browser errors');
        assert.equal(metrics.controlsOutsideViewport.length,0,`clipped controls: ${JSON.stringify(metrics.controlsOutsideViewport)}`);
      } catch(e) { row.status='FAIL'; row.error=String(e.message||e); }
      if(width===390 || (width===1440&&['/','/compare/','/tools/startup-cost/','/brands/mega-mgc-coffee/','/categories/cafe/'].includes(route)) || row.status==='FAIL') {
        const filename=`${width}-${safeName(route)}.png`;
        try { await page.screenshot({path:path.join(results,'screenshots',filename),fullPage:true,animations:'disabled',timeout:12000});row.screenshot=`screenshots/${filename}`; } catch(e){row.screenshotError=e.message;}
      }
      layout.push(row);
      console.log(`${row.status} layout ${currentTag}${row.error?' '+row.error:''}`);
    }
    await context.close();
  }));

  async function test(name,fn,width=390) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'ko-KR'});
    const page=await context.newPage(); page.setDefaultTimeout(6000);
    const localErrors=[];observe(page,name,localErrors);
    const row={name,width,status:'PASS'};
    try {await fn(page);assert.equal(localErrors.length,0,'no uncaught JavaScript errors');}
    catch(e){row.status='FAIL';row.error=e.message;try{const filename=`journey-${journeys.length+1}.png`;await page.screenshot({path:path.join(results,'screenshots',filename),fullPage:true,timeout:10000});row.screenshot=`screenshots/${filename}`;}catch{}}
    journeys.push(row);console.log(`${row.status} journey ${name}${row.error?' '+row.error:''}`);await context.close();
  }
  await test('Mobile menu opens and closes',async p=>{
    await open(p,'/');const button=p.locator('.nav-toggle');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');assert(await p.locator('.site-header nav').isVisible());await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');
  });
  await test('Brand directory search and zero results',async p=>{
    await open(p,'/brands/');await p.locator('#directorySearch').fill('메가');assert((await p.locator('#directoryCount').innerText()).includes('1개'));await p.locator('#directorySearch').fill('zzzz없는브랜드검수');assert((await p.locator('#directoryCount').innerText()).includes('0개'));await p.locator('#directorySearch').fill('');assert((await p.locator('#directoryCount').innerText()).includes(String(snapshot.brand_count)));
  });
  await test('Compare URL loads selected brands and supports four selections',async p=>{
    await open(p,'/compare/?a=mega-mgc-coffee&b=compose-coffee');const picks=p.locator('[data-v34-pick]');assert.equal(await picks.nth(0).inputValue(),'mega-mgc-coffee');assert.equal(await picks.nth(1).inputValue(),'compose-coffee');await picks.nth(2).selectOption('paiks-coffee');await picks.nth(3).selectOption('the-venti');assert.equal(await p.locator('[data-v49-compare-count]').innerText(),'4개');assert.equal(await p.locator('[data-v34-core-metric="cost"] [data-v34-bar]').count(),4);await p.locator('[data-v49-remove="2"]').click();assert.equal(await p.locator('[data-v49-compare-count]').innerText(),'3개');await p.locator('[data-v49-compare-clear]').click();assert.equal(await p.locator('[data-v49-compare-count]').innerText(),'0개');
  });
  await test('Compare duplicate search is rejected',async p=>{
    await open(p,'/compare/?a=mega-mgc-coffee&b=compose-coffee');await p.locator('[data-v46-compare-search]').fill('메가MGC커피');await p.locator('[data-v46-compare-add-button]').click();assert((await p.locator('[data-v46-compare-note]').innerText()).includes('이미 선택'));assert.equal(await p.locator('[data-v49-compare-count]').innerText(),'2개');
  });
  await test('Missing average sales does not become zero',async p=>{
    const b=snapshot.brands.find(b=>b.sales===null);assert(b,'missing-sales fixture');await open(p,`/compare/?a=${encodeURIComponent(b.slug)}&b=mega-mgc-coffee`);const bars=p.locator('[data-v34-bar="sales"]');assert.equal(await bars.first().getAttribute('data-v34-value'),'null');assert(!(await bars.first().innerText()).includes('0만원'));
  });
  await test('Budget and category deep link applies actual filters',async p=>{
    await open(p,'/explore/?budget=10000&cat=cafe#finder');const rows=await p.locator('[data-budget-row]').evaluateAll(rows=>rows.filter(r=>!r.hidden).map(r=>({cost:Number(r.dataset.cost),cat:r.dataset.cat})));assert(rows.length>0);assert(rows.every(r=>r.cost<=10000&&r.cat==='cafe'));await p.locator('[data-budget-form] [name=budget]').fill('1');assert.equal(await p.locator('[data-budget-count]').innerText(),'0개');assert(await p.locator('[data-budget-empty]').isVisible());
  });
  await test('Startup summary agrees with official plus entered costs and reset',async p=>{
    await open(p,'/tools/startup-cost/?brand=mega-mgc-coffee');const official=snapshot.brands.find(b=>b.slug==='mega-mgc-coffee').cost;for(const [name,v] of Object.entries({lease:2000,premium:500,construction:300,inventory:100,working:600}))await p.locator(`[data-v36-startup] [name=${name}]`).fill(String(v));assert.equal(number(await p.locator('[data-v49-startup-extra]').innerText()),3500);assert.equal(number(await p.locator('[data-v49-startup-total]').innerText()),Math.round(official+3500));assert.equal(number(await p.locator('[data-v36-derived="prep"]').innerText()),Math.round(official+3500));await p.locator('[data-v49-startup-reset]').click();assert.equal(number(await p.locator('[data-v49-startup-extra]').innerText()),0);assert.equal(await p.locator('[data-v36-brand]').inputValue(),'mega-mgc-coffee');
  });
  await test('Startup shared URL restores additional inputs after reload',async p=>{
    await open(p,'/tools/startup-cost/?brand=mega-mgc-coffee');await p.locator('[data-v36-startup] [name=lease]').fill('2345');await p.locator('[data-v36-startup] [name=working]').fill('600');await p.reload({waitUntil:'domcontentloaded'});await settle(p);assert.equal(await p.locator('[data-v36-startup] [name=lease]').inputValue(),'2345');assert.equal(await p.locator('[data-v36-startup] [name=working]').inputValue(),'600');
  });
  await test('Monthly profit arithmetic with valid cost assumptions',async p=>{
    await open(p,'/tools/monthly-profit-simulator/');for(const [name,value]of Object.entries({revenue:3000,materialRate:35,platformRate:10,royaltyRate:2,labor:500,rent:200,utilities:50,other:40}))await p.locator(`form[data-tool="monthly-profit-v10"] [name=${name}]`).fill(String(value));assert.equal(number(await p.locator('[data-profit-variable]').innerText()),1410);assert.equal(number(await p.locator('[data-profit-fixed]').innerText()),790);assert.equal(number(await p.locator('[data-profit-balance]').innerText()),800);assert.equal(number(await p.locator('[data-profit-breakeven]').innerText()),1491);
  });
  await test('Monthly profit must not silently cap cost ratio above 100 percent',async p=>{
    await open(p,'/tools/monthly-profit-simulator/');for(const[name,v]of Object.entries({revenue:1000,materialRate:80,platformRate:30,royaltyRate:10,labor:100}))await p.locator(`form[data-tool="monthly-profit-v10"] [name=${name}]`).fill(String(v));const balance=await p.locator('[data-profit-balance]').innerText(),explanation=await p.locator('[data-result-interpretation]').innerText();assert(number(balance)===-300||(/입력|확인|계산/.test(balance)&&/100|120|비율/.test(explanation)),`120% costs must be -300 or explicitly invalid, got ${balance} / ${explanation}`);
  });
  await test('Monthly fixed-cost reserve and query reload',async p=>{
    await open(p,'/tools/monthly-fixed-cost/');const form=p.locator('form[data-tool="monthly-fixed-cost-v11"]');await form.locator('[name=rent]').fill('200');await form.locator('[name=labor]').fill('500');const months=form.locator('[name=reserveMonths]');if(await months.evaluate(e=>e.tagName)==='SELECT')await months.selectOption('3');else await months.fill('3');assert.equal(number(await p.locator('[data-fixed-monthly]').innerText()),700);assert.equal(number(await p.locator('[data-fixed-reserve]').innerText()),2100);await p.reload({waitUntil:'domcontentloaded'});assert.equal(await form.locator('[name=rent]').inputValue(),'200');
  });
  await test('Investment recovery arithmetic',async p=>{
    await open(p,'/tools/break-even/');const form=p.locator('[data-tool="break-even"]');for(const[name,v]of Object.entries({investment:10000,revenue:2000,material:40,labor:500,rent:200,other:100}))await form.locator(`[name=${name}]`).fill(String(v));assert((await form.locator('[data-result]').innerText()).includes('25.0'));await form.locator('[name=revenue]').fill('0');assert((await form.locator('[data-result]').innerText()).includes('계산하지 않음'));
  });
  await test('Open-close rates and zero denominator',async p=>{
    await open(p,'/tools/open-close-rate/');const form=p.locator('[data-tool="open-close"]');for(const[name,v]of Object.entries({base:100,new:15,end:3,cancel:2}))await form.locator(`[name=${name}]`).fill(String(v));const t=await form.locator('[data-result]').innerText();assert(t.includes('15.0%')&&t.includes('5.0%'));await form.locator('[name=base]').fill('0');assert((await form.locator('[data-result]').innerText()).includes('기준 점포'));
  });
  await test('Category-median calculator uses the same trusted sample',async p=>{
    await open(p,'/tools/category-median/');const select=p.locator('form[data-tool="category-median-v11"] [name=brand]');const option=await select.locator('option').evaluateAll(options=>options.find(o=>o.textContent.includes('메가'))?.value);assert(option);await select.selectOption(option);const b=snapshot.brands.find(b=>b.slug==='mega-mgc-coffee'),c=snapshot.categories[b.categorySlug];assert.equal(number(await p.locator('[data-cm-cost]').innerText()),Math.round(b.cost));assert.equal(number(await p.locator('[data-cm-median]').innerText()),Math.round(c.cost.median));assert.equal(number(await p.locator('[data-cm-sample]').innerText()),c.cost.count);
  });
  await test('Brand-filter does not expose untrusted catalog rows',async p=>{
    await open(p,'/tools/brand-filter/');assert.equal(await p.locator('[data-v50-trusted-card="1"]').count(),snapshot.brand_count);assert((await p.locator('#conditionCount').innerText()).includes(String(snapshot.brand_count)));
  });
  await test('Brand detail handoff retains the selected brand',async p=>{
    await open(p,longest.route);const encoded=encodeURIComponent(longest.slug);const a=p.locator(`a[href*="/compare/?a=${encoded}"]`).first();await a.click();assert.equal(await p.locator('[data-v34-pick]').first().inputValue(),longest.slug);await open(p,longest.route);await p.locator(`a[href*="/tools/startup-cost/?brand=${encoded}"]`).first().click();assert.equal(await p.locator('[data-v36-brand]').inputValue(),longest.slug);
  });
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA||null,uiVersion:manifest.uiVersion,browser:'Chromium',browserVersion,mode:'localhost serving checked-out production-equivalent preview files',viewportWidths:widths,layoutTotal:layout.length,layoutPassed:layout.filter(x=>x.status==='PASS').length,journeyTotal:journeys.length,journeyPassed:journeys.filter(x=>x.status==='PASS').length,uncaughtErrors:errors,failedRequests,layout,journeys,productionDeployed:false,visualHumanReview:'Screenshots are evidence, not an assertion that every pixel was manually reviewed.'};
  report.status=report.layoutPassed===report.layoutTotal&&report.journeyPassed===report.journeyTotal&&report.layoutTotal===100?'PASS':'FAIL';
  report.assetHashes={};for(const file of ['assets/site.css','assets/app.js','assets/v46-workflow-ux.js','assets/v49-bulk-usability.js'])report.assetHashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
  await fs.writeFile(path.join(results,'report.json'),JSON.stringify(report,null,2));
  const fails=[...layout.filter(x=>x.status==='FAIL').map(x=>`${x.width}px ${x.route}: ${x.error}`),...journeys.filter(x=>x.status==='FAIL').map(x=>`${x.name}: ${x.error}`)];
  const md=`# Franchise browser QA\n\nStatus: ${report.status}\n\nSource commit: ${report.sourceCommit}\n\nUI: ${report.uiVersion}; Chromium: ${browserVersion}\n\nViewport cases: ${report.layoutPassed}/${report.layoutTotal}\n\nFunctional journeys: ${report.journeyPassed}/${report.journeyTotal}\n\n## Failures\n${fails.map(x=>'- '+x).join('\n')||'None'}\n\nNo deployment or indexing change was performed. Screenshots are in the artifact. External image request failures are reported separately.\n`;
  await fs.writeFile(path.join(results,'SUMMARY.md'),md);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,md);
  console.log(JSON.stringify({status:report.status,layout:`${report.layoutPassed}/${report.layoutTotal}`,journeys:`${report.journeyPassed}/${report.journeyTotal}`,failures:fails},null,2));
  if(report.status!=='PASS')process.exitCode=1;
}

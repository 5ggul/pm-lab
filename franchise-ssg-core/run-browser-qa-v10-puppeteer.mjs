import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const root=path.join(repo,'docs/franchise-ssg-preview');
const prefix='/pm-lab/franchise-ssg-preview';
const screenshots=path.join(repo,'v10-qa-screenshots');
await fs.rm(screenshots,{recursive:true,force:true});
await fs.mkdir(screenshots,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=http.createServer(async(req,res)=>{try{let u=new URL(req.url,'http://127.0.0.1').pathname;if(u.startsWith(prefix))u=u.slice(prefix.length)||'/';let rel=decodeURIComponent(u).replace(/^\/+/,''),file=path.join(root,rel);const st=await fs.stat(file).catch(()=>null);if(st?.isDirectory())file=path.join(file,'index.html');else if(!st&&u.endsWith('/'))file=path.join(file,'index.html');const data=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="ko"><head><title>404</title></head><body><main><h1>페이지를 찾을 수 없습니다</h1></main></body></html>')}});
await new Promise(r=>server.listen(4177,'127.0.0.1',r));

const candidates=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
let executablePath='';for(const p of candidates){try{await fs.access(p);executablePath=p;break}catch{}}
if(!executablePath)throw new Error('Chrome/Chromium executable not found');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check']});
const routes=[['home','/'],['brands','/brands/'],['mega','/brands/mega-mgc-coffee/'],['compose','/brands/compose-coffee/'],['category-cafe','/categories/cafe/'],['compare','/compare/mega-mgc-coffee-vs-compose-coffee/'],['tools','/tools/'],['startup','/tools/startup-cost/'],['profit','/tools/monthly-profit-simulator/'],['pillar','/guide/low-price-coffee/'],['sources','/sources/'],['about','/about/'],['404','/does-not-exist/']];
const viewports=[320,360,375,390,430,768,1024,1280,1440];
const results=[];
try{
  for(const [name,route] of routes){
    const page=await browser.newPage();
    const consoleErrors=[];const failedResources=[];
    page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
    page.on('pageerror',err=>consoleErrors.push(String(err?.message||err)));
    page.on('requestfailed',req=>failedResources.push(`${req.url()} :: ${req.failure()?.errorText||'failed'}`));
    page.on('response',resp=>{if(name!=='404'&&resp.status()>=400)failedResources.push(`${resp.url()} :: HTTP ${resp.status()}`)});
    for(const width of viewports){
      await page.setViewport({width,height:1000,deviceScaleFactor:1,isMobile:false,hasTouch:false});
      const target=`http://127.0.0.1:4177${prefix}${route}`;
      const response=await page.goto(target,{waitUntil:'networkidle0',timeout:20000});
      await new Promise(r=>setTimeout(r,80));
      const metrics=await page.evaluate(()=>{
        const W=window.innerWidth,doc=document.documentElement;
        const overflow=[...document.querySelectorAll('body *')].filter(el=>{
          if(el.closest('.table-scroll')||el.closest('.chart-svg'))return false;
          const s=getComputedStyle(el),r=el.getBoundingClientRect();
          if(s.display==='none'||r.width===0||r.height===0)return false;
          return r.right>W+1||r.left<-1;
        }).slice(0,12).map(el=>({tag:el.tagName,cls:String(el.className||''),id:el.id||'',left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right)}));
        const short=[...document.querySelectorAll('button,input,select,summary,.button,.nav-toggle')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&r.width>0&&r.height>0&&r.height<40}).slice(0,12).map(el=>({tag:el.tagName,cls:String(el.className||''),h:Math.round(el.getBoundingClientRect().height)}));
        const clipped=[...document.querySelectorAll('h1,h2,h3,p,button,a,th,td,label')].filter(el=>{if(el.closest('.table-scroll'))return false;const s=getComputedStyle(el);return s.display!=='none'&&(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2)&&s.overflow!=='visible'}).slice(0,12).map(el=>({tag:el.tagName,cls:String(el.className||''),text:(el.textContent||'').trim().slice(0,48)}));
        const tbodySticky=[...document.querySelectorAll('tbody th')].filter(el=>getComputedStyle(el).position==='sticky').length;
        const mobileCompare=document.querySelector('.mobile-compare');
        return {innerWidth:W,docWidth:doc.scrollWidth,bodyWidth:document.body.scrollWidth,horizontalPageScroll:doc.scrollWidth>W+1,overflow,shortTouchTargets:short,clipped,tbodySticky,h1:document.querySelectorAll('h1').length,tableScrolls:document.querySelectorAll('.table-scroll').length,mobileCompareVisible:mobileCompare?getComputedStyle(mobileCompare).display!=='none':null};
      });
      await page.screenshot({path:path.join(screenshots,`${name}-${width}.png`),fullPage:false});
      results.push({page:name,route,width,httpStatus:response?.status()??null,...metrics,consoleErrors:[...consoleErrors],failedResources:[...failedResources]});
      consoleErrors.length=0;failedResources.length=0;
    }
    await page.close();
  }
}finally{await browser.close();server.close()}

const failures=[];
for(const r of results){
  if(r.page==='404'){if(r.httpStatus!==404)failures.push(`404@${r.width}: expected HTTP 404, got ${r.httpStatus}`);continue}
  if(r.httpStatus!==200)failures.push(`${r.page}@${r.width}: HTTP ${r.httpStatus}`);
  if(r.horizontalPageScroll)failures.push(`${r.page}@${r.width}: horizontal page scroll ${r.docWidth}>${r.innerWidth}`);
  if(r.overflow.length)failures.push(`${r.page}@${r.width}: overflow ${JSON.stringify(r.overflow.slice(0,3))}`);
  if(r.shortTouchTargets.length)failures.push(`${r.page}@${r.width}: short interactive ${JSON.stringify(r.shortTouchTargets.slice(0,3))}`);
  if(r.clipped.length)failures.push(`${r.page}@${r.width}: clipped ${JSON.stringify(r.clipped.slice(0,3))}`);
  if(r.tbodySticky)failures.push(`${r.page}@${r.width}: tbody sticky ${r.tbodySticky}`);
  if(r.h1!==1)failures.push(`${r.page}@${r.width}: H1 ${r.h1}`);
  if(r.consoleErrors.length)failures.push(`${r.page}@${r.width}: console ${r.consoleErrors.slice(0,3).join('; ')}`);
  if(r.failedResources.length)failures.push(`${r.page}@${r.width}: failed resources ${r.failedResources.slice(0,3).join('; ')}`);
  if(r.page==='compare'&&r.width<=430&&r.mobileCompareVisible!==true)failures.push(`${r.page}@${r.width}: mobile comparison is not visible`);
}
const report={schemaVersion:2,generatedAt:new Date().toISOString(),executablePath,viewports,pages:routes.map(x=>x[0]),checks:results.length,failures,results};
await fs.writeFile(path.join(repo,'v10-browser-qa.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v10BrowserQA:failures.length?'FAIL':'PASS',checks:results.length,failures:failures.slice(0,30),screenshots:path.relative(repo,screenshots)},null,2));
if(failures.length)process.exitCode=1;
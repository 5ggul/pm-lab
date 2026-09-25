import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {siteConfig} from './site-config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),mount=new URL(siteConfig.baseUrl).pathname;
const host=fs.readFileSync(new URL('../../404.html',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),relative=url.pathname.startsWith(mount)?url.pathname.slice(mount.length):url.pathname.slice(1);
 let file=path.resolve(root,relative);if(file!==path.resolve(root)&&!file.startsWith(root)){res.writeHead(403);res.end();return}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file))}
 catch{res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end(host)}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),evidence=[];
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [375,390,430,768,1280,1440])for(const route of ['/404.html',mount+'cars/not-a-real-car/deep/']) {
  await page.setViewportSize({width,height:900});
  const response=await page.goto(origin+route);
  assert.equal(response.status(),route==='/404.html'?200:404);
  assert.equal(await page.locator('h1').count(),1);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const links=page.locator('main .error-actions a');assert.equal(await links.count(),2);
  const boxes=await links.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
  const [a,b]=boxes;assert(a.height>=44&&b.height>=44);
  assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),'404 controls overlap');
  for(const method of ['click','keyboard'])for(let i=0;i<2;i++) {
   await page.goto(origin+route);const link=page.locator('main .error-actions a').nth(i),destination=await link.getAttribute('href');
   const expected=new URL(destination,page.url()).href;
   assert.equal(new URL(expected).pathname,(route==='/404.html'?'/':mount)+(i?'cars/':''));
   if(method==='click')await link.click();
   else {await page.locator('main .error-actions a').first().focus();if(i)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.href),expected);await page.keyboard.press('Enter')}
   await page.waitForURL(expected,{waitUntil:'domcontentloaded',timeout:10000}).catch(error=>{throw new Error(JSON.stringify({width,route,method,i,expected,actual:page.url()})+' '+error.message)});
  }
  evidence.push({width,route,boxes,overlap:false,click:true,keyboard:true});
 }
 assert.deepEqual(errors,[]);
 fs.mkdirSync('output/review/full-service',{recursive:true});fs.writeFileSync('output/review/full-service/host-404-ui.json',JSON.stringify(evidence,null,2));
 console.log('PASS site and host 404 at six widths: 12 layouts, 48 independent click/keyboard recoveries');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve))}

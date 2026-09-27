import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(fileURLToPath(new URL('../../../build/peekmycar-production/',import.meta.url)));
const origin='https://peekmycar.com/';
const report=JSON.parse(fs.readFileSync(new URL('../data/index-quality-gate.json',import.meta.url),'utf8'));
let checked=0;
for(const entry of report.pages){
 const rel=entry.path.endsWith('/')?entry.path.slice(1)+'index.html':entry.path.slice(1);
 const html=fs.readFileSync(path.join(root,rel),'utf8');
 assert(!html.includes('https://5ggul.github.io/pm-lab/car-data-preview/'),rel+' old canonical');
 assert(!html.includes('내차데이터'),rel+' old brand');
 assert(html.includes('assets/brand/favicon-96.png'),rel+' icon');
 if(entry.status==='release_ready'){
  assert(html.includes('content="index,follow,max-image-preview:large"'),rel+' index');
  assert(html.includes(`rel="canonical" href="${new URL(entry.path,origin)}"`),rel+' canonical');
 }else assert(html.includes('noindex'),rel+' excluded');
 for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))JSON.parse(m[1]);
 checked++;
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
assert.equal((sitemap.match(/<loc>/g)||[]).length,report.summary.release_ready);
for(const entry of report.pages.filter(p=>p.status!=='release_ready'))assert(!sitemap.includes(`<loc>${new URL(entry.path,origin)}</loc>`));
assert(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes('Sitemap: '+origin+'sitemap.xml'));
assert(!fs.existsSync(path.join(root,'data/raw')));
assert(!fs.existsSync(path.join(root,'scripts')));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let f=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('content-type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}
 catch{res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end(fs.readFileSync(path.join(root,'404.html')));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;let renders=0;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage();const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [375,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['/','/cars/','/cars/hyundai/grandeur-gn7/','/compare/','/compare/sorento-vs-santafe/','/tools/annual-cost/','/rankings/','/recalls/']){
   await page.goto(base+route,{waitUntil:'load'});
   await page.locator('.site-brand-image').evaluate(img=>img.decode());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' '+width+' overflow');
   assert.equal(await page.locator('h1').count(),1,route+' h1');renders++;
  }
 }
 const response=await page.goto(base+'/cars/nonexistent/deep/');assert.equal(response.status(),404);
 await page.getByRole('link',{name:'홈으로',exact:true}).click();assert.equal(page.url(),base+'/');
 const icon=await page.request.get(base+'/assets/brand/favicon-96.png');assert.equal(icon.status(),200);
 console.log(JSON.stringify({productionPages:checked,rootRenders:renders,sitemapEntries:report.summary.release_ready,failures:0}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

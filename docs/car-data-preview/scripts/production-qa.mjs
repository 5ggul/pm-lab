import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {assertInformationalSchema} from './informational-schema.mjs';

const root=path.resolve(fileURLToPath(new URL('../../../build/peekmycar-production/',import.meta.url)));
const origin='https://peekmycar.com/';
const report=JSON.parse(fs.readFileSync(new URL('../data/index-quality-gate.json',import.meta.url),'utf8'));
let checked=0;
for(const entry of report.pages){
 const rel=entry.path.endsWith('/')?entry.path.slice(1)+'index.html':entry.path.slice(1);
 const html=fs.readFileSync(path.join(root,rel),'utf8');
 assert.equal((html.match(/id="peekmycar-analytics"/g)||[]).length,1,rel+' analytics tag');
 assert(html.includes('G-9LMZK1MJ41'),rel+' analytics measurement ID');
 assert(!html.includes('https://5ggul.github.io/pm-lab/car-data-preview/'),rel+' old canonical');
 assert(!html.includes('내차데이터'),rel+' old brand');
 assert(html.includes('assets/brand/favicon-96.png'),rel+' icon');
 if(entry.status==='release_ready'){
  assert(html.includes('content="index,follow,max-image-preview:large"'),rel+' index');
  assert(html.includes(`rel="canonical" href="${new URL(entry.path,origin)}"`),rel+' canonical');
 }else assert(html.includes('noindex'),rel+' excluded');
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g))assertInformationalSchema(JSON.parse(m[1]));
 checked++;
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
assert.equal((sitemap.match(/<loc>/g)||[]).length,report.summary.release_ready);
for(const entry of report.pages.filter(p=>p.status!=='release_ready'))assert(!sitemap.includes(`<loc>${new URL(entry.path,origin)}</loc>`));
assert(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes('Sitemap: '+origin+'sitemap.xml'));
assert(!fs.existsSync(path.join(root,'data/raw')));
assert(!fs.existsSync(path.join(root,'scripts')));
const headers=fs.readFileSync(path.join(root,'_headers'),'utf8');
assert(headers.includes('/community/*\n  X-Robots-Tag: noindex, nofollow, noarchive'));
assert(headers.includes('https://peekmycar.pages.dev/*\n  X-Robots-Tag: noindex'));
assert(headers.includes('X-Content-Type-Options: nosniff'));
assert(fs.readFileSync(path.join(root,'_redirects'),'utf8').includes('https://www.peekmycar.com/* https://peekmycar.com/:splat 301'));
assert(!fs.existsSync(path.join(root,'.vercel')));
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(fs.readFileSync(path.join(root,'privacy/index.html'),'utf8').includes('Google Analytics 4'));
for(const rel of ['community/index.html','404.html'])assert.equal((fs.readFileSync(path.join(root,rel),'utf8').match(/id="peekmycar-analytics"/g)||[]).length,1,rel+' analytics tag');
for(const [name,value] of Object.entries({'google-site-verification':'cf3JAkkg0CRbxH3Ca-2oeZ_WvRRadX4wc9TsQHBYwKc','naver-site-verification':'880621f4f133970ab62d9be0a296e5c6dbb77a57'})){
 const tags=[...home.matchAll(new RegExp('<meta name="'+name+'" content="([^"]+)">','g'))];
 assert.equal(tags.length,1);assert.equal(tags[0][1],value);assert(home.indexOf(tags[0][0])<home.indexOf('</head>'));
}
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
  for(const route of ['/','/cars/','/cars/hyundai/grandeur-gn7/','/compare/','/compare/sorento-vs-santafe/','/tools/annual-cost/','/rankings/','/recalls/','/community/','/recalls/recall-6380/']){
   await page.goto(base+route,{waitUntil:'load'});
   await page.locator('.site-brand-image').evaluate(img=>img.decode());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' '+width+' overflow');
   assert.equal(await page.locator('h1').count(),1,route+' h1');renders++;
   assert.equal(await page.locator('.db-nav a').filter({hasText:'커뮤니티'}).count(),1,route+' community navigation');
   if(route==='/community/'){assert((await page.locator('meta[name=robots]').getAttribute('content')).includes('noindex'));assert.equal(await page.locator('.board-tabs button').count(),3);}
   if(route==='/recalls/recall-6380/'){assert(!(await page.locator('.recall-details').getAttribute('open')));assert(!(await page.getByRole('heading',{name:'결함 내용',exact:true}).isVisible()));await page.locator('.recall-details summary').click();assert(await page.getByRole('heading',{name:'결함 내용',exact:true}).isVisible());}
  }
 }
 await page.goto(base+'/compare/sorento-vs-santafe/');
 await page.locator('#decision-km').fill('30000');
 await page.waitForFunction(()=>document.querySelector('.compare-legend small')?.textContent==='연 30,000km');
 const changedAmount=await page.locator('#decision-a').textContent();
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('.compare-legend small')?.textContent==='연 30,000km');
 assert.equal(await page.locator('#decision-a').textContent(),changedAmount,'Reload must preserve both amount and distance label');
 await page.locator('#decision-km').fill('');
 assert.equal(await page.locator('.compare-legend small').textContent(),'거리와 단가 확인');
 const response=await page.goto(base+'/cars/nonexistent/deep/');assert.equal(response.status(),404);
 await page.getByRole('link',{name:'홈으로',exact:true}).click();assert.equal(page.url(),base+'/');
 const icon=await page.request.get(base+'/assets/brand/favicon-96.png');assert.equal(icon.status(),200);
 console.log(JSON.stringify({productionPages:checked,rootRenders:renders,sitemapEntries:report.summary.release_ready,failures:0}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

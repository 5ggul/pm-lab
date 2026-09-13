import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue}
 if(file.endsWith('.html'))html.push(file);
}}
walk(root);
for(const file of html){
 const source=fs.readFileSync(file,'utf8');
 assert.match(source,/assets\/premium-data-ui\.css\?v=[a-f0-9]{10}/,path.relative(root,file));
}
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.CAR_PREVIEW_CHROME_PATH?{headless:true,executablePath:process.env.CAR_PREVIEW_CHROME_PATH}:{headless:true});
try{
 for(const width of [360,375,390,430,1280]){
  const page=await browser.newPage({viewport:{width,height:width<700?812:900}});
  for(const route of ['/','/cars/','/cars/hyundai/grandeur-gn7/','/compare/sorento-vs-santafe/','/tools/annual-cost/','/rankings/fuel-economy/']){
   await page.goto(base+route,{waitUntil:'networkidle'});
   const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
   assert(overflow<=1,`${route} overflows ${overflow}px at ${width}px`);
  }
  if(width===375){
   await page.goto(base+'/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.hero-data-stream>span').count(),3);
   assert.equal(await page.locator('.home-car').count(),6);
   assert.equal(await page.locator('.home-car').first().evaluate(el=>getComputedStyle(el).opacity),'1');
   assert.match(await page.locator('.hero-data-stream').innerText(),/공식 표시연비/);
   assert.match(await page.locator('.hero-data-stream').innerText(),/계산 자동차세/);
  }
  await page.close();
 }
}finally{await browser.close()}
console.log(`PASS premium data UI: ${html.length} pages, six core routes, 360/375/390/430/1280px.`);

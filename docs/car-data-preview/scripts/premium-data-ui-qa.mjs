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
 for(const width of [360,375,390,430,768,1280,1440]){
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
   const heroKpis=await page.locator('.hero-data-stream').innerText();
   assert.match(heroKpis,/아이오닉 6 · 공식 복합전비/);
   assert.match(heroKpis,/전기 승용 신차 · 자동차세/);
   assert.match(heroKpis,/기본형 2WD 18인치 · 주행거리/);
   assert.doesNotMatch(heroKpis,/11\.7 km\/L|649,220원|3,177/);
   await page.goto(base+'/rankings/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.rank-hub-hero .ranking-scope').count(),1);
   assert.equal(await page.locator('.rank-hub-hero .db-kicker').count(),0);
   await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
   const inactive=page.locator('.mode-switch button:not(.active)').first();
   const contrast=await inactive.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
   assert.notEqual(contrast.color,contrast.background);
   assert.equal(await page.locator('.page-hero .db-kicker').count(),0);
  }
  await page.goto(base+'/',{waitUntil:'networkidle'});
  const searchGeometry=await page.evaluate(()=>{
   const form=document.querySelector('.showroom-home .db-search');
   const input=form?.querySelector('input');
   const button=form?.querySelector('button');
   if(!form||!input||!button)return null;
   const f=form.getBoundingClientRect();
   const i=input.getBoundingClientRect();
   const b=button.getBoundingClientRect();
   return {form:{left:f.left,right:f.right},input:{left:i.left,right:i.right},button:{left:b.left,right:b.right}};
  });
  assert(searchGeometry,`home search controls missing at ${width}px`);
  assert(searchGeometry.input.right+8<=searchGeometry.button.left,`home search input and button overlap at ${width}px`);
  assert(searchGeometry.input.left>=searchGeometry.form.left-1&&searchGeometry.button.right<=searchGeometry.form.right+1,`home search controls escape form at ${width}px`);
  await page.close();
 }
}finally{await browser.close()}
console.log(`PASS premium data UI: ${html.length} pages, six core routes, 360/375/390/430/768/1280/1440px, search controls separated.`);

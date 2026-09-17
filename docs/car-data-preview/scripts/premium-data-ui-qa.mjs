import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const officialSpecDate=JSON.parse(fs.readFileSync(path.join(root,'data/generated/service-hierarchy.json'),'utf8')).source_fetched_at.slice(0,10);
const labelContext={};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/spec-label.js'),'utf8'),labelContext);
const calcRows=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-calc-index.json'),'utf8')).rows;
const rowGroups=new Map();
for(const row of calcRows){
 const key=`${row.family_id}|${row.generation_label}`;
 if(!rowGroups.has(key))rowGroups.set(key,[]);
 rowGroups.get(key).push(row);
}
for(const [key,rows] of rowGroups){
 const labels=labelContext.CAR_SPEC_LABELS.optionLabels(rows);
 assert.equal(new Set(labels).size,labels.length,`duplicate option labels in ${key}`);
}
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
function contrastAgainstWhite(cssColor){
 const rgb=cssColor.match(/[\d.]+/g)?.slice(0,3).map(Number);
 assert(rgb?.length===3,`unsupported text color: ${cssColor}`);
 const luminance=rgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 return 1.05/(luminance+.05);
}
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
   const calculatorLabels=await page.locator('#sourceRow option').allTextContents();
   assert(calculatorLabels.length>0,'calculator source options missing');
   assert.equal(new Set(calculatorLabels).size,calculatorLabels.length,'calculator source option labels repeat');
   await page.goto(base+'/compare/',{waitUntil:'networkidle'});
   for(const side of ['A','B']){
    const labels=await page.locator(`#row${side} option`).allTextContents();
    assert(labels.length>0,`comparison ${side} source options missing`);
    assert.equal(new Set(labels).size,labels.length,`comparison ${side} source option labels repeat`);
   }
  }
  if(width===375||width===1280){
   await page.goto(base+'/',{waitUntil:'networkidle'});
   const homeScopeColor=await page.locator('.showroom-home .rank-scope').evaluate(el=>getComputedStyle(el).color);
   assert(contrastAgainstWhite(homeScopeColor)>=4.5,`home scope text contrast below 4.5:1 at ${width}px`);
   await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
   const benchmarkColor=await page.locator('.benchmark-rank').evaluate(el=>getComputedStyle(el).color);
   assert(contrastAgainstWhite(benchmarkColor)>=4.5,`benchmark rank text contrast below 4.5:1 at ${width}px`);
   for(const route of ['/cars/hyundai/grandeur-gn7/','/cars/kia/sorento-mq4/','/cars/hyundai/tucson-nx4/','/cars/hyundai/ioniq-5/','/cars/kia/ev6/','/cars/genesis/g80-rg3/']){
    await page.goto(base+route,{waitUntil:'networkidle'});
    const keyline=page.locator('.vehicle-keyline');
    if(await keyline.count()){
     const color=await keyline.evaluate(el=>getComputedStyle(el).color);
     assert(contrastAgainstWhite(color)>=4.5,`${route} keyline text contrast below 4.5:1 at ${width}px`);
    }
   }
   await page.goto(base+'/cars/hyundai/tucson-nx4/',{waitUntil:'networkidle'});
   assert.equal((await page.locator('h1').innerText()).trim(),'투싼');
   assert.match(await page.locator('.pm-photo figcaption').innerText(),/1\.6 터보 하이브리드 외관 사진 · 위 선택 사양 수치와 별개/);
   for(const [route,spec] of [['/cars/kia/sorento-mq4/','1.6 터보 하이브리드'],['/cars/genesis/g80-rg3/','3.5 터보 AWD'],['/compare/sorento-gasoline-vs-hybrid/','1.6 터보 하이브리드']]){
    await page.goto(base+route,{waitUntil:'networkidle'});
    assert.match(await page.locator('body').innerText(),new RegExp(`사진 속 사양: ${spec}`),`${route} photo specification missing`);
   }
   await page.goto(base+'/rankings/fuel-economy/',{waitUntil:'networkidle'});
   assert.match(await page.locator('.rank-scope').innerText(),new RegExp(`공식 사양 ${officialSpecDate}`));
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

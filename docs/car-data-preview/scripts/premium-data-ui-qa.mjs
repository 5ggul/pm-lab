import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const grandeurTotal=catalog.cars.find(car=>car.id==='grandeur-gn7').rep.total.toLocaleString('ko-KR')+'원';
const labelContext={};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/spec-label.js'),'utf8'),labelContext);
const rows=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-calc-index.json'),'utf8')).rows;
const groups=new Map();
for(const row of rows){const key=`${row.family_id}|${row.generation_label}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
for(const [key,group] of groups){const labels=labelContext.CAR_SPEC_LABELS.optionLabels(group);assert.equal(new Set(labels).size,labels.length,`duplicate option labels in ${key}`)}

const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue}
 if(file.endsWith('.html'))files.push(file);
}}
walk(root);
const pageStyles=['home.css','cars.css','detail.css','compare.css','rankings.css','recalls.css','tools.css'];
for(const file of files){
 const html=fs.readFileSync(file,'utf8'),rel=path.relative(root,file);
 assert.match(html,/assets\/tokens\.css/,`${rel} tokens missing`);
 assert.match(html,/assets\/base\.css/,`${rel} base missing`);
 assert((html.match(/static-photo-fallback\.js/g)||[]).length<=1,`${rel} repeats photo fallback`);
 assert((pageStyles.filter(name=>html.includes(`assets/${name}`))).length<=1,`${rel} loads more than one page stylesheet`);
 assert.doesNotMatch(html,/premium-data-ui\.css|motion-ui\.css|studio-ui\.css|showroom-ui\.css|clear-ui\.css|page-design\.css/,`${rel} loads a retired skin`);
}

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const executablePath=process.env.CAR_PREVIEW_CHROME_PATH||process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 for(const width of [360,375,390,430,768,1280,1440]){
  const page=await browser.newPage({viewport:{width,height:width<700?812:900}});
  for(const route of ['/','/cars/','/cars/hyundai/grandeur-gn7/','/compare/sorento-vs-santafe/','/tools/annual-cost/','/rankings/fuel-economy/']){
   await page.goto(base+route,{waitUntil:'networkidle'});
   assert(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth<=1),`${route} overflows at ${width}px`);
  }
  await page.goto(base+'/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.home-car').count(),6);
  assert.equal(await page.locator('.hero-data-stream,.motion-reveal').count(),0);
  assert((await page.locator('.home-car').first().innerText()).includes(grandeurTotal));
  const geometry=await page.evaluate(()=>{const form=document.querySelector('.editorial-home .db-search'),input=form?.querySelector('input'),button=form?.querySelector('button');if(!form||!input||!button)return null;const f=form.getBoundingClientRect(),i=input.getBoundingClientRect(),b=button.getBoundingClientRect();return {fl:f.left,fr:f.right,ir:i.right,bl:b.left,br:b.right}});
  assert(geometry,`home search missing at ${width}px`);
  assert(geometry.ir<=geometry.bl+1&&geometry.br<=geometry.fr+1&&geometry.bl>=geometry.fl-1,`home search overlaps at ${width}px`);
  if(width===375){
   await page.goto(base+'/tools/annual-cost/',{waitUntil:'networkidle'});
   assert(await page.locator('#reviewedMode').evaluate(el=>el.classList.contains('active')));
   const calculatorLabels=await page.locator('#sourceRow option').allTextContents();
   assert(calculatorLabels.length>0&&new Set(calculatorLabels).size===calculatorLabels.length);
   await page.goto(base+'/compare/',{waitUntil:'networkidle'});
   for(const side of ['A','B']){const labels=await page.locator(`#row${side} option`).allTextContents();assert(labels.length>0&&new Set(labels).size===labels.length)}
  }
  await page.close();
 }
}finally{await browser.close()}
console.log(`PASS unified data UI: ${files.length} pages, one token system, responsive core routes and decision-first home.`);

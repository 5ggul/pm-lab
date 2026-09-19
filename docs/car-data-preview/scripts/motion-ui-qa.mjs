import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.doesNotMatch(home,/hero-data-stream|hero-signal-icon|motion-ui\.(?:css|js)|motion-reveal|<small>0[123]<\/small>/);

function walk(dir,files=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file,files)}
 else if(file.endsWith('.html'))files.push(file);
}return files}
for(const file of walk(root)){
 const html=fs.readFileSync(file,'utf8');
 assert.doesNotMatch(html,/숫자를\s+읽는\s+기준|motion-ui\.(?:css|js)|motion-reveal/,path.relative(root,file));
}

const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(`${base}/`,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.locator('.home-car').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.editorial-hero').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.goto(`${base}/rankings/annual-energy-cost/`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.rank-row').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.close();
 }
}finally{await browser.close()}
console.log('PASS motion UI removal: no decorative load motion, no motion assets and responsive static content.');

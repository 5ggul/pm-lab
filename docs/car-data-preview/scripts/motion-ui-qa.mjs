import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(home,/class="hero-data-stream"/);
assert.equal((home.match(/class="hero-signal-icon"/g)||[]).length,3);
assert.match(home,/assets\/motion-ui\.css\?v=/);
assert.match(home,/assets\/motion-ui\.js\?v=/);

function walk(dir,files=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file,files)}
 else if(file.endsWith('.html'))files.push(file);
}return files}
for(const file of walk(root))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/숫자를\s+읽는\s+기준/,path.relative(root,file));

const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(`${base}/`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.hero-data-stream>span').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.notEqual(await page.locator('.hero-signal-icon').first().evaluate(el=>getComputedStyle(el.querySelector('path')).animationName),'none');
  await page.goto(`${base}/rankings/annual-energy-cost/`,{waitUntil:'networkidle'});
  const first=page.locator('.rank-row').first();await first.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.rank-row')?.classList.contains('is-visible'));
  assert.equal(await first.getAttribute('class'),'rank-row motion-reveal is-visible');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.close();
 }
 const reduced=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
 await reduced.goto(`${base}/`,{waitUntil:'networkidle'});
 assert.equal(await reduced.locator('.hero-photograph').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
 assert.equal(await reduced.locator('.home-car').first().evaluate(el=>getComputedStyle(el).opacity),'1');
 await reduced.close();
}finally{await browser.close()}
console.log('PASS motion UI: homepage data signal, one-shot reveals, responsive layout, no-JS source visibility and reduced-motion fallback.');

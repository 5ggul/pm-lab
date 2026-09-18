import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const routes=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()&&entry.name!=='qa')walk(file);
  else if(entry.name==='index.html')routes.push(path.relative(root,path.dirname(file)).replaceAll('\\','/'));
 }
}
walk(root);
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:375,height:812}});
const errors=[],failures=[];
page.on('pageerror',error=>errors.push(`${page.url()}: ${error.message}`));
try{
 for(const width of [375,1280])for(const route of routes){
  await page.setViewportSize({width,height:width===375?812:900});
  const response=await page.goto(base+'/'+(route==='.'?'':route+'/'),{waitUntil:'load'});
  if(route==='compare/dimensions'){
   await page.waitForURL(base+'/compare/',{timeout:10000});
   continue;
  }
  let view;
  for(let attempt=0;attempt<3;attempt++){
   try{view=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length}));break;}
   catch(error){if(attempt===2)throw error;await page.waitForLoadState('load');}
  }
  if(response.status()!==200||view.scroll>view.width||view.h1!==1)failures.push({route,width,status:response.status(),...view});
 }
}finally{await browser.close();}
assert.deepEqual(failures,[]);
assert.deepEqual(errors,[]);
console.log(`All-route layout PASS: ${routes.length} routes at 375px and 1280px`);

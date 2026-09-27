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
routes.push('404.html');
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:375,height:812}});
const errors=[],failures=[];
const viewports=[{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
page.on('pageerror',error=>errors.push(`${page.url()}: ${error.message}`));
try{
 for(const viewport of viewports)for(const route of routes){
  const {width}=viewport;
  await page.setViewportSize(viewport);
  const response=await page.goto(base+'/'+(!route||route==='.'?'':route.endsWith('.html')?route:route+'/'),{waitUntil:'load'});
  if(route==='compare/dimensions'){
   await page.waitForURL(base+'/compare/',{timeout:10000});
   continue;
  }
  let view;
  for(let attempt=0;attempt<3;attempt++){
   try{view=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,internalTerms:document.body.innerText.match(/reviewed_override|raw_only|auto_high|auto_medium|confirmed_mapping|세대 미분류/g)||[]}));break;}
   catch(error){if(attempt===2)throw error;await page.waitForLoadState('load');}
  }
  if(response.status()!==200||view.scroll>view.width||view.h1!==1||view.internalTerms.length)failures.push({route,width,status:response.status(),...view});
 }
}finally{await browser.close();}
assert.deepEqual(failures,[]);
assert.deepEqual(errors,[]);
console.log(`All-route layout PASS: ${routes.length} routes at ${viewports.map(v=>`${v.width}x${v.height}`).join(', ')}`);

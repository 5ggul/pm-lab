import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Only a local preview may be tested');
const dep=process.env.SSG_QA_DEP_ROOT; assert.ok(dep,'SSG_QA_DEP_ROOT required');
const {chromium}=await import(pathToFileURL(path.join(dep,'node_modules/playwright/index.mjs')).href);
const out=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-layout-containment');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[];
async function run(name,width,route,fn){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}), item={name,width,route,pass:false};
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try{
    const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'}); assert.equal(response.status(),200);
    await page.locator('main').waitFor(); await page.evaluate(()=>document.fonts?.ready); item.evidence=await fn(page); assert.deepEqual(errors,[]); item.pass=true;
  }catch(error){item.error=error.message;} item.pageErrors=errors;
  if(!item.pass||width===390||width===1024) {item.screenshot=`${name}-${width}.png`; await page.screenshot({path:path.join(out,item.screenshot),fullPage:true,animations:'disabled'});}
  cases.push(item); console.log(JSON.stringify(item)); await page.close();
}
const rectEvidence=async(locator)=>locator.evaluate(el=>{const r=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);return{text:el.textContent.trim(),box:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,whiteSpace:getComputedStyle(el).whiteSpace,rects:[...range.getClientRects()].map(x=>({left:x.left,right:x.right,top:x.top,bottom:x.bottom}))};});
try{
  for(const width of [981,1024,1180,1440]) await run('home-freshness-rail',width,'',async page=>{
    const rail=page.locator('.v41-home-copy .v25-rail'); assert.equal(await rail.count(),1);
    const rb=await rail.boundingBox(); assert.ok(rb && rb.x>=-1 && rb.x+rb.width<=width+1,'rail outside viewport');
    const cells=page.locator('.v41-home-copy .v25-rail>div'); assert.equal(await cells.count(),4);
    const strongs=page.locator('.v41-home-copy .v25-rail strong'); assert.equal(await strongs.count(),4);
    const vals=[]; for(let i=0;i<4;i++){const e=await rectEvidence(strongs.nth(i)); vals.push(e); assert.ok(e.box.left>=rb.x-1&&e.box.right<=rb.x+rb.width+1,`KPI ${i} box clipped`); assert.ok(e.rects.every(x=>x.left>=rb.x-1&&x.right<=rb.x+rb.width+1),`KPI ${i} text clipped`);}
    assert.match(vals[3].text,/^\d{4}-\d{2}-\d{2}$/); return {rail:rb,values:vals.map(v=>v.text)};
  });
  for(const width of [360,390,430,768]) await run('home-long-category',width,'',async page=>{
    const label=page.locator('.v25-bar>span',{hasText:'베이커리·디저트'}).first(); assert.equal(await label.count(),1); const e=await rectEvidence(label);
    assert.ok(e.box.left>=-1&&e.box.right<=width+1,'category label box clipped'); assert.ok(e.rects.every(x=>x.left>=e.box.left-1&&x.right<=e.box.right+1),'category text clipped'); assert.notEqual(e.whiteSpace,'nowrap'); return e;
  });
  for(const width of [360,390,430]) await run('directory-long-category',width,'categories/',async page=>{
    const label=page.locator('.report-grid strong',{hasText:'세탁·생활서비스'}).first(); assert.equal(await label.count(),1); const e=await rectEvidence(label);
    assert.ok(e.box.left>=-1&&e.box.right<=width+1,'directory label box clipped'); assert.ok(e.rects.every(x=>x.left>=e.box.left-1&&x.right<=e.box.right+1),'directory text clipped'); assert.notEqual(e.whiteSpace,'nowrap'); return e;
  });
}finally{
  await browser.close();
  const report={kind:'franchise-layout-containment',generatedAt:new Date().toISOString(),pass:cases.every(x=>x.pass),total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,cases,productionDeploy:false};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n'); if(!report.pass)process.exitCode=1;
}

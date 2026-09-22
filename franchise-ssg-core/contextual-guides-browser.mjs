import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/contextual-guides');
assert.ok(['chromium','webkit'].includes(engine));assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
fs.mkdirSync(output,{recursive:true});
const browser=await tooling[engine].launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},locale:'ko-KR',reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(10000);
const cases=[];
const url=p=>new URL(p,base).href;
async function run(name,fn){const item={name,pass:false};try{await fn();item.pass=true}catch(error){item.error=error.stack||error.message}cases.push(item);console.log(JSON.stringify(item))}
async function rail(route,kind,token){
  await page.goto(url(route),{waitUntil:'load'});
  const root=page.locator('[data-v52-context-guides="'+kind+'"]');
  assert.equal(await root.count(),1);assert.equal(await root.locator('.v52-context-guide').count(),3);
  assert.ok((await root.innerText()).includes(token));
  assert.equal(await page.locator('link[href*="contextual-guides.css"]').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
}

try{
  await run('coffee brand gets coffee-specific reading guide',()=>rail('brands/mega-mgc-coffee/','brand','저가커피 브랜드를 비교할 때'));
  await run('chicken brand gets chicken-specific reading guide',()=>rail('brands/bhc-chicken/','brand','치킨 프랜차이즈 창업비용을 비교할 때'));
  await run('candidate category gets interpretation guides',()=>rail('categories/cafe/','category','저가커피 브랜드를 비교할 때'));
  await run('tools hub connects calculations to methodology guides',()=>rail('tools/','hub','손익분기 계산이 실제와 달라지는 이유'));
  await run('rankings hub avoids profitability interpretation',()=>rail('rankings/','hub','본사 예상매출을 그대로 수익으로 보면 안 되는 이유'));
  await run('noncandidate category stays untouched',async()=>{
    await page.goto(url('categories/convenience/'),{waitUntil:'load'});
    assert.equal(await page.locator('[data-v52-context-guides]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await page.setViewportSize({width:1440,height:1000});
  await run('desktop brand rail remains compact and contained',async()=>{
    await page.goto(url('brands/mega-mgc-coffee/'),{waitUntil:'load'});
    const box=await page.locator('[data-v52-context-guides="brand"]').boundingBox();assert.ok(box&&box.width>700&&box.height<500);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  });
  await page.setViewportSize({width:390,height:900});
  await page.goto(url('brands/mega-mgc-coffee/'),{waitUntil:'load'});
  await page.screenshot({path:path.join(output,`${engine}-contextual-guides-390.png`),animations:'disabled',fullPage:true});
}finally{
  await context.close();await browser.close();
  const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===7&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  fs.writeFileSync(path.join(output,`contextual-guides-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

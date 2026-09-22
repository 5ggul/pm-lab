import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/brand-evidence');
assert.ok(['chromium','webkit'].includes(engine));assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
fs.mkdirSync(output,{recursive:true});
const browser=await tooling[engine].launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},locale:'ko-KR',reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(10000);
const cases=[];const url=p=>new URL(p,base).href;
async function run(name,fn){const item={name,pass:false};try{await fn();item.pass=true}catch(error){item.error=error.stack||error.message}cases.push(item);console.log(JSON.stringify(item))}
async function openBrand(route){
  await page.goto(url(route),{waitUntil:'load'});
  const root=page.locator('[data-v52-brand-evidence="1"]');assert.equal(await root.count(),1);assert.equal(await root.locator('[data-v52-evidence-metric]').count(),4);assert.equal(await root.locator('[data-v52-cost-part]').count(),4);assert.equal(await root.locator('[data-v52-store-flow="1"]').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);return root;
}
try{
  await run('mega evidence shows percentile, cost composition and store flow',async()=>{
    const root=await openBrand('brands/mega-mgc-coffee/'),text=await root.innerText();
    for(const token of ['자체 계산 근거','공개 창업비용','23.1백분위','가맹점 수','100.0백분위','연평균매출 공개값','92.3백분위','3.3㎡당 평균매출','기타','5,997.4만원 · 76.4%','2024 → 2025','가맹점 +644개','신규점','657개','계약종료','13개','계약해지','0개'])assert.ok(text.includes(token),token);
    assert.ok(text.includes('높은 백분위가 더 좋은 브랜드라는 뜻은 아닙니다'));
    const bars=await root.locator('.v52-evidence-metric-line i').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).width));assert.equal(bars.length,4);
  });
  await run('bhc evidence preserves negative net flow without judging it',async()=>{
    const root=await openBrand('brands/bhc-chicken/'),text=await root.innerText();
    for(const token of ['90.9백분위','기타','6,660.7만원 · 74.0%','2024 → 2025','가맹점 -63개','신규점','92개','계약종료','4개','계약해지','136개'])assert.ok(text.includes(token),token);
    assert.equal(/추천|우수|위험 브랜드/.test(text),false);
  });
  await run('missing sales stays missing instead of becoming zero performance',async()=>{
    const root=await openBrand('brands/666버거/'),text=await root.innerText();
    assert.ok(text.includes('연평균매출 공개값'));assert.ok(text.includes('3.3㎡당 평균매출'));
    assert.ok((text.match(/양수 공개값이 없어 업종 백분위 비교에서 제외/g)||[]).length>=2);
    assert.ok(text.includes('0원 공개항목도 무료·면제로 해석하지 않습니다'));
  });
  await run('desktop evidence remains compact and readable',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    const root=await openBrand('brands/mega-mgc-coffee/'),box=await root.boundingBox();assert.ok(box&&box.width>800&&box.height<900);
    const cols=await root.locator('.v52-brand-evidence-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns);assert.ok(cols.split(' ').length>=2);
    await page.setViewportSize({width:390,height:900});
  });
  await page.goto(url('brands/mega-mgc-coffee/'),{waitUntil:'load'});await page.screenshot({path:path.join(output,`${engine}-brand-evidence-390.png`),animations:'disabled',fullPage:true});
}finally{
  await context.close();await browser.close();
  const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===4&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  fs.writeFileSync(path.join(output,`brand-evidence-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['chromium','webkit'].includes(engine));
assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/visual-integrity');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;

async function inspect(route,width,kind){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const item={route,width,kind,pass:false};
  try{
    const response=await page.goto(new URL(route,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
    await page.locator('main h1').first().waitFor({state:'visible'});
    const state=await page.evaluate(kind=>{
      const local=[...document.querySelectorAll('[data-v52-local-visual]')];
      const visibleLocal=local.filter(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden'});
      const backgrounds=local.map(el=>getComputedStyle(el).backgroundImage);
      return{
        h1:document.querySelector('main h1')?.textContent?.trim()||'',
        bodyMarked:document.body.classList.contains('v52-visual-integrity')&&document.body.dataset.v52VisualIntegrity==='1',
        stockImages:document.querySelectorAll('img[src*="images.unsplash.com"]').length,
        externalImages:[...document.images].filter(img=>/^https?:\/\//i.test(img.getAttribute('src')||'')).length,
        localVisuals:local.length,
        localKinds:local.map(el=>el.dataset.v52LocalVisual),
        visibleLocal:visibleLocal.length,
        backgrounds,
        text:document.body.innerText,
        kpis:document.querySelectorAll('[data-v35-kpi]').length,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      };
    },kind);
    assert.equal(state.bodyMarked,true);
    assert.equal(state.stockImages,0);
    assert.equal(state.externalImages,0);
    assert.equal(state.localVisuals,1);
    assert.equal(state.localKinds[0],kind);
    assert.ok(state.backgrounds[0]&&state.backgrounds[0]!=='none');
    assert.equal(state.overflow,false);
    if(width===1440)assert.equal(state.visibleLocal,1);
    if(kind==='home'){
      assert.ok(state.h1.includes('프랜차이즈 창업비용 비교'));
      assert.ok(state.text.includes('국내 프랜차이즈 공개데이터'));
      assert.ok(state.text.includes('비용 · 점포 · 매출'));
      assert.ok(!state.text.includes('FRANCHISE INTELLIGENCE'));
      assert.ok(!state.text.includes('FIELD / COST / SALES'));
    }
    if(kind==='brand'){
      assert.equal(state.h1,'메가MGC커피');
      assert.equal(state.kpis,5);
    }
    if(kind==='category'){
      assert.equal(state.h1,'카페·커피');
      assert.ok(state.text.includes('업종 데이터'));
      assert.ok(state.text.includes('공개자료 · 2025'));
      assert.ok(!state.text.includes('PUBLIC DATA / 2025'));
    }
    assert.deepEqual(errors,[]);
    item.pass=true;item.state=state;
    if(width===1440||kind==='home')await page.screenshot({path:path.join(output,`${engine}-visual-${kind}-${width}.png`),animations:'disabled',fullPage:true});
  }catch(error){
    item.error=error.stack||error.message;item.pageErrors=errors;
    await page.screenshot({path:path.join(output,`${engine}-visual-FAIL-${kind}-${width}.png`),animations:'disabled',fullPage:true}).catch(()=>{});
  }
  cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{
  browser=await tooling[engine].launch({headless:true});
  for(const width of [390,1440]){
    await inspect('',width,'home');
    await inspect('brands/mega-mgc-coffee/',width,'brand');
    await inspect('categories/cafe/',width,'category');
  }
}finally{
  const report={engine,total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,pass:cases.length===6&&cases.every(c=>c.pass),cases,remoteStockImages:0,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  await browser?.close();
  fs.writeFileSync(path.join(output,`visual-integrity-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

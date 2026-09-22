import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/prelaunch-quality');
assert.ok(['chromium','webkit'].includes(engine));
assert.ok(process.env.SSG_QA_DEP_ROOT);
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
fs.mkdirSync(output,{recursive:true});
const browser=await tooling[engine].launch({headless:true});
const cases=[];

function luminance([r,g,b]){
  const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
  return .2126*f(r)+.7152*f(g)+.0722*f(b);
}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function rgb(s){const m=String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:null}

async function brandCase(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={kind:'brand-prelaunch',width,pass:false};
  try{
    const res=await page.goto(new URL('brands/mega-mgc-coffee/',base).href,{waitUntil:'load'});assert.equal(res?.status(),200);
    const note=page.locator('.history-coverage-note');
    await note.scrollIntoViewIfNeeded();
    await note.waitFor({state:'visible'});
    const style=await note.evaluate(el=>{const s=getComputedStyle(el);const r=el.getBoundingClientRect();return{color:s.color,background:s.backgroundColor,width:r.width,height:r.height,text:el.textContent.trim()}});
    const cr=ratio(rgb(style.color),rgb(style.background));
    assert.ok(cr>=4.5,`history note contrast ${cr.toFixed(2)}`);
    assert.ok(style.width>100&&style.height>20);
    assert.ok(style.text.includes('점포 이력 범위'));

    for(const id of ['official-current-cost','source']){
      const link=page.locator(`.brand-toc a[href="#${id}"]`);
      await link.click();
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(()=>location.hash),`#${id}`);
      const pos=await page.evaluate(targetId=>{
        const target=document.getElementById(targetId),header=document.querySelector('.site-header');
        const tr=target.getBoundingClientRect(),hr=header.getBoundingClientRect();
        return{targetTop:tr.top,headerBottom:hr.bottom,targetVisible:tr.height>0,overflow:document.documentElement.scrollWidth>innerWidth+1};
      },id);
      assert.equal(pos.targetVisible,true);
      assert.equal(pos.overflow,false);
      assert.ok(pos.targetTop>=pos.headerBottom+8,`${id} hidden by sticky header: target ${pos.targetTop}, header ${pos.headerBottom}`);
    }
    item.pass=true;item.contrast=cr;item.note=style;
    await page.screenshot({path:path.join(output,`${engine}-prelaunch-brand-${width}.png`),animations:'disabled',fullPage:false});
  }catch(error){item.error=error.stack||error.message}
  cases.push(item);await context.close();
}

async function rankingsCase(width){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const item={kind:'rankings-faq',width,pass:false};
  try{
    const res=await page.goto(new URL('rankings/',base).href,{waitUntil:'load'});assert.equal(res?.status(),200);
    const state=await page.evaluate(()=>{
      const raw=document.querySelector('script[data-v32-ranking-faq]')?.textContent||'';
      const data=JSON.parse(raw);
      const visible=[...document.querySelectorAll('[data-v52-ranking-faq-item]')].map(d=>({q:d.querySelector('summary')?.textContent.trim(),a:d.querySelector('p')?.textContent.trim(),visible:d.getBoundingClientRect().width>0}));
      return{type:data['@type'],json:data.mainEntity.map(x=>({q:x.name,a:x.acceptedAnswer.text})),visible,block:document.querySelectorAll('[data-v52-ranking-faq-visible="1"]').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.equal(state.type,'FAQPage');
    assert.equal(state.json.length,4);assert.equal(state.visible.length,4);assert.equal(state.block,1);assert.equal(state.overflow,false);
    for(let i=0;i<4;i++){assert.equal(state.visible[i].q,state.json[i].q);assert.equal(state.visible[i].a,state.json[i].a);assert.equal(state.visible[i].visible,true)}
    item.pass=true;item.items=4;
    await page.locator('[data-v52-ranking-faq-visible="1"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,`${engine}-prelaunch-rankings-${width}.png`),animations:'disabled',fullPage:false});
  }catch(error){item.error=error.stack||error.message}
  cases.push(item);await context.close();
}

try{
  for(const width of [390,1440]){await brandCase(width);await rankingsCase(width)}
}finally{
  await browser.close();
  const report={engine,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===4&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
  fs.writeFileSync(path.join(output,`prelaunch-quality-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));
  if(!report.pass)process.exitCode=1;
}

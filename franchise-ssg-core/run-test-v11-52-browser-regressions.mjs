import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const base = new URL(process.env.SSG_QA_BASE_URL || 'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname), 'Only a local preview may be tested');
assert.ok(process.env.SSG_QA_DEP_ROOT, 'SSG_QA_DEP_ROOT is required');
const { chromium } = await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const out = path.resolve(process.env.SSG_QA_OUTPUT || 'artifacts/franchise-browser-qa');
fs.mkdirSync(out,{recursive:true});
const cases = [];
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const widths = [360,390,768,1440];
async function run(name,width,route,test) {
  const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  const result = {name,width,pass:false};
  try {
    const response = await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200);
    await page.locator('main h1').waitFor();
    await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))]));
    result.evidence = await test(page);
    assert.deepEqual(errors,[],'Uncaught browser error');
    result.pass = true;
  } catch(e) {result.error = e.message;}
  result.pageErrors = errors;
  if (width===390 || width===1440 || !result.pass) {
    result.screenshot = `regression-${name}-${width}.png`;
    await page.screenshot({path:path.join(out,result.screenshot),fullPage:true,animations:'disabled'});
  }
  cases.push(result);
  console.log(JSON.stringify(result));
  await page.close();
}
async function fill(page,scope,values) {
  for (const [name,value] of Object.entries(values)) await page.locator(`${scope} input[name="${name}"]`).fill(String(value));
}
async function textEquals(locator,expected) {assert.equal((await locator.innerText()).trim(),expected);}
try {
  for (const width of widths) {
    await run('home-title',width,'',async page=>{
      const result = await page.locator('main h1').evaluate(el=>{
        const r=el.getBoundingClientRect(), range=document.createRange();range.selectNodeContents(el);
        return {text:el.textContent.trim(),left:r.left,right:r.right,width:innerWidth,whiteSpace:getComputedStyle(el).whiteSpace,textRects:[...range.getClientRects()].map(v=>({left:v.left,right:v.right,top:v.top,bottom:v.bottom}))};
      });
      assert.equal(result.text,'프랜차이즈 창업비용 비교');
      assert.ok(result.left>=-1 && result.right<=width+1,'Heading box clipped');
      assert.ok(result.textRects.length>0 && result.textRects.every(r=>r.left>=-1 && r.right<=width+1),'Heading text clipped despite overflow:hidden');
      return result;
    });
    await run('break-even',width,'tools/break-even/',async page=>{
      const scope='[data-tool="break-even"]',result=page.locator(`${scope} [data-result]`);
      await textEquals(result,'14.7개월');
      await fill(page,scope,{revenue:9000});await textEquals(result,'3.6개월');
      await fill(page,scope,{revenue:1000});await textEquals(result,'계산하지 않음 (월 단순잉여 ≤ 0)');
      await fill(page,scope,{revenue:0});await textEquals(result,'계산하지 않음 (월 단순잉여 ≤ 0)');
      await fill(page,scope,{revenue:9000,investment:''});await textEquals(result,'0.0개월');
      await fill(page,scope,{investment:14000,revenue:4500});await textEquals(result,'14.7개월');
      return {default:'14.7개월',edited:'3.6개월',nonPositiveSurplus:'calculation withheld',blankInvestment:'0.0개월',assertions:6};
    });
    await run('open-close-rate',width,'tools/open-close-rate/',async page=>{
      const scope='[data-tool="open-close"]',result=page.locator(`${scope} [data-result]`);
      await textEquals(result,'신규율 10.0% · 종료·해지율 9.0%');
      await fill(page,scope,{new:40});await textEquals(result,'신규율 20.0% · 종료·해지율 9.0%');
      await fill(page,scope,{base:0});await textEquals(result,'기준 점포 수를 입력하세요');
      await fill(page,scope,{base:''});await textEquals(result,'기준 점포 수를 입력하세요');
      await fill(page,scope,{base:200,new:-5});await textEquals(result,'신규율 0.0% · 종료·해지율 9.0%');
      await fill(page,scope,{new:20});await textEquals(result,'신규율 10.0% · 종료·해지율 9.0%');
      return {default:'신규율 10.0% · 종료·해지율 9.0%',edited:'신규율 20.0% · 종료·해지율 9.0%',zeroDenominator:'calculation withheld',negativeInput:'clamped to zero',assertions:6};
    });
  }
  await run('form-calculator-compatibility',390,'tools/monthly-profit-simulator/',async page=>{
    await fill(page,'form[data-tool="monthly-profit-v10"]',{revenue:5000,materialRate:30,platformRate:5,royaltyRate:5,labor:1000,rent:500,utilities:200,other:300});
    await textEquals(page.locator('[data-profit-balance]'),'1,000만원');
    await textEquals(page.locator('[data-profit-variable]'),'2,000만원');
    await textEquals(page.locator('[data-profit-fixed]'),'2,000만원');
    await textEquals(page.locator('[data-profit-breakeven]'),'3,333만원');
    return {fixtureOnly:true,revenue:5000,variable:2000,fixed:2000,balance:1000,breakEven:3333,unit:'만원',assertions:4};
  });
} finally {
  await browser.close();
  const report={kind:'v11.52-browser-regression-tests',commit:process.env.GITHUB_SHA||null,generatedAt:new Date().toISOString(),pass:cases.length===13 && cases.every(c=>c.pass),total:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,cases,productionDeploy:false,valuesAreTestFixtures:true};
  fs.writeFileSync(path.join(out,'regressions.json'),JSON.stringify(report,null,2)+'\n');
  if (!report.pass) process.exitCode=1;
}

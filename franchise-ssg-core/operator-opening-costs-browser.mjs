import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/operator-opening-costs');
fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const targets=[
  {key:'paiks',route:'brands/paiks-coffee/',name:'빽다방',source:'https://start.theborn.co.kr/paikdabang',rows:1,amounts:['65,530,000원'],basis:'10평 기준',vat:'VAT 별도'},
  {key:'cu',route:'brands/cu/',name:'CU',source:'https://cuopen.bgfretail.com/introduction.jsp',rows:4,amounts:['22,000,000원'],basis:'기본 필수 납입금',vat:'가입비 VAT 별도'},
  {key:'goobne',route:'brands/goobne-chicken/',name:'굽네치킨',source:'https://www.goobne.co.kr/brd/const/franchise',rows:2,amounts:['0원','29,700,000원'],basis:'본사 납입 없음',vat:'VAT 별도',caveat:'3,310만원으로 표기 합계 2,970만원과 일치하지 않음'},
  {key:'hansot',route:'brands/hansot/',name:'한솥',source:'https://franchise.hsd.co.kr/magazine/?bmode=view&idx=162572923',rows:1,amounts:['85,960,000원'],basis:'13평 기준',vat:'VAT 별도',caveat:'최신 견적으로 재확인'},
  {key:'frank',route:'brands/frank-burger/',name:'프랭크버거',source:'https://frankburger.co.kr/html/fran_3.html',rows:1,amounts:['18,000,000원'],basis:'가맹비 1,000만원',vat:'VAT 별도',caveat:'2023년 2월 8일'},
  {key:'sulbing',route:'brands/sulbing/',name:'설빙',source:'https://sulbing.com/startup/guide/expense.php',rows:2,amounts:['18,000,000원','185,200,000원'],basis:'단층 40평 기준',vat:'VAT 별도',caveat:'임차성 부동산 비용 별도'},
  {key:'emart24',route:'brands/%EC%9D%B4%EB%A7%88%ED%8A%B824/',name:'이마트24',source:'https://emart24.co.kr/founded/model',rows:1,amounts:['24,200,000원'],basis:'상품대 1,600만원',vat:'가맹비 VAT 포함',caveat:'예치보증금 3천만원'}
];
const widths=[390,768,1440];
const pageUrl=route=>new URL(route,base).href;

async function run(width,target){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={width,route:target.route,pass:false};
  try{
    const response=await page.goto(pageUrl(target.route),{waitUntil:'load'});assert.equal(response?.status(),200);
    assert.equal((await page.locator('h1').innerText()).trim(),target.name,'brand context must remain explicit in page H1');
    const block=page.locator('#official-current-cost');await block.waitFor();
    assert.equal((await block.locator('h2').innerText()).trim(),'본사 개설비','final v11.52 compact section heading changed unexpectedly');
    assert.equal(await block.locator('tbody tr').count(),target.rows);
    const text=await block.innerText();for(const amount of target.amounts)assert.ok(text.includes(amount),`${target.name} missing ${amount}`);assert.ok(text.includes(target.basis));assert.ok(text.includes(target.vat));assert.ok(text.includes('확인일 2026-09-17'));if(target.caveat)assert.ok(text.includes(target.caveat),`${target.name} caveat missing`);
    const source=block.locator('a[rel*="external"]');assert.equal(await source.getAttribute('href'),target.source);
    assert.equal(await page.locator('[data-v39-evidence="1"]').count(),1,'FTC evidence layer must remain separate and present');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow,noarchive,nosnippet');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const table=block.locator('.table-scroll');if(width===390)assert.ok(['auto','scroll'].includes(await table.evaluate(el=>getComputedStyle(el).overflowX)));
    assert.deepEqual(errors,[]);
    if(width===390)await block.screenshot({path:path.join(output,`${engine}-${target.key}-${width}.png`)});
    item.evidence={brand:target.name,heading:'본사 개설비',rows:target.rows,source:target.source,amounts:target.amounts,ftcLayerPreserved:true,caveatChecked:Boolean(target.caveat),noindex:true,overflow:false};item.pass=true;
  }catch(error){item.error=error.stack||error.message;await page.screenshot({path:path.join(output,`${engine}-operator-cost-FAIL-${target.key}-${width}.png`),fullPage:true}).catch(()=>{})}
  item.pageErrors=errors;cases.push(item);console.log(JSON.stringify(item));await context.close();
}

try{
  browser=await tooling[engine].launch({headless:true});
  for(const target of targets)for(const width of widths)await run(width,target);
}finally{
  await browser?.close();
  const expected=targets.length*widths.length;
  const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===expected&&cases.every(x=>x.pass),targets:targets.map(x=>x.name),cases,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,scope:'Seven recently checked first-party opening-cost pages at 390/768/1440, including explicit published zero, source-vintage caveats and franchisor subtotal inconsistency preservation.'};
  fs.writeFileSync(path.join(output,`operator-opening-costs-${engine}.json`),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

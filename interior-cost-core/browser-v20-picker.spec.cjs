const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='http://127.0.0.1:4173/pm-lab/interior-cost-preview';
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'data','g2b-calculator-reference-v20.json'),'utf8'));
const outDir=path.resolve('artifacts/v20-picker');fs.mkdirSync(outDir,{recursive:true});
const url=p=>`${BASE}/${String(p).replace(/index\.html$/,'')}`;

function findMulti(){
  const groups=new Map();
  for(const r of data.references||[]){
    if(!['market','material'].includes(r.source))continue;
    const key=`${r.row_key}|${r.unit_key}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }
  for(const [key,list] of groups){
    if(list.length>1){const [row_key,unit_key]=key.split('|');return {row_key,unit_key,list}}
  }
  return null;
}

test('calculator exposes guarded manual public reference selection',async({page})=>{
  test.setTimeout(30000);
  expect(data.version).toBe('20.4.0');
  expect(data.same_unit_only).toBe(true);
  expect(data.category_keyword_gate).toBe(true);
  expect(data.manual_candidate_selection).toBe(true);
  expect(data.automatic_reference_selection).toBe('suggestion_only');
  expect(data.match_keywords_exposed).toBe(true);
  expect(data.scope_equivalence_assumed).toBe(false);
  expect(data.automatic_price_judgment).toBe(false);
  expect(data.private_market_average).toBe(false);
  expect(data.client_choice_persisted).toBe(false);

  const multi=findMulti();
  expect(multi).toBeTruthy();
  const {row_key,unit_key,list}=multi;
  await page.setViewportSize({width:390,height:844});
  await page.goto(url('calculator/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
  const root=page.locator('[data-v20-calc-public-compare]');
  await expect(root).toHaveAttribute('data-v20-calc-public-manual-selection','true');
  const row=page.locator(`[data-budget-row="${row_key}"]`);
  await row.locator('[data-qty]').fill('10');
  await row.locator('[data-unit]').fill(unit_key);
  await row.locator('[data-unit-price]').fill('5');

  const picker=page.locator(`[data-v20-calc-public-picker-row="${row_key}"][data-v20-calc-public-picker-kind="procurement"]`);
  await expect(picker).toHaveCount(1);
  const optionCount=await picker.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);
  const target=list[1];
  await picker.selectOption(target.id);
  const selectedCard=page.locator(`[data-v20-calc-public-row="${row_key}"] [data-v20-calc-public-card]`).filter({hasText:target.item_label});
  await expect(selectedCard).toHaveCount(1);
  await expect(selectedCard).toContainText('매칭 키워드');
  await expect(selectedCard).toContainText('직접 선택');
  await expect(selectedCard).toHaveAttribute('data-v20-calc-public-choice','manual');
  await expect(root).not.toContainText('적정하다');
  await expect(root).not.toContainText('싸다');
  await expect(root).not.toContainText('비싸다');

  await row.locator('[data-unit]').fill('사용자정의단위');
  await expect(page.locator('[data-v20-calc-public-state]')).toContainText('동일 단위 공공 참고값 0개');
  await expect(page.locator(`[data-v20-calc-public-row="${row_key}"] [data-v20-calc-public-picker]`)).toHaveCount(0);
  await expect(page.locator(`[data-v20-calc-public-row="${row_key}"] [data-v20-calc-public-card]`)).toHaveCount(0);

  fs.writeFileSync(path.join(outDir,'manual-selection-audit.json'),JSON.stringify({version:data.version,passed:true,row_key,unit_key,option_count:optionCount,selected_id:target.id,same_unit_only:true,manual_candidate_selection:true,automatic_price_judgment:false},null,2));
});

test('calculator picker layout has no horizontal overflow on mobile and desktop',async({browser})=>{
  test.setTimeout(60000);
  for(const vp of [{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}]){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await context.newPage();
    await page.goto(url('calculator/index.html'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body?.dataset?.v20Ready==='1');
    const first=(data.references||[]).find(r=>['market','material'].includes(r.source))||data.references[0];
    const row=page.locator(`[data-budget-row="${first.row_key}"]`);
    await row.locator('[data-qty]').fill('10');await row.locator('[data-unit]').fill(first.unit_key);await row.locator('[data-unit-price]').fill('5');
    const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+2,h1:document.querySelectorAll('h1').length,manual:document.querySelector('[data-v20-calc-public-compare]')?.getAttribute('data-v20-calc-public-manual-selection')}));
    expect(metrics.overflow).toBe(false);expect(metrics.h1).toBe(1);expect(metrics.manual).toBe('true');
    await page.screenshot({path:path.join(outDir,`${vp.name}-calculator-picker.png`),fullPage:true});
    await context.close();
  }
});

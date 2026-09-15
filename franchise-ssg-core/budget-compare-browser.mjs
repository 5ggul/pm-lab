import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const engine=process.env.SSG_QA_ENGINE||'chromium';
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8765/pm-lab/franchise-ssg-preview/');
const tooling=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const output=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/budget-compare');fs.mkdirSync(output,{recursive:true});
const cases=[];let browser;
const pick='[data-v52-budget-pick]';
const selected=page=>page.locator(pick+':checked').evaluateAll(xs=>xs.map(x=>x.dataset.v52BudgetPick));
const state=page=>page.evaluate(()=>({count:document.querySelector('[data-v52-budget-count]').textContent,chips:[...document.querySelectorAll('[data-v52-budget-remove]')].map(x=>x.dataset.v52BudgetRemove),overflow:document.documentElement.scrollWidth>innerWidth+1,params:Object.fromEntries(new URLSearchParams(location.search)),visible:[...document.querySelectorAll('[data-budget-row]:not([hidden])')].map(x=>({cat:x.dataset.cat,cost:Number(x.dataset.cost)})),dock:(()=>{const r=document.querySelector('[data-v52-budget-compare]').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()}));
async function open(page,query='?budget=10000&cat=cafe'){
  const response=await page.goto(new URL('explore/'+query,base).href,{waitUntil:'load'});assert.equal(response?.status(),200);
  await page.locator('section[data-v52-budget-compare]').waitFor();
}
async function run(name,width,fn,{blockedStorage=false,reducedMotion='reduce'}={}){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion});
  if(blockedStorage)await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Disabled for QA','SecurityError')}}));
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).origin===base.origin&&r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  const item={name,width,pass:false};
  try{item.evidence=await fn(page);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);item.pass=true;}
  catch(e){item.error=e.stack||e.message;await page.screenshot({path:path.join(output,`${engine}-budget-FAIL-${name}-${width}.png`)}).catch(()=>{});}
  item.pageErrors=errors;item.localFailures=failures;cases.push(item);console.log(JSON.stringify(item));await context.close();
}
async function journey(page,width){
  await open(page);
  const original=await page.locator('[data-budget-row]').evaluateAll(rows=>rows.map(r=>({...r.dataset})).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);
  const wanted=await inputs.evaluateAll(xs=>xs.slice(0,2).map(x=>x.dataset.v52BudgetPick));assert.equal(wanted.length,2);
  await inputs.nth(0).focus();await inputs.nth(0).press('Space');
  assert.deepEqual(await selected(page),[wanted[0]]);assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  await inputs.nth(1).check();assert.deepEqual((await selected(page)).sort(),[...wanted].sort());
  assert.equal(await inputs.nth(2).isDisabled(),true);
  assert.equal(await page.locator('[data-v52-budget-submit]').isEnabled(),true);
  const before=await state(page);assert.deepEqual(before.chips,wanted);assert.equal(before.overflow,false);
  if(width<=760){assert.ok(before.dock.left>=0&&before.dock.right<=width+1);assert.ok(before.dock.top>=0&&before.dock.bottom<=901);}
  if(width<=760){const styles=await page.locator('[data-budget-row].v52-budget-selected').evaluateAll(rows=>rows.map(r=>({background:getComputedStyle(r).backgroundColor,border:getComputedStyle(r).borderTopColor})));assert.deepEqual(styles,[{background:'rgb(23, 34, 17)',border:'rgb(145, 183, 81)'},{background:'rgb(23, 34, 17)',border:'rgb(145, 183, 81)'}]);}
  await page.screenshot({path:path.join(output,`${engine}-budget-two-${width}.png`)});
  await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();
  assert.deepEqual((await state(page)).chips,wanted);
  assert.deepEqual((await state(page)).params,{budget:'10000',cat:'cafe'});
  // Compare must hydrate exactly the selected pair, not the page's default brands.
  await page.locator('[data-v52-budget-submit]').click();await page.waitForURL('**/compare/?**');
  await page.waitForFunction(expected=>{const vals=[...document.querySelectorAll('[data-v34-pick]')].map(x=>x.value).filter(Boolean);return JSON.stringify(vals)===JSON.stringify(expected);},wanted);
  const params=Object.fromEntries(new URL(page.url()).searchParams);assert.equal(params.a,wanted[0]);assert.equal(params.b,wanted[1]);
  const compared=await page.locator('[data-v34-pick]').evaluateAll(xs=>xs.map(x=>x.value).filter(Boolean));assert.deepEqual(compared,wanted);
  // Browser history and same-tab persistence must work together.
  await page.goBack({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();
  assert.deepEqual((await state(page)).chips,wanted);
  assert.equal(await page.locator('[data-budget-form] [name=cat]').inputValue(),'cafe');
  await page.locator('[data-v52-budget-remove]').first().click();assert.equal((await selected(page)).length,1);
  assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
  await page.locator('[data-v52-budget-clear]').click();assert.deepEqual(await selected(page),[]);
  assert.equal(await page.locator('[data-v52-budget-remove]').count(),0);
  const after=await page.locator('[data-budget-row]').evaluateAll(rows=>rows.map(r=>({...r.dataset})).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.deepEqual(after,original);
  return{wanted,compared,keyboard:true,limit:true,reload:true,historyBack:true,remove:true,clear:true,officialRowDataUnchanged:true,initialState:before};
}

// Exercise every existing result row, including the longest names/highest values.
// Compare against raw response HTML, not hard-coded price/brand fixtures.
async function readableRows(page,width){
  const response=await page.goto(new URL('explore/?budget=9999999',base).href,{waitUntil:'load'});
  assert.equal(response?.status(),200);const source=await response.text();
  await page.locator('table.v52-budget-mobile-rows').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const result=await page.evaluate(({source,width})=>{
    const original=new DOMParser().parseFromString(source,'text/html');
    const expected=[...original.querySelectorAll('[data-budget-row]')].map(row=>({data:{...row.dataset},cells:[...row.cells].map(c=>c.textContent.trim()),href:row.querySelector('a').getAttribute('href')}));
    const table=document.querySelector('table.v52-budget-mobile-rows'),wrap=table.parentElement;
    const rows=[...table.querySelectorAll('[data-budget-row]')];const issues=[];let checkedCells=0,checkedTextRects=0;
    const actual=rows.map(row=>({data:{...row.dataset},cells:[...row.cells].map(cell=>{const c=cell.cloneNode(true);c.querySelectorAll('.v52-budget-mobile-label,.v52-budget-pick').forEach(x=>x.remove());return c.textContent.trim();}),href:row.querySelector('a').getAttribute('href')}));
    const headers=[...table.querySelectorAll('thead th')];
    for(const row of rows){
      if(row.hidden){if(getComputedStyle(row).display!=='none')issues.push('hidden-row-visible:'+row.dataset.name);continue;}
      if(row.getAttribute('role')!=='row')issues.push('row-role:'+row.dataset.name);
      const inputs=row.querySelectorAll('[data-v52-budget-pick]');
      if(inputs.length!==1)issues.push('duplicate-control:'+row.dataset.name);
      if(inputs[0]?.getAttribute('aria-label')!==row.querySelector('td:first-child a').textContent.trim()+' 비교 선택')issues.push('control-name:'+row.dataset.name);
      if(width<=760){
        if(getComputedStyle(row).display!=='grid')issues.push('not-grid:'+row.dataset.name);
        const label=row.querySelector('.v52-budget-pick').getBoundingClientRect();
        if(label.height<44||label.width<44)issues.push('small-hit-area:'+row.dataset.name);
      }else if(getComputedStyle(row).display!=='table-row')issues.push('desktop-not-row:'+row.dataset.name);
      [...row.cells].forEach((cell,index)=>{
        checkedCells++;const box=cell.getBoundingClientRect();
        if(cell.getAttribute('role')!=='cell'||cell.getAttribute('headers')!==headers[index].id)issues.push('cell-header:'+row.dataset.name+':'+index);
        if(width<=760){
          if(box.left<0||box.right>width+1||cell.scrollWidth>cell.clientWidth+1)issues.push('cell-overflow:'+row.dataset.name+':'+index);
          const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
          while(walker.nextNode()){
            const node=walker.currentNode;if(!node.textContent.trim())continue;
            const range=document.createRange();range.selectNodeContents(node);
            for(const rect of range.getClientRects()){
              checkedTextRects++;
              if(rect.width>0&&(rect.left<box.left-1||rect.right>box.right+1))issues.push('text-overflow:'+row.dataset.name+':'+index);
            }
          }
        }
      });
    }
    const labels=[...table.querySelectorAll('.v52-budget-mobile-label')];
    return{expected,actual,issues,rows:rows.length,visible:rows.filter(r=>!r.hidden).length,checkedCells,checkedTextRects,
      columns:headers.map(h=>({text:h.textContent.trim(),role:h.getAttribute('role'),scope:h.scope})),
      headersDisplay:getComputedStyle(table.tHead).display,tableDisplay:getComputedStyle(table).display,
      tableRole:table.getAttribute('role'),tableName:table.getAttribute('aria-label'),labelCount:labels.length,
      labelsCorrect:labels.every(l=>l.getAttribute('aria-hidden')==='true'&&getComputedStyle(l).display===(width<=760?'block':'none')),
      overflow:document.documentElement.scrollWidth>innerWidth+1,wrapperOverflow:wrap.scrollWidth>wrap.clientWidth+1,
      headerIdsUnique:headers.every(h=>[...document.querySelectorAll('[id]')].filter(e=>e.id===h.id).length===1),
      longestName:rows.map(r=>r.dataset.name).sort((a,b)=>b.length-a.length)[0]};
  },{source,width});
  assert.deepEqual(result.actual,result.expected,'all source values, links and datasets unchanged');
  assert.equal(result.rows,136);assert.equal(result.visible,136);assert.equal(result.labelCount,408);
  assert.deepEqual(result.issues,[]);assert.equal(result.overflow,false);assert.equal(result.labelsCorrect,true);assert.equal(result.headerIdsUnique,true);
  assert.equal(result.tableRole,'table');assert.equal(result.tableName,'예산 조건별 브랜드 결과');
  assert.equal(result.headersDisplay,width<=760?'block':'table-header-group');
  assert.deepEqual(result.columns.map(h=>h.role),Array(5).fill('columnheader'));
  assert.deepEqual(result.columns.map(h=>h.scope),Array(5).fill('col'));
  if(width<=760){assert.equal(result.tableDisplay,'block');assert.equal(result.wrapperOverflow,false);}
  else assert.equal(result.tableDisplay,'table');
  // Keep existing filtering and hidden-row semantics after switching layout modes.
  await page.locator('[data-budget-form] [name=cat]').selectOption('cafe');
  await page.locator('[data-budget-form] [name=budget]').fill('10000');
  const visibility=await page.locator('[data-budget-row]').evaluateAll(rows=>({hidden:rows.filter(r=>r.hidden).length,leaked:rows.filter(r=>r.hidden&&getComputedStyle(r).display!=='none').length}));
  assert.ok(visibility.hidden>0);assert.equal(visibility.leaked,0);
  const ax=await page.locator('table.v52-budget-mobile-rows').ariaSnapshot();
  assert.ok(ax.includes('table "예산 조건별 브랜드 결과"'));assert.ok(ax.includes('columnheader "공개 창업비용"'));
  if([390,1440].includes(width)){
    await page.locator('[data-budget-row]:not([hidden])').first().evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.evaluate(()=>scrollBy(0,-140));
    await page.screenshot({path:path.join(output,`${engine}-budget-readable-${width}.png`),animations:'disabled'});
    await page.locator('[data-budget-row]:not([hidden]) [data-v52-budget-pick]').nth(0).check();
    await page.locator('[data-budget-row]:not([hidden]) [data-v52-budget-pick]').nth(1).check();
    await page.locator('[data-budget-row]:not([hidden])').first().evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.evaluate(()=>scrollBy(0,-140));
    await page.screenshot({path:path.join(output,`${engine}-budget-readable-selected-${width}.png`),animations:'disabled'});
  }
  const {actual,expected,...evidence}=result;return {...evidence,hiddenRowsRemainHidden:true,accessibilityTreeHasTableAndHeaders:true,sourceValuesAndLinksUnchanged:true};
}

try{
  browser=await tooling[engine].launch({headless:true});
  for(const width of [320,360,390,430,760,768,1440])await run('readable-results',width,p=>readableRows(p,width));
  for(const width of [360,390,768,1440])await run('pair-journey',width,p=>journey(p,width));
  await run('filter-pruning',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    const saved=(await state(page)).chips;
    await page.locator('[data-budget-form] [name=sort]').selectOption('stores');assert.deepEqual((await state(page)).chips,saved);
    await page.locator('[data-budget-form] [name=cat]').selectOption('chicken');assert.deepEqual(await selected(page),[]);
    assert.match(await page.locator('[data-v52-budget-status]').textContent(),/조건에서 제외/);
    await page.locator('[data-budget-form] [name=cat]').selectOption('cafe');
    assert.deepEqual(await selected(page),[]);await page.locator('[data-budget-row]:not([hidden]) '+pick).first().check();
    await page.locator('[data-budget-form] [name=stores]').fill('9999999');assert.deepEqual(await selected(page),[]);
    assert.equal(await page.locator('[data-budget-row]:not([hidden])').count(),0);assert.equal(await page.locator('[data-v52-budget-submit]').isDisabled(),true);
    await page.screenshot({path:path.join(output,`${engine}-budget-empty-390.png`)});
    await page.locator('[data-budget-reset]').click();assert.deepEqual(await selected(page),[]);
    assert.equal(await page.locator('[data-budget-form] [name=budget]').inputValue(),'10000');assert.equal(await page.locator('[data-budget-form] [name=cat]').inputValue(),'');
    return{sortRetainsSelection:true,categoryPrunes:true,zeroResultsClears:true,resetClears:true,overflow:(await state(page)).overflow};
  });
  await run('preset-pruning',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    await page.locator('[data-budget="5000"]').click();assert.equal(await page.locator('[data-budget-form] [name=budget]').inputValue(),'5000');
    assert.equal(await page.locator('[data-budget-row][hidden] '+pick+':checked').count(),0);
    const result=await state(page);assert.ok(result.visible.every(r=>r.cost<=5000));assert.equal(result.overflow,false);return result;
  });
  await run('storage-disabled',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    assert.equal(await page.locator('[data-v52-budget-submit]').isEnabled(),true);return{memorySelectionWorks:true,selected:(await state(page)).chips};
  },{blockedStorage:true});
  await run('motion-restoration',390,async page=>{
    await open(page);const inputs=page.locator('[data-budget-row]:not([hidden]) '+pick);await inputs.nth(0).check();await inputs.nth(1).check();
    const wanted=(await state(page)).chips;
    await page.reload({waitUntil:'load'});await page.evaluate(()=>scrollTo(0,0));
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]')?.parentElement===document.body);
    const dock=await state(page);assert.deepEqual(dock.chips,wanted);assert.ok(dock.dock.top>=0&&dock.dock.bottom<=901);
    assert.equal(await page.locator('[data-v52-budget-compare]').evaluate(el=>{for(let p=el;p;p=p.parentElement)if(getComputedStyle(p).opacity==='0')return false;return true;}),true);
    await page.screenshot({path:path.join(output,`${engine}-budget-motion-restored-390.png`)});
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]').parentElement.classList.contains('v52-budget-dock-space'));
    await page.setViewportSize({width:390,height:640});
    await page.waitForFunction(()=>document.querySelector('[data-v52-budget-compare]').parentElement===document.body);
    const short=await state(page);assert.ok(short.dock.top>=0&&short.dock.bottom<=641);assert.equal(short.overflow,false);
    await page.locator('[data-v52-budget-submit]').click();await page.waitForURL('**/compare/?**');
    await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('[data-v34-pick]')].map(x=>x.value).filter(Boolean))===JSON.stringify(expected),wanted);
    return{motionEnabled:true,restoredDockVisibleAtPageTop:true,desktopMobileResize:true,shortViewport:true,comparePairPreserved:true};
  },{reducedMotion:'no-preference'});
  await run('untrusted-saved-state',390,async page=>{
    await open(page);await page.evaluate(()=>sessionStorage.setItem('v11.52:budget-compare:'+location.pathname,JSON.stringify(['not-a-brand','<img src=x onerror=alert(1)>',null,{},'not-a-brand'])));
    await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();assert.deepEqual(await selected(page),[]);
    await page.evaluate(()=>sessionStorage.setItem('v11.52:budget-compare:'+location.pathname,'{invalid-json'));
    await page.reload({waitUntil:'load'});await page.locator('[data-v52-budget-submit]').waitFor();assert.deepEqual(await selected(page),[]);return{invalidSlugsIgnored:true,invalidJSONSafe:true};
  });
}finally{
  await browser?.close();const report={engine,sourceHead:process.env.SSG_QA_SOURCE_SHA||null,total:cases.length,passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,pass:cases.length===16&&cases.every(x=>x.pass),cases,productionDeploy:false,indexPolicyChanged:false,scope:'Loopback Playwright engine/viewport testing; not a physical-device or Safari-app certification.'};
  fs.writeFileSync(path.join(output,'budget-compare.json'),JSON.stringify(report,null,2)+'\n');console.log('SUMMARY '+JSON.stringify({...report,cases:undefined}));if(!report.pass)process.exitCode=1;
}

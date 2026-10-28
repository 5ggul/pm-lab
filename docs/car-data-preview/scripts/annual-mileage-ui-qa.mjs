import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';

// Exercise the generated release, with independent arithmetic expectations and
// actual navigation into the existing cost calculators. No external services,
// accounts, analytics or user clipboard are used by this browser run.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const root=path.resolve(process.env.ANNUAL_MILEAGE_PRODUCTION_DIR||path.join(repo,'build/peekmycar-production'));
const output=path.resolve(process.env.ANNUAL_MILEAGE_OUTPUT_DIR||path.join(repo,'output/playwright/annual-mileage'));
// Post-deployment reuse is limited to the same owned production origin. The
// default remains an isolated local artifact with no external service calls.
const liveOrigin=process.env.ANNUAL_MILEAGE_CHECK_ORIGIN;
if(liveOrigin&&new URL(liveOrigin).href!=='https://peekmycar.com/'&&liveOrigin!=='https://peekmycar.com')throw new Error('Expected the owned https://peekmycar.com origin');
const route='/guide/annual-mileage-estimate/';
const viewports=[{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
const ids=['mileage_one_way','mileage_days','mileage_weekend','mileage_extra'];
const handoffKinds=['annual','fuel','electric'];
const checks=[],failures=[],errors=[],renders=[];
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const number=text=>{const digits=String(text).replace(/[^\d.-]/g,'');return digits.trim()?Number(digits):NaN;};
function check(pass,name,actual){const item={name,pass:Boolean(pass),...(actual===undefined?{}:{actual})};checks.push(item);if(!item.pass)failures.push(item);}
async function scenario(name,run){try{await run();}catch(error){check(false,name,{message:error.message,stack:error.stack});}}
const server=http.createServer((request,response)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));}
  catch{response.writeHead(400);response.end();return;}
  if(file!==path.resolve(root)&&!file.startsWith(path.resolve(root)+path.sep)){response.writeHead(403);response.end();return;}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});response.end(fs.readFileSync(file));}
  catch{response.writeHead(404,{'content-type':'text/html; charset=utf-8'});response.end('Not found');}
});
fs.mkdirSync(output,{recursive:true});
if(!liveOrigin)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=liveOrigin?'https://peekmycar.com':`http://127.0.0.1:${server.address().port}`;
let browser;
async function qaPage(options={}){
  const page=await newQaPage(browser,{viewport:{width:390,height:844},...options});
  page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(20000);
  await page.route('**/*',request=>{
    const url=request.request().url();
    if(url.startsWith(base+'/')||/^(?:data|blob):/.test(url))return request.continue();
    if(/^https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//.test(url))return request.fallback();
    return request.abort();
  });
  page.on('pageerror',error=>errors.push({url:page.url(),message:error.message}));
  return page;
}
async function open(page,query=''){
  const response=await page.goto(base+route+query,{waitUntil:'load'});
  check(response?.status()===200,'annual mileage page returns HTTP 200',response?.status());
  await page.waitForFunction(()=>document.querySelector('[data-annual-mileage]')?.dataset.mileageReady==='true');
  await page.evaluate(()=>document.fonts.ready);
}
async function fill(page,values){for(const [id,value]of Object.entries(values))await page.locator('#'+id).fill(String(value));}
async function equals(page,selector,expected,name){const text=await page.locator(selector).textContent();check(number(text)===expected,name,text);}
async function sample(page){await page.locator('#mileage_example').click();}
async function statusPresentation(page,ready,label){
  const state=await page.locator('#mileage_status').evaluate(element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return {ready:element.classList.contains('mileage-result-ready'),width:r.width,height:r.height,position:s.position,display:s.display,visibility:s.visibility,clipPath:s.clipPath,clip:s.clip,role:element.getAttribute('role'),live:element.getAttribute('aria-live'),atomic:element.getAttribute('aria-atomic'),ariaHidden:element.getAttribute('aria-hidden'),text:element.textContent};});
  check(state.role==='status'&&state.live==='polite'&&state.atomic==='true'&&state.ariaHidden!=='true'&&state.display!=='none'&&state.visibility!=='hidden'&&state.text.trim(),label+' has one available polite atomic status',state);
  check(ready?state.ready&&state.width<=1&&state.height<=1&&state.position==='absolute'&&(state.clipPath!=='none'||state.clip!=='auto'):!state.ready&&state.width>1&&state.height>1,label+(ready?' avoids a repeated visible result':' shows the input instruction'),state);
}
async function disabledHandoffs(page,label,kinds=handoffKinds){
  for(const kind of kinds){const link=page.locator('[data-mileage-handoff="'+kind+'"]');check(await link.count()===1,label+' has one '+kind+' handoff');check(await link.getAttribute('href')===null&&await link.getAttribute('aria-disabled')==='true',label+' cannot navigate through the '+kind+' handoff');}
}
async function geometry(page,viewport){
  const data=await page.locator('[data-annual-mileage]').evaluate(root=>{
    const box=element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const visible=element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden';};
    const controls=[...root.querySelectorAll('input,select,button,a[href]')].filter(visible);
    const targets=controls.map(element=>({id:element.id||element.getAttribute('data-mileage-handoff')||element.textContent.trim(),...box(element)}));
    const labels=controls.filter(element=>element.matches('input,select')).map(element=>{
      const label=element.labels?.[0],control=box(element),textRects=[];
      if(label){const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||element.contains(n.parentElement))continue;const range=document.createRange();range.selectNodeContents(n);textRects.push(...[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})));}}
      return {id:element.id,hasLabel:Boolean(label?.textContent.trim()),control,label:label?box(label):null,gap:textRects.length?control.top-Math.max(...textRects.map(r=>r.bottom)):null,overlap:textRects.some(r=>Math.min(r.right,control.right)-Math.max(r.left,control.left)>1&&Math.min(r.bottom,control.bottom)-Math.max(r.top,control.top)>1)};
    });
    const collisions=[];
    for(let a=0;a<controls.length;a++)for(let b=a+1;b<controls.length;b++){if(controls[a].contains(controls[b])||controls[b].contains(controls[a]))continue;const x=box(controls[a]),y=box(controls[b]);if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)collisions.push([controls[a].id,controls[b].id]);}
    const form=root.querySelector('#mileage_form'),panel=root.querySelector('[data-mileage-result-panel]');
    const panelHeadings=[form,panel].filter(Boolean).map(element=>{const heading=element.querySelector('h2,h3');return {border:parseFloat(getComputedStyle(element).borderTopWidth),gap:heading?box(heading).top-box(element).top:null};});
    const metricRows=[...root.querySelectorAll('#mileage_result dl>div')].map(row=>{const term=row.querySelector('dt'),value=row.querySelector('dd');return {term:term?box(term):null,value:value?box(value):null};});
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,h1:document.querySelectorAll('h1').length,targets,labels,collisions,form:box(form),panel:panel?box(panel):null,panelHeadings,metricRows};
  });
  const name=viewport.width+'px annual mileage';
  check(data.document<=data.viewport&&data.body<=data.viewport,name+' has no page overflow',data);
  check(data.h1===1,name+' retains one H1',data.h1);
  check(data.labels.length===ids.length&&data.labels.every(label=>label.hasLabel&&!label.overlap&&label.gap>=5.5),name+' labels remain separated from all four inputs',data.labels);
  check(data.labels.every(label=>label.label&&Math.abs(label.control.left-label.label.left)<=2&&label.control.right<=label.label.right+1),name+' labels and inputs share their left axis',data.labels);
  check(data.collisions.length===0,name+' controls do not overlap',data.collisions);
  check(data.panelHeadings.every(item=>item.border===0||item.gap>=(viewport.width<=700?15.5:19.5)),name+' panel headings retain padding from their top border',data.panelHeadings);
  check(data.metricRows.length===4&&data.metricRows.every(row=>row.term&&row.value&&row.value.left-row.term.right>=12)&&Math.max(...data.metricRows.map(row=>row.value.right))-Math.min(...data.metricRows.map(row=>row.value.right))<=1.5,name+' numeric definition rows remain separated and share their right axis',data.metricRows);
  for(const target of data.targets)check(target.width>=43.5&&target.height>=43.5,name+' 44px target '+target.id,target);
  if(viewport.width>=1000)check(data.panel&&Math.abs(data.form.top-data.panel.top)<=1,name+' input and result panels share their top axis',data);
  if(viewport.width<=700)check(data.panel&&data.panel.top>=data.form.bottom-1,name+' result follows the input panel',data);
  await page.evaluate(()=>scrollTo(0,0));
  const screenshot='annual-mileage-'+viewport.width+'.png';await page.screenshot({path:path.join(output,screenshot),fullPage:true});
  renders.push({...viewport,...data,screenshot});
}

try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const page=await qaPage();
  await scenario('static editorial example and preview/production indexing policies stay truthful',async()=>{
    const file='guide/annual-mileage-estimate/index.html';
    const source=fs.readFileSync(path.join(repo,'docs/car-data-preview',file),'utf8');
    let production;
    if(liveOrigin){const response=await fetch(base+route,{signal:AbortSignal.timeout(30000)});check(response.status===200,'production guide metadata response is HTTP 200',response.status);production=await response.text();}
    else production=fs.readFileSync(path.join(root,file),'utf8');
    check(/name="robots"[^>]*content="noindex,nofollow,noarchive"/.test(source),'source guide stays preview noindex');
    check(/name="robots"[^>]*content="index,follow,max-image-preview:large"/.test(production),'reviewed production guide stays indexable');
    check(production.includes('rel="canonical" href="https://peekmycar.com/guide/annual-mileage-estimate/"'),'existing canonical URL is retained');
    check((production.match(/assets\/annual-mileage\.js(?:\?[^"']*)?["']/g)||[]).length===1,'annual mileage runtime is included once');
    const nodes=[...production.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{const v=JSON.parse(m[1]);return v['@graph']||[v];});
    check(nodes.some(node=>node['@type']==='WebPage')&&nodes.some(node=>node['@type']==='BreadcrumbList'),'guide keeps informational WebPage and breadcrumb schema');
    check(!nodes.some(node=>['Product','Vehicle','SoftwareApplication','WebApplication'].includes(node['@type'])),'distance guide does not invent product or application markup');
    const nojs=await qaPage({javaScriptEnabled:false});await nojs.goto(base+route);
    const copy=await nojs.locator('main').innerText();
    check(copy.includes('14,240')&&!copy.includes('14,244'),'static example does not multiply an already rounded monthly estimate');
    check(copy.includes('12')&&copy.includes('52'),'static copy explains annual month/week assumptions');
    await nojs.close();
  });
  await scenario('blank initial inputs never become a fabricated annual distance',async()=>{
    await open(page);
    check(await page.locator('#mileage_one_way').inputValue()===''&&await page.locator('#mileage_days').inputValue()==='','the two commute inputs start empty');
    check(await page.locator('#mileage_weekend').inputValue()==='0'&&await page.locator('#mileage_extra').inputValue()==='0','non-commute defaults explicitly start at zero');
    check(await page.locator('#mileage_result').isHidden(),'initial incomplete estimate has no numeric result');
    await disabledHandoffs(page,'incomplete estimate');await statusPresentation(page,false,'initial estimate');
  });
  await scenario('worked example uses unrounded annual components and exposes the correct handoff distance',async()=>{
    await sample(page);
    for(const [id,expected]of [['mileage_annual',14240],['mileage_commute',10080],['mileage_weekend_total',4160],['mileage_extra_total',0]])await equals(page,'#'+id,expected,id+' agrees with independent annual arithmetic');
    const monthly=number(await page.locator('#mileage_monthly').textContent());check(Math.abs(monthly-14240/12)<0.1,'monthly average is a display of the annual result, not an intermediate rounded input',monthly);
    check(await page.locator('#mileage_result').isVisible(),'complete estimate shows its result');
    await statusPresentation(page,true,'worked estimate');
    const hrefs=await page.locator('[data-mileage-handoff]').evaluateAll(nodes=>nodes.map(n=>({kind:n.dataset.mileageHandoff,href:n.href,disabled:n.getAttribute('aria-disabled')})));
    for(const item of hrefs){const url=new URL(item.href);check(url.origin===base&&url.searchParams.get(item.kind==='annual'?'km':'distance')==='14240'&&item.disabled!=='true',item.kind+' handoff uses the exact displayed annual distance',item);}
    check(hrefs.length===3,'exactly three existing cost tools are available');
  });
  await scenario('fractional mileage and monthly attendance keep precision until whole-kilometre handoff',async()=>{
    await fill(page,{mileage_one_way:1.25,mileage_days:20.5,mileage_weekend:12.5,mileage_extra:0.2});
    await equals(page,'#mileage_annual',1265.2,'fractional total is 615 + 650 + 0.2');
    await equals(page,'#mileage_commute',615,'fractional attendance has no intermediate monthly rounding');
    await equals(page,'#mileage_weekend_total',650,'weekly distance is annualised over 52 weeks');
    for(const kind of handoffKinds){const url=new URL(await page.locator('[data-mileage-handoff="'+kind+'"]').getAttribute('href'),page.url());check(url.searchParams.get(kind==='annual'?'km':'distance')==='1265',kind+' rounds only the final transfer distance');}
    check((await page.locator('#mileage_transfer_note').textContent()).includes('1,265'),'the whole-kilometre value is visible before handing off');
  });
  await scenario('zero and destination-specific bounds never fall back to a cost tool default',async()=>{
    await fill(page,{mileage_one_way:0,mileage_days:0,mileage_weekend:0,mileage_extra:0});
    await equals(page,'#mileage_annual',0,'explicit zero driving is a valid estimate');check(await page.locator('#mileage_result').isVisible(),'zero is shown rather than treated as missing');await disabledHandoffs(page,'zero annual estimate',['annual']);
    for(const kind of ['fuel','electric']){const url=new URL(await page.locator('[data-mileage-handoff="'+kind+'"]').getAttribute('href'),page.url());check(url.searchParams.get('distance')==='0',kind+' accepts the explicit zero distance');}
    await page.locator('#mileage_extra').fill('0.4');await equals(page,'#mileage_annual',0.4,'small positive mileage is not displayed as zero');await disabledHandoffs(page,'sub-kilometre annual transfer',['annual']);
    await page.locator('#mileage_extra').fill('999');await disabledHandoffs(page,'annual calculator minimum',['annual']);
    await page.locator('#mileage_extra').fill('1000');check(new URL(await page.locator('[data-mileage-handoff="annual"]').getAttribute('href'),page.url()).searchParams.get('km')==='1000','annual calculator accepts its exact 1,000km minimum');
    await page.locator('#mileage_extra').fill('100000');check(new URL(await page.locator('[data-mileage-handoff="annual"]').getAttribute('href'),page.url()).searchParams.get('km')==='100000','annual calculator accepts its exact 100,000km maximum');
    await page.locator('#mileage_extra').fill('100001');await disabledHandoffs(page,'annual calculator maximum',['annual']);
    for(const kind of ['fuel','electric']){const url=new URL(await page.locator('[data-mileage-handoff="'+kind+'"]').getAttribute('href'),page.url());check(url.searchParams.get('distance')==='100001',kind+' retains a valid distance outside the annual calculator range');}
  });
  await scenario('invalidating inputs clears every prior numeric result and usable handoff',async()=>{
    for(const [id,value]of [['mileage_one_way',''],['mileage_extra',''],['mileage_days','-1'],['mileage_days','32'],['mileage_extra','1000001'],['mileage_one_way','1e-999'],['mileage_extra','-1e-999']]){
      await sample(page);await page.locator('#'+id).fill(value);
      check(await page.locator('#mileage_result').isHidden(),id+'='+value+' clears the previous result');
      for(const outputId of ['mileage_annual','mileage_monthly','mileage_commute','mileage_weekend_total','mileage_extra_total'])check(!(await page.locator('#'+outputId).textContent()).trim(),id+'='+value+' removes stale '+outputId);
      await disabledHandoffs(page,id+'='+value);await statusPresentation(page,false,id+'='+value);
      check(await page.locator('#mileage_copy').isDisabled(),id+'='+value+' cannot copy an incomplete estimate');
    }
    await fill(page,{mileage_one_way:0,mileage_days:0,mileage_weekend:0,mileage_extra:1000000});await equals(page,'#mileage_annual',1000000,'exact transfer ceiling remains usable');
    await page.locator('#mileage_weekend').fill('1');check(await page.locator('#mileage_result').isHidden(),'the combined annual total cannot exceed the destination tool limit');
  });
  await scenario('URL restoration preserves independent conditions and rejects malformed shared values',async()=>{
    await open(page,'?other=keep#method');await sample(page);
    const url=new URL(page.url());
    check(url.searchParams.get('other')==='keep'&&url.hash==='#method','editing keeps unrelated query state and fragment');
    for(const [key,value]of [['m_one_way','20'],['m_days','21'],['m_weekend','80'],['m_extra','0']])check(url.searchParams.get(key)===value,'shared URL records '+key);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('[data-annual-mileage]')?.dataset.mileageReady==='true');await equals(page,'#mileage_annual',14240,'reload restores the complete annual distance');
    await page.locator('#mileage_extra').fill('');await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('[data-annual-mileage]')?.dataset.mileageReady==='true');
    check(await page.locator('#mileage_extra').inputValue()===''&&await page.locator('#mileage_result').isHidden(),'an intentionally cleared extra-distance field remains incomplete after reload, not a default zero');await disabledHandoffs(page,'cleared shared extra distance');
    await open(page,'?m_one_way=1e-999&m_days=21&m_weekend=80&m_extra=0');check(await page.locator('#mileage_one_way').inputValue()===''&&await page.locator('#mileage_result').isHidden(),'an underflowing URL input is cleared, not restored as zero');await disabledHandoffs(page,'invalid shared estimate');
  });
  await scenario('live input changes and keyboard operation keep focus while result announcements change',async()=>{
    await open(page);await sample(page);await page.locator('#mileage_one_way').focus();await page.locator('#mileage_one_way').press('Tab');check(await page.locator('#mileage_days').evaluate(el=>el===document.activeElement),'keyboard moves from first field to the next field in reading order');
    await page.locator('#mileage_days').fill('20');await equals(page,'#mileage_annual',13760,'editing attendance immediately changes the annual distance');check(await page.locator('#mileage_days').evaluate(el=>el===document.activeElement),'recalculation never moves focus');
    check((await page.locator('#mileage_status').textContent()).includes('13,760'),'the spoken result changes with the visible result');
    await page.locator('#mileage_days').press('Enter');check(await page.locator('#mileage_days').evaluate(el=>el===document.activeElement),'submitting does not steal input focus');
  });
  await scenario('condition copy uses the displayed shared URL without accessing the user clipboard',async()=>{
    const copied=await qaPage();await copied.addInitScript(()=>{window.__mileageCopied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__mileageCopied.push(text);}}});});
    await open(copied);await sample(copied);await copied.locator('#mileage_copy').click();await copied.waitForFunction(()=>document.querySelector('#mileage_share_status')?.textContent.includes('복사'));
    const values=await copied.evaluate(()=>window.__mileageCopied);check(values.length===1&&values[0]===copied.url(),'copy sends the current complete estimate URL to the platform API');await copied.close();
    const blocked=await qaPage();await blocked.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Blocked for QA','NotAllowedError');}}}));
    await open(blocked);await sample(blocked);await blocked.locator('#mileage_copy').click();await blocked.waitForFunction(()=>document.querySelector('#mileage_share_status')?.textContent.includes('주소창'));
    check((await blocked.locator('#mileage_share_status').textContent()).includes('주소창'),'blocked clipboard explains how to use the actual address');await equals(blocked,'#mileage_annual',14240,'blocked clipboard leaves the estimate usable');await blocked.close();
  });
  for(const kind of handoffKinds)await scenario('actual '+kind+' calculator navigation receives the computed distance',async()=>{
    await open(page);await sample(page);await page.locator('[data-mileage-handoff="'+kind+'"]').click();
    const destination=new URL(page.url());check(destination.pathname===(kind==='annual'?'/tools/annual-cost/':kind==='fuel'?'/tools/fuel-cost/':'/tools/ev-charge-cost/'),kind+' handoff stays on the existing tool route',destination.href);
    if(kind==='annual')await page.waitForFunction(()=>{const panel=document.querySelector('#variant')?.closest('.tool-panel');return panel&&panel.inert===false&&!panel.hasAttribute('aria-busy');});
    const input=kind==='annual'?'#km':'#distance';await page.waitForFunction(selector=>document.querySelector(selector)?.value==='14240',input);
    check(await page.locator(input).inputValue()==='14240',kind+' destination uses the computed distance rather than 20,000km');
    await page.reload({waitUntil:'load'});await page.waitForFunction(selector=>document.querySelector(selector)?.value==='14240',input);check(await page.locator(input).inputValue()==='14240',kind+' destination retains the distance after reload');
  });
  for(const kind of ['fuel','electric'])await scenario('actual '+kind+' zero-distance handoff stays zero after reload',async()=>{
    await open(page);await fill(page,{mileage_one_way:0,mileage_days:0,mileage_weekend:0,mileage_extra:0});await page.locator('[data-mileage-handoff="'+kind+'"]').click();
    await page.waitForFunction(()=>document.querySelector('#distance')?.value==='0');check(await page.locator('#distance').inputValue()==='0',kind+' destination receives zero, not a default distance');
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('#distance')?.value==='0');check(await page.locator('#distance').inputValue()==='0',kind+' destination restores zero after reload');
  });
  for(const viewport of viewports)await scenario('layout '+viewport.width+'x'+viewport.height,async()=>{await page.setViewportSize(viewport);await open(page);await sample(page);await geometry(page,viewport);});
}catch(error){check(false,'QA execution',{message:error.stack||error.message});}
finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
check(errors.length===0,'no browser JavaScript errors',errors);
const report={build:root,origin:base,mode:liveOrigin?'production':'isolated artifact',route,viewports,checks:checks.length,renders:renders.length,failures:failures.length,details:failures,errors,screenshots:renders};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks,renders:report.renders,failures:report.failures,errors,details:failures,output}));
if(failures.length)process.exitCode=1;

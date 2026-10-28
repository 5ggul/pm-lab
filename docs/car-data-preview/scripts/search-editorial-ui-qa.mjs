import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';

// Read an already generated release. This QA does not build, publish, index,
// contact analytics, or edit the release under test.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const root=path.resolve(process.env.SEARCH_EDITORIAL_PRODUCTION_DIR||path.join(repo,'build/peekmycar-production'));
const output=path.resolve(process.env.SEARCH_EDITORIAL_OUTPUT_DIR||path.join(repo,'output/playwright/search-editorial'));
const productionOrigin='https://peekmycar.com';
// Reuse the same suite after deployment only on this owned production origin.
// The default remains an isolated local artifact with no external service calls.
const liveOrigin=process.env.SEARCH_EDITORIAL_CHECK_ORIGIN;
if(liveOrigin&&new URL(liveOrigin).href!==productionOrigin+'/')throw new Error('Expected the owned https://peekmycar.com origin');
const routes=[
  '/cars/hyundai/grandeur-gn7/','/cars/hyundai/grandeur-gn7/hybrid/','/cars/hyundai/grandeur-gn7/lpg/',
  '/cars/kia/sorento-mq4/','/cars/kia/k8-gl3/','/cars/hyundai/ioniq-5/','/cars/kia/ev6/',
  '/compare/grandeur-vs-k8/','/compare/grandeur-gasoline-vs-hybrid/','/compare/sorento-vs-santafe/',
  '/compare/sorento-gasoline-vs-hybrid/','/compare/ioniq5-vs-ev6/',
  '/tools/car-tax/','/guide/car-tax-basics/','/guide/grandeur-wheel-fuel-cost/','/guide/hybrid-savings/'
];
const taxRoutes=['/cars/hyundai/grandeur-gn7/automobile-tax/','/cars/hyundai/grandeur-gn7/2-5-gasoline/automobile-tax/','/cars/hyundai/grandeur-gn7/3-5-gasoline/automobile-tax/','/cars/hyundai/grandeur-gn7/hybrid/automobile-tax/'];
const representatives=['/cars/hyundai/grandeur-gn7/','/cars/hyundai/grandeur-gn7/hybrid/','/cars/hyundai/grandeur-gn7/lpg/','/cars/kia/sorento-mq4/','/compare/grandeur-gasoline-vs-hybrid/','/guide/car-tax-basics/','/tools/car-tax/'];
const viewports=[{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
const checks=[],failures=[],errors=[],renders=[];
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const number=value=>{const text=String(value).replace(/[^\d.-]/g,'');return text.trim()?Number(text):NaN;};
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
function check(pass,name,actual){const entry={name,pass:Boolean(pass),...(actual===undefined?{}:{actual})};checks.push(entry);if(!entry.pass)failures.push(entry);}
async function scenario(name,run){try{await run();}catch(error){check(false,name,{message:error.message,stack:error.stack});}}
const server=http.createServer((request,response)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));}catch{response.writeHead(400);response.end();return;}
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});response.end(fs.readFileSync(file));}
  catch{response.writeHead(404,{'content-type':'text/html; charset=utf-8'});response.end('Not found');}
});
fs.mkdirSync(output,{recursive:true});
if(!liveOrigin)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=liveOrigin?productionOrigin:`http://127.0.0.1:${server.address().port}`;
let browser;
async function qaPage(options={}){
  const page=await newQaPage(browser,{viewport:{width:390,height:844},...options});
  page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(20000);
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(base+'/')||/^(?:data|blob):/.test(url))return route.continue();
    if(/^https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//.test(url))return route.fallback();
    return route.abort();
  });
  page.on('pageerror',error=>errors.push({url:page.url(),message:error.message}));
  return page;
}
async function open(page,route){const response=await page.goto(base+route,{waitUntil:'load'});check(response?.status()===200&&new URL(page.url()).origin===base,route+' HTTP 200 on the tested origin',{status:response?.status(),url:page.url()});await page.evaluate(()=>document.fonts.ready);}
async function editorial(page){return text(await page.locator('#search-editorial-context').innerText());}
const independentTax=variant=>variant.fuel==='electric'||variant.fuel==='ev'?130000:Math.round(variant.cc*(variant.cc<=1000?80:variant.cc<=1600?140:200)*1.3);
const annual=(variant,km,price)=>Math.round(km/variant.combined*price)+independentTax(variant);
async function pairValues(page,label){
  const pair=await page.locator('#decision-data').evaluate(element=>JSON.parse(element.textContent).pairs[0]);
  const km=number(await page.locator('#decision-km').inputValue()),price=number(await page.locator('#decision-price').inputValue());
  for(const [side,variant]of [['a',pair.left],['b',pair.right]]){
    const energy=number(await page.locator('#compare-'+side+'-energy').innerText()),tax=number(await page.locator('#compare-'+side+'-tax').innerText()),total=number(await page.locator('#decision-'+side).innerText());
    check(energy===Math.round(km/variant.combined*price),label+' energy '+side,{energy,km,price});
    check(tax===independentTax(variant),label+' automobile tax '+side,{tax,cc:variant.cc});
    check(total===energy+tax&&total===annual(variant,km,price),label+' displayed total equals energy plus tax '+side,{total,energy,tax});
  }
  const a=number(await page.locator('#decision-a').innerText()),b=number(await page.locator('#decision-b').innerText());
  const conclusion=await page.locator('#decision-saving').innerText(),amount=conclusion.match(/([\d,]+)\s*원/);
  // K8, EV6 and GN7 are model names, not digits in the currency amount.
  const saving=amount?number(amount[1]):/같음/.test(conclusion)?0:NaN;
  check(saving===Math.abs(a-b),label+' conclusion agrees with displayed total difference',{a,b,saving,conclusion});
}
async function geometry(page,route,viewport){
  const data=await page.evaluate(()=>{
    const root=document.querySelector('#search-editorial-context'),rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const heading=root.querySelector('h2'),inner=root.querySelector('.db-shell')||root,main=root.closest('main');
    // A contained main already supplies its page gutter. Other templates use
    // their existing shell; neither should indent this section a second time.
    const reference=main.matches('.decision-main,.content-page')?main:[...main.querySelectorAll('.db-shell')].find(element=>!root.contains(element))||document.querySelector('.db-header .db-shell');
    const links=[...root.querySelectorAll('a[href]')].map(element=>({text:element.textContent.trim(),...rect(element),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
    const fields=[...document.querySelectorAll('#decision-form input:not([type="hidden"]),#simpleCostForm input:not([type="hidden"]),#simpleCostForm select')].filter(element=>element.getBoundingClientRect().height>1).map(element=>{
      const control=rect(element),label=element.labels?.[0],ranges=[];
      if(label){const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||element.contains(n.parentElement))continue;const range=document.createRange();range.selectNodeContents(n);ranges.push(...[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})));}}
      return {id:element.id,hasLabel:Boolean(label?.textContent.trim()),control,gap:ranges.length?control.top-Math.max(...ranges.map(r=>r.bottom)):null,overlap:ranges.some(r=>Math.min(r.right,control.right)-Math.max(r.left,control.left)>1&&Math.min(r.bottom,control.bottom)-Math.max(r.top,control.top)>1)};
    });
    const primaries=[...document.querySelectorAll('#simpleCostForm,#decision-form,#variantButtons,#mTotal,#costResult,#decision-a,#decision-b')].filter(element=>element.getBoundingClientRect().height>1).map(rect);
    const borderTop=parseFloat(getComputedStyle(root).borderTopWidth);
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,h1:document.querySelectorAll('h1').length,blocks:document.querySelectorAll('#search-editorial-context').length,root:rect(root),inner:rect(inner),reference:reference?rect(reference):null,heading:rect(heading),links,fields,primaries,borderTop};
  });
  const name=route+' '+viewport.width+'x'+viewport.height;
  check(data.document<=data.viewport&&data.body<=data.viewport,name+' no page overflow',data);
  check(data.h1===1&&data.blocks===1,name+' one H1 and one editorial section',{h1:data.h1,blocks:data.blocks});
  check(data.root.left>=-1&&data.root.right<=data.viewport+1&&data.inner.left>=-1&&data.inner.right<=data.viewport+1,name+' editorial content fits the viewport',data);
  check(data.reference&&Math.abs(data.inner.left-data.reference.left)<=1&&Math.abs(data.inner.right-data.reference.right)<=1,name+' editorial content retains the existing page gutter',{inner:data.inner,reference:data.reference});
  check(data.borderTop===0||data.heading.top-data.root.top>=(viewport.width<=700?15.5:19.5),name+' heading is separated from a top border',data);
  check(data.primaries.every(primary=>primary.top<data.root.top),name+' existing primary inputs and results precede the new explanation',data.primaries);
  for(const link of data.links){check(link.width>=43.5&&link.height>=43.5,name+' related link target at least 44px '+link.text,link);check(link.scrollWidth<=link.clientWidth+1&&link.left>=data.inner.left-1&&link.right<=data.inner.right+1,name+' related link text fits its content area '+link.text,link);}
  for(const field of data.fields)check(field.hasLabel&&!field.overlap&&field.gap>=5.5,name+' label remains separated from input '+field.id,field);
  // Frame the top of long mobile sections below the existing sticky header;
  // centering the whole section would hide its heading in proof screenshots.
  await page.evaluate(()=>{
    const block=document.querySelector('#search-editorial-context'),header=document.querySelector('.db-header');
    const gap=(header?.getBoundingClientRect().height||0)+16;
    scrollTo(0,Math.max(0,block.getBoundingClientRect().top+scrollY-gap));
  });
  const screenshot=route.slice(1,-1).replaceAll('/','-')+'-'+viewport.width+'.png';
  await page.screenshot({path:path.join(output,screenshot),fullPage:false});renders.push({route,...viewport,...data,screenshot});
}
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const noJs=await qaPage({javaScriptEnabled:false});
  for(const route of routes)await scenario(route+' static readable editorial content and links',async()=>{
    await open(noJs,route);
    check(await noJs.locator('h1').count()===1,route+' one static H1');
    check(await noJs.locator('#search-editorial-context').count()===1,route+' one static editorial section');
    const block=noJs.locator('#search-editorial-context');check(await block.isVisible(),route+' editorial text works without JavaScript');
    check(await block.locator('h2').count()===1&&await block.locator('h3').count()>=1,route+' editorial heading hierarchy');
    const content=await editorial(noJs);
    check(!/\d[\d,]*(?:\.\d+)?\s*(?:원(?:\/(?:L|kWh))?|만원|km\/(?:L|kWh))/.test(content),route+' explanation does not duplicate mutable money or efficiency values',content);
    check(!/\b20\d{2}[-.]\d{2}[-.]\d{2}\b/.test(content),route+' explanation does not freeze a fuel price date',content);
    check(await noJs.locator('link[rel="canonical"]').getAttribute('href')===productionOrigin+route,route+' self canonical is preserved');
    check((await noJs.locator('meta[name="robots"]').getAttribute('content'))?.startsWith('index,follow'),route+' index policy is preserved');
    const sourceHtml=fs.readFileSync(path.join(repo,'docs/car-data-preview',route.slice(1)+'index.html'),'utf8');
    check(/name="robots"[^>]*content="noindex,nofollow,noarchive"/.test(sourceHtml),route+' source preview remains noindex');
    const description=await noJs.locator('meta[name="description"]').getAttribute('content');
    check(description&&await noJs.locator('meta[property="og:description"]').getAttribute('content')===description,route+' description and OG describe the same page');
    check(await noJs.locator('meta[property="og:title"]').getAttribute('content')===await noJs.title(),route+' title and OG title agree');
    const links=await block.locator('.search-editorial-links a[href]').evaluateAll(elements=>elements.map(element=>({href:element.getAttribute('href'),url:element.href,text:element.textContent.trim()})));
    check(links.length>0&&links.length<=3,route+' has at most three useful related links',links);
    for(const link of links){
      const url=new URL(link.url);check(url.origin===base,route+' related link stays within the tested site '+link.href,url.href);
      if(url.origin!==base)continue;
      const response=await fetch(url,{signal:AbortSignal.timeout(10000)});check(response.status===200,route+' related link returns HTTP 200 '+link.href,response.status);
      if(url.hash){const fragment=decodeURIComponent(url.hash.slice(1)),html=await response.text();check(html.includes('id="'+fragment+'"')||html.includes("id='"+fragment+"'"),route+' related fragment exists '+link.href);}
      check(link.text.length>0,route+' related link has a text label '+link.href);
    }
  });
  await scenario('existing indexing inventory and home task heading are preserved',async()=>{
    let sitemap=read('sitemap.xml');
    if(liveOrigin){const response=await fetch(base+'/sitemap.xml',{signal:AbortSignal.timeout(15000)});check(response.status===200,'production sitemap is HTTP 200',response.status);sitemap=await response.text();}
    const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
    check(locations.length===150&&new Set(locations).size===150,'same 150 unique indexable URLs',locations.length);
    check(!locations.some(url=>url.includes('/community/')||url.includes('/cars/family/')),'community and internal family routes remain excluded');
    check(!/<lastmod>/.test(sitemap),'sitemap does not invent update dates');
    for(const route of [...routes,...taxRoutes])check(locations.includes(productionOrigin+route),route+' remains in sitemap');
    for(const route of taxRoutes){await open(noJs,route);check((await noJs.locator('meta[name="robots"]').getAttribute('content'))?.startsWith('index,follow'),route+' existing tax entry stays indexable');check(await noJs.locator('link[rel="canonical"]').getAttribute('href')===productionOrigin+route,route+' keeps its own canonical');}
    await open(noJs,'/');check(await noJs.locator('h1').innerText()==='차량 찾기부터 비교·계산·순위·리콜까지','home retains the requested full task heading');check(await noJs.locator('#search-editorial-context').count()===0,'home is not expanded with article text');
    for(const [name,value]of Object.entries({'google-site-verification':'cf3JAkkg0CRbxH3Ca-2oeZ_WvRRadX4wc9TsQHBYwKc','naver-site-verification':'880621f4f133970ab62d9be0a296e5c6dbb77a57'}))check(await noJs.locator('meta[name="'+name+'"]').getAttribute('content')===value,name+' is preserved');
    let community=read('community/index.html');
    if(liveOrigin){const response=await fetch(base+'/community/',{signal:AbortSignal.timeout(15000)});check(response.status===200&&response.headers.get('x-robots-tag')?.includes('noindex'),'production community response keeps HTTP noindex',{status:response.status(),robots:response.headers.get('x-robots-tag')});community=await response.text();}
    check(/name="robots"[^>]*content="noindex,nofollow/.test(community),'community HTML keeps existing noindex policy');check(read('_headers').includes('/community/*\n  X-Robots-Tag: noindex, nofollow, noarchive'),'community HTTP noindex policy remains configured');
  });
  const page=await qaPage();
  for(const viewport of viewports){await page.setViewportSize(viewport);for(const route of representatives)await scenario(route+' layout '+viewport.width,async()=>{await open(page,route);await geometry(page,route,viewport);});}
  await scenario('known automobile tax amounts and the existing calculator stay unchanged',async()=>{
    await open(page,'/tools/car-tax/');const copy=await editorial(page);
    await page.locator('#taxFuel').selectOption('engine');await page.locator('#registration').fill(catalog.taxYear+'-01');
    for(const [cc,expected]of [['2497',649220],['1598',290836]]){await page.locator('#cc').fill(cc);await page.locator('#simpleCostForm button').click();check(number(await page.locator('#costResult').innerText())===expected,cc+'cc baseline tax amount is preserved',await page.locator('#costResult').innerText());}
    await page.locator('#taxFuel').selectOption('electric');check(number(await page.locator('#costResult').innerText())===130000,'electric passenger tax stays 130000');
    check(await page.locator('#cc').isDisabled()&&await page.locator('#registration').isDisabled(),'electric calculator retains engine-field disabling');
    check(await editorial(page)===copy,'editorial guidance does not become a stale numeric result after tax changes');
  });
  await scenario('Grandeur wheel, distance and live costs remain usable before explanatory copy',async()=>{
    await open(page,'/cars/hyundai/grandeur-gn7/');const copy=await editorial(page);
    check(number(await page.locator('#mTax').innerText())===649220,'Grandeur default passenger tax stays 649220');
    await page.locator('#wheelSelect').selectOption('20');await page.locator('#annualKm').selectOption('10000');await page.locator('#fuelPrice').fill('1800');
    check((await page.locator('#configLine').innerText()).includes('20인치'),'Grandeur wheel selector still updates the specification');
    check(number(await page.locator('#mFuel').innerText())===Math.round(10000/11.2*1800),'Grandeur changed wheel, distance and price preserve energy formula');
    check(number(await page.locator('#mTotal').innerText())===649220+Math.round(10000/11.2*1800),'Grandeur changed total remains tax plus energy');
    check(await editorial(page)===copy,'Grandeur interpretation stays qualitative after changing the selected wheel');
  });
  await scenario('EV6 does not invent charging cost until a unit price is supplied',async()=>{
    await open(page,'/cars/kia/ev6/');const copy=await editorial(page);
    check(await page.locator('#energyPrice').inputValue()==='','EV charging price remains blank initially');check(number(await page.locator('#taxValue').innerText())===130000,'EV6 tax stays 130000');
    check((await page.locator('#totalValue').innerText()).includes('입력'),'EV6 total requests a charging price');
    await page.locator('#energyPrice').fill('350');await page.locator('#annualKm').selectOption('10000');
    const combined=number(await page.locator('#effValue').innerText());check(number(await page.locator('#totalValue').innerText())===130000+Math.round(10000/combined*350),'EV6 charging result uses the entered unit price');
    check(await editorial(page)===copy,'EV interpretation never freezes an entered charging result');
  });
  for(const route of routes.filter(route=>route.startsWith('/compare/')))await scenario(route+' cost split, changed inputs and URL restoration',async()=>{
    await open(page,route);const copy=await editorial(page);
    await page.locator('#decision-price').fill(route.includes('ioniq5')?'350':'2000');await page.locator('#decision-km').fill('30000');
    await pairValues(page,route+' changed inputs');
    check(new URL(page.url()).searchParams.get('km')==='30000',route+' URL keeps changed distance');
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('#decision-km')?.value==='30000');
    await pairValues(page,route+' reload');check(await editorial(page)===copy,route+' explanation does not freeze changing comparison amounts');
  });
}catch(error){check(false,'QA execution',{message:error.stack||error.message});}
finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
check(errors.length===0,'no browser JavaScript errors',errors);
const report={build:root,origin:base,mode:liveOrigin?'production':'isolated artifact',routeCount:routes.length,viewports,checks:checks.length,renders:renders.length,failures:failures.length,details:failures,errors,screenshots:renders};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks,renders:report.renders,failures:report.failures,errors,details:failures,output}));
if(failures.length)process.exitCode=1;

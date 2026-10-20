import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';
import '../assets/cost-math.js';

// Inspect the isolated production build. This script never rebuilds or edits it.
const root=fileURLToPath(new URL('../../../build/peekmycar-production/',import.meta.url));
const output=fileURLToPath(new URL('../../../output/playwright/naver-seo/',import.meta.url));
const routes=['/','/tools/car-tax/','/cars/kia/sorento-mq4/','/cars/hyundai/grandeur-gn7/hybrid/','/compare/sorento-vs-santafe/','/compare/grandeur-vs-k8/','/compare/grandeur-gasoline-vs-hybrid/','/compare/sorento-gasoline-vs-hybrid/','/rankings/hybrid-fuel-economy/'];
const widths=[375,390,430,768,1280,1440];
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const allCalc=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-calc-index.json'),'utf8'));
const math=globalThis.CAR_COST_MATH;
const money=value=>Math.round(value).toLocaleString('ko-KR')+'원';
const number=value=>Number(String(value).replace(/[^\d.-]/g,''));
const car=id=>catalog.cars.find(item=>item.id===id);
const variant=(id,variantId)=>car(id).variants.find(item=>item.id===variantId);
const annualTax=v=>math.annualTax(v.cc,v.fuelType==='ev'||v.fuel==='electric',''+catalog.taxYear+'-01',catalog.taxYear).total;
const expectedCost=(v,km,price)=>Math.round(math.energyCost(km,v.combined,price))+Math.round(annualTax(v));
const checks=[],renders=[],errors=[],failures=[];
function check(pass,name,actual){
  const entry={name,pass:Boolean(pass),...(actual===undefined?{}:{actual})};
  checks.push(entry);if(!entry.pass)failures.push(entry);
}
async function scenario(name,run){
  try{await run();}catch(error){check(false,name,{message:error.message});}
}
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
  catch{res.writeHead(400);res.end();return;}
  if(file!==path.resolve(root)&&!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end();return;}
  try{
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');
    res.end(fs.readFileSync(file));
  }catch{res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end(fs.readFileSync(path.join(root,'404.html')));}
});
fs.mkdirSync(output,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
async function qaPage(options){
  const page=await newQaPage(browser,options);
  // Keep browser QA local; Wikimedia photos use the shared deterministic fixture.
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(base+'/')||/^(?:data|blob):/.test(url))return route.continue();
    if(/^https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//.test(url))return route.fallback();
    return route.abort();
  });
  page.on('pageerror',error=>errors.push({url:page.url(),message:error.message}));
  return page;
}
async function open(page,route){
  const response=await page.goto(base+route,{waitUntil:'load'});
  check(response.status()===200,route+' HTTP 200',response.status());
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.site-brand-image').evaluate(image=>image.decode());
}
async function targets(page,selector,label){
  const rows=await page.locator(selector).evaluateAll(elements=>elements.map(element=>{
    const rect=element.getBoundingClientRect(),parent=element.parentElement.getBoundingClientRect();
    return {text:element.textContent.trim(),width:rect.width,height:rect.height,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,left:rect.left,right:rect.right,parentLeft:parent.left,parentRight:parent.right};
  }));
  check(rows.length>0,label+' targets exist');
  for(const row of rows){
    check(row.height>=44&&row.width>=44,label+' target at least 44px: '+row.text,{width:row.width,height:row.height});
    check(row.scrollWidth<=row.clientWidth+1,label+' text fits: '+row.text,row);
    check(row.left>=row.parentLeft-1&&row.right<=row.parentRight+1,label+' fits its action row: '+row.text,row);
  }
  return rows;
}
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const page=await qaPage({viewport:{width:390,height:900}});
  for(const width of widths){
    await page.setViewportSize({width,height:900});
    for(const route of routes)await scenario(route+' '+width+' render',async()=>{
      await open(page,route);
      const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,h1:[...document.querySelectorAll('h1')].map(element=>element.innerText)}));
      check(metrics.document<=metrics.viewport&&metrics.body<=metrics.viewport,route+' '+width+' zero page overflow',metrics);
      check(metrics.h1.length===1&&metrics.h1[0].trim().length>0,route+' '+width+' one H1',metrics.h1);
      let links=[];
      if(route==='/'){
        // The two longer labels share a row with the compare button on mobile.
        links=await targets(page,'.home-car-actions a[href*="sorento-mq4"], .home-car-actions a[href*="grandeur-gn7"], .home-car-actions button[data-compare-id="sorento-mq4"], .home-car-actions button[data-compare-id="grandeur-gn7"]','home '+width);
        check(await page.locator('.home-quick a[href="./tools/car-tax/"]').count()===1,'home '+width+' direct tax-calculator link');
        const taxQuickLink=await page.locator('.home-quick a[href="./tools/car-tax/"]').boundingBox();
        check(taxQuickLink?.height>=44,'home '+width+' tax quick link touch height',taxQuickLink);
      }
      if(route==='/tools/car-tax/')links=await targets(page,'#simpleCostForm button, .utility-reading a[href*="/guide/car-"]','tax '+width);
      if(route==='/cars/hyundai/grandeur-gn7/hybrid/')links=await targets(page,'main a.button, main a.spec-action','Grandeur hybrid '+width);
      if(route==='/cars/kia/sorento-mq4/')links=await targets(page,'.model-lite-copy a[href="#hybrid-efficiency"]','Sorento hybrid shortcut '+width);
      if(route==='/rankings/hybrid-fuel-economy/'){
        links=await targets(page,'.rank-calc-link','hybrid ranking '+width);
        const gaps=await page.locator('.rank-calc-link').evaluateAll(elements=>elements.map(link=>{const a=link.previousElementSibling,b=link.getBoundingClientRect(),p=a?.getBoundingClientRect();return {label:link.closest('article').dataset.calcId,sameLine:p&&Math.abs(b.top-p.top)<8,gap:p?b.left-p.right:null};}));
        for(const gap of gaps)check(!gap.sameLine||gap.gap>=8,'ranking '+width+' actions are visually separated '+gap.label,gap);
      }
      const file=(route==='/'?'home':route.replace(/^\//,'').replace(/\/$/,'').replaceAll('/','-'))+'-'+width+'.png';
      await page.screenshot({path:path.join(output,file),fullPage:true});
      renders.push({route,width,...metrics,links,screenshot:file});
    });
  }

  const noJs=await qaPage({javaScriptEnabled:false,viewport:{width:390,height:900}});
  await scenario('static tax content without JavaScript',async()=>{
    await open(noJs,'/tools/car-tax/');
    const electric=math.annualTax(null,true,'',catalog.taxYear);
    const summary=noJs.locator('.utility-reading').filter({has:noJs.getByRole('heading',{name:'전기차 자동차세',exact:true})});
    const text=await summary.innerText();
    check(text.includes(money(electric.total))&&text.includes(money(electric.auto))&&text.includes(money(electric.education)),'static electric tax agrees with CAR_COST_MATH',text);
    for(const slug of ['car-tax-basics','car-age-tax-reduction','car-tax-1600-boundary'])check(await noJs.locator(`main a[href="../../guide/${slug}/"]`).count()===1,'static tax guide '+slug);
    check((await noJs.locator('label[for="registration"]').innerText()).includes('차령기산 참고월'),'tax legal month label preserved');
    await noJs.screenshot({path:path.join(output,'car-tax-no-javascript-390.png'),fullPage:true});
  });
  await scenario('static Sorento hybrid rows without JavaScript',async()=>{
    await open(noJs,'/cars/kia/sorento-mq4/');
    const rows=noJs.locator('#hybrid-efficiency .row');
    check(await rows.count()===2,'Sorento has two exact static hybrid rows');
    for(const [index,id]of ['mq4-hev16-2wd-17-0','mq4-hev16-4wd-17-7'].entries()){
      const v=variant('sorento-mq4',id),text=await rows.nth(index).innerText();
      check(text.includes(v.drive)&&text.includes(v.wheel+'인치')&&text.includes(v.seats+'인승')&&text.includes(v.combined.toFixed(1)+' km/L'),'static Sorento '+id,text);
    }
    check(await noJs.locator('#hybrid-efficiency a[href="../../../compare/sorento-vs-santafe/"]').count()===1,'Sorento links directly to existing Santa Fe comparison');
    check(await noJs.locator('#hybrid-efficiency a[href="#variantButtons"]').count()===1,'Sorento links to existing variant selector');
    await noJs.screenshot({path:path.join(output,'sorento-no-javascript-390.png'),fullPage:true});
  });
  await scenario('static Grandeur hybrid rows and current fuel basis without JavaScript',async()=>{
    await open(noJs,'/cars/hyundai/grandeur-gn7/hybrid/');
    check(await noJs.locator('#hybrid-wheel-efficiency').count()===1,'Grandeur wheel-efficiency heading is static');
    const rows=noJs.locator('main .rows .row');
    for(const [index,id]of ['gn7-hev16-2wd-18','gn7-hev16-2wd-19','gn7-hev16-2wd-20'].entries()){
      const v=variant('grandeur-gn7',id),text=await rows.nth(index).innerText();
      check(text.includes(v.wheel+'인치')&&text.includes(v.combined.toFixed(1)),'static Grandeur '+id,text);
    }
    const v=variant('grandeur-gn7','gn7-hev16-2wd-18'),energy=Math.round(math.energyCost(catalog.annualKm,v.combined,catalog.gasPrice));
    check((await rows.filter({hasText:'연 2만km 유류비'}).innerText()).includes(money(energy)),'Grandeur hybrid fuel cost uses current catalog price');
    check((await rows.filter({hasText:'세금 + 유류비'}).innerText()).includes(money(energy+Math.round(annualTax(v)))),'Grandeur hybrid annual total uses current catalog price');
    check(await noJs.locator('main a[href="../../../../compare/grandeur-gasoline-vs-hybrid/"]').count()===1,'Grandeur links directly to existing hybrid comparison');
    check(await noJs.locator('main a[href="./automobile-tax/"]').count()===1,'Grandeur retains existing tax detail link');
    await noJs.screenshot({path:path.join(output,'grandeur-hybrid-no-javascript-390.png'),fullPage:true});
  });

  await scenario('automobile tax calculator UI',async()=>{
    await open(page,'/tools/car-tax/');
    await page.locator('#taxFuel').selectOption('engine');
    await page.locator('#registration').fill(catalog.taxYear+'-01');
    await page.locator('#cc').fill('1598');
    await page.locator('#simpleCostForm button').click();
    const engine=math.roundedTax(math.annualTax(1598,false,catalog.taxYear+'-01',catalog.taxYear));
    check(await page.locator('#costResult').innerText()===money(engine.total),'1598cc current-year tax calculation',await page.locator('#costResult').innerText());
    await page.locator('#taxFuel').selectOption('electric');
    check(await page.locator('#costResult').innerText()===money(math.annualTax(null,true,'',catalog.taxYear).total),'electric car tax UI calculation');
    check(await page.locator('#cc').isDisabled()&&await page.locator('#registration').isDisabled(),'electric tax disables engine-only fields');
  });
  await scenario('existing comparison amounts, distance change and URL reload',async()=>{
    await open(page,'/compare/sorento-vs-santafe/');
    const pair=await page.locator('#decision-data').evaluate(element=>JSON.parse(element.textContent).pairs[0]);
    const initialKm=Number(await page.locator('#decision-km').inputValue()),price=Number(await page.locator('#decision-price').inputValue());
    const expected=(v,km)=>Math.round(math.energyCost(km,v.combined,price)+math.annualTax(v.cc,v.fuel==='electric',catalog.taxYear+'-01',catalog.taxYear).total);
    for(const [side,v]of [['a',pair.left],['b',pair.right]])check(number(await page.locator('#decision-'+side).innerText())===expected(v,initialKm),'comparison initial '+side);
    await page.locator('#decision-km').fill('30000');
    await page.waitForFunction(()=>document.querySelector('.compare-legend small')?.textContent==='연 30,000km');
    for(const [side,v]of [['a',pair.left],['b',pair.right]])check(number(await page.locator('#decision-'+side).innerText())===expected(v,30000),'comparison 30000km '+side);
    check(new URL(page.url()).searchParams.get('km')==='30000','comparison URL carries changed distance');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('.compare-legend small')?.textContent==='연 30,000km');
    check(await page.locator('#decision-km').inputValue()==='30000','comparison reload retains distance');
    for(const [side,v]of [['a',pair.left],['b',pair.right]])check(number(await page.locator('#decision-'+side).innerText())===expected(v,30000),'comparison reload '+side);
  });
  for(const priceKey of ['cprice_gasoline','price'])await scenario('comparison explicit '+priceKey+' and detail handoff',async()=>{
    await open(page,'/compare/sorento-vs-santafe/?km=30000&'+priceKey+'=2000');
    await page.waitForFunction(()=>document.querySelector('#decision-km')?.value==='30000'&&document.querySelector('#decision-price')?.value==='2000');
    const pair=await page.locator('#decision-data').evaluate(element=>JSON.parse(element.textContent).pairs[0]);
    const expected=v=>Math.round(math.energyCost(30000,v.combined,2000)+math.annualTax(v.cc,v.fuel==='electric',catalog.taxYear+'-01',catalog.taxYear).total);
    check(await page.locator('#decision-price').inputValue()==='2000',priceKey+' sets comparison price to 2000');
    check(new URL(page.url()).searchParams.get(priceKey)==='2000',priceKey+' stays in comparison URL');
    for(const [side,v]of [['a',pair.left],['b',pair.right]])check(number(await page.locator('#decision-'+side).innerText())===expected(v),priceKey+' comparison amount '+side);
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#decision-km')?.value==='30000'&&document.querySelector('#decision-price')?.value==='2000');
    for(const [side,v]of [['a',pair.left],['b',pair.right]])check(number(await page.locator('#decision-'+side).innerText())===expected(v),priceKey+' comparison reload amount '+side);
    if(priceKey!=='cprice_gasoline')return;
    const detail=page.locator('[data-decision-side="a"] a').filter({hasText:'차량 상세'});
    check(await detail.count()===1,'comparison has a left-vehicle detail link');
    const destination=new URL(await detail.getAttribute('href'),page.url()).pathname;
    await Promise.all([page.waitForURL(url=>url.pathname===destination),detail.click()]);
    await page.waitForFunction(()=>document.querySelector('#annualKm')?.value==='30000'&&document.querySelector('#energyPrice')?.value==='2000');
    check(new URL(page.url()).searchParams.get('km')==='30000','detail handoff URL retains distance');
    check(new URL(page.url()).searchParams.get('cprice_gasoline')==='2000','detail handoff URL retains gasoline price');
    const selectedLabel=await page.locator('#selectedLabel').innerText(),selected=car('sorento-mq4').variants.find(item=>item.label===selectedLabel);
    assert(selected,'detail handoff must resolve to a reviewed source row');
    check(selected.combined===pair.left.combined&&selected.cc===pair.left.cc,'detail handoff retains comparison efficiency and displacement',selectedLabel);
    check(number(await page.locator('#totalValue').innerText())===expectedCost(selected,30000,2000),'detail handoff amount follows explicit distance and price');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#annualKm')?.value==='30000'&&document.querySelector('#energyPrice')?.value==='2000');
    check(await page.locator('#selectedLabel').innerText()===selectedLabel,'detail handoff reload retains selected source row');
    check(number(await page.locator('#totalValue').innerText())===expectedCost(selected,30000,2000),'detail handoff reload retains amount');
    await page.screenshot({path:path.join(output,'comparison-detail-handoff-1440.png'),fullPage:true});
  });
  await scenario('Sorento existing variant selector and cost updates',async()=>{
    await open(page,'/cars/kia/sorento-mq4/');
    const initial=car('sorento-mq4').rep;
    check(number(await page.locator('#totalValue').innerText())===expectedCost(initial,catalog.annualKm,catalog.gasPrice),'Sorento unchanged default cost');
    await page.locator('#variantButtons [data-selector-key="powertrain"][data-selector-value="1.6 하이브리드"]').click();
    await page.waitForFunction(()=>document.querySelector('#selectedLabel')?.textContent.includes('1.6 하이브리드'));
    const label=await page.locator('#selectedLabel').innerText(),selected=car('sorento-mq4').variants.find(item=>item.label===label);
    assert(selected,'selected hybrid must map to a reviewed source row');
    check(selected.fuelType==='hybrid','existing selector selects a reviewed hybrid',label);
    check(number(await page.locator('#totalValue').innerText())===expectedCost(selected,catalog.annualKm,catalog.gasPrice),'selected hybrid current annual total');
    check((await page.locator('#effValue').innerText()).includes(selected.combined+' km/L'),'selected hybrid efficiency matches source');
    await page.locator('#annualKm').selectOption('10000');
    check(number(await page.locator('#totalValue').innerText())===expectedCost(selected,10000,catalog.gasPrice),'selected hybrid changed-distance total');
    check(await page.locator('[data-field="annual-total"]').first().innerText()===await page.locator('#totalValue').innerText(),'Sorento hero and calculator stay synchronized');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#annualKm')?.value==='10000');
    check(await page.locator('#selectedLabel').innerText()===label,'Sorento reload retains selected hybrid');
    check(number(await page.locator('#totalValue').innerText())===expectedCost(selected,10000,catalog.gasPrice),'Sorento reload retains amount');
  });
  await scenario('hybrid answer shortcut clears the sticky header',async()=>{
    await page.setViewportSize({width:390,height:844});
    await open(page,'/cars/kia/sorento-mq4/');
    const shortcut=page.locator('.model-lite-copy a[href="#hybrid-efficiency"]');
    check(await shortcut.count()===1,'Sorento has one hybrid shortcut inside the hero');
    check(await shortcut.isVisible(),'Sorento hybrid shortcut is visible');
    await shortcut.click();
    const position=await page.locator('#hybrid-efficiency').evaluate(element=>({top:element.getBoundingClientRect().top,headerBottom:document.querySelector('.db-header').getBoundingClientRect().bottom,viewport:innerHeight}));
    check(position.top>=position.headerBottom&&position.top<position.viewport-60,'hybrid answer is visible below the header',position);
  });
  await scenario('Grandeur hybrid answer opens its exact reviewed calculator specification',async()=>{
    await open(page,'/cars/hyundai/grandeur-gn7/hybrid/');
    await page.getByRole('link',{name:'내 조건으로 계산',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#variant')?.value==='gn7-hev16-2wd-18');
    check(await page.locator('#car').inputValue()==='grandeur-gn7','hybrid answer keeps the Grandeur model');
    check(await page.locator('#variant').inputValue()==='gn7-hev16-2wd-18','hybrid answer keeps hybrid 18-inch specification');
    check(await page.locator('html').getAttribute('data-cost-mode')==='reviewed','hybrid answer uses reviewed calculation mode');
    await page.locator('#price').fill('2000');
    await page.locator('#km').fill('30000');
    const selected=variant('grandeur-gn7','gn7-hev16-2wd-18');
    check(number(await page.locator('#total').innerText())===expectedCost(selected,30000,2000),'hybrid answer computes its own specification');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#variant')?.value==='gn7-hev16-2wd-18'&&document.querySelector('#km')?.value==='30000');
    check(await page.locator('#price').inputValue()==='2000','hybrid calculator restores changed price');
    check(number(await page.locator('#total').innerText())===expectedCost(selected,30000,2000),'hybrid calculator restores its own result');
  });
  for(const family of ['kia-sorento','hyundai-grandeur'])await scenario('hybrid ranking exact-source handoff '+family,async()=>{
    await open(page,'/rankings/hybrid-fuel-economy/');
    const article=page.locator(`.rank-row[data-family-id="${family}"]`);
    const calcId=await article.getAttribute('data-calc-id');
    const source=allCalc.rows.find(row=>row.calc_id===calcId&&row.family_id===family);
    assert(source?.full_cost_ready&&source.powertrain==='hybrid','ranking must use an exact calculable hybrid source row');
    await article.getByRole('link',{name:'이 사양으로 계산',exact:true}).click();
    await page.waitForFunction(id=>document.querySelector('#sourceRow')?.value===id,calcId);
    check(await page.locator('html').getAttribute('data-cost-mode')==='all','ranking opens all registered specifications');
    check(await page.locator('#sourceRow').inputValue()===calcId,'ranking retains exact calc_id '+family);
    check((await page.locator('#sourceRow option:checked').innerText()).includes(String(source.combined_efficiency)),'ranking retains exact efficiency '+family);
    await page.locator('#price').fill('2000');
    await page.locator('#km').fill('30000');
    const tax=math.annualTax(source.displacement_cc,false,await page.locator('#reg').inputValue(),catalog.taxYear);
    const total=Math.round(math.energyCost(30000,source.combined_efficiency,2000))+Math.round(tax.total);
    check(number(await page.locator('#total').innerText())===total,'ranking computes original specification '+family);
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(id=>document.querySelector('#sourceRow')?.value===id&&document.querySelector('#km')?.value==='30000',calcId);
    check(await page.locator('#sourceRow').inputValue()===calcId&&await page.locator('#price').inputValue()==='2000','ranking source and custom inputs survive reload '+family);
    check(number(await page.locator('#total').innerText())===total,'ranking result survives reload '+family);
    await page.screenshot({path:path.join(output,'ranking-handoff-'+family+'-390.png'),fullPage:true});
  });
  await scenario('default favicon HTTP MIME and original PNG payload',async()=>{
    const response=await page.request.get(base+'/favicon.ico');
    check(response.status()===200,'favicon.ico returns HTTP 200',response.status());
    check(/^image\/(?:vnd\.microsoft\.icon|x-icon)(?:;|$)/i.test(response.headers()['content-type']||''),'favicon.ico has ICO MIME',response.headers()['content-type']);
    const ico=await response.body(),png=fs.readFileSync(path.join(root,'assets/brand/favicon-96.png'));
    assert(ico.length>=22,'ICO must contain a complete directory entry');
    check(ico.readUInt16LE(0)===0&&ico.readUInt16LE(2)===1&&ico.readUInt16LE(4)===1,'favicon.ico is a single-image ICO');
    const length=ico.readUInt32LE(14),offset=ico.readUInt32LE(18);
    check(length===png.length&&offset===22&&ico.subarray(offset,offset+length).equals(png),'ICO contains exact original brand PNG');
    check(ico[6]===png.readUInt32BE(16)&&ico[7]===png.readUInt32BE(20),'ICO dimensions match original PNG');
  });
}catch(error){check(false,'QA execution',{message:error.stack||error.message});}
finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
check(errors.length===0,'no browser JavaScript errors',errors);
const result={build:root,renders:renders.length,widths,routes,checks:checks.length,failures:failures.length,details:failures,screenshots:renders,errors};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({renders:result.renders,checks:result.checks,failures:result.failures,output,details:failures}));
if(failures.length)process.exitCode=1;

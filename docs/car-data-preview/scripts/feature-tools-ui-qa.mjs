import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {newQaPage} from './qa-photo-fixture.mjs';

// Read the isolated release only. Run after the production builder has finished.
const root = fileURLToPath(new URL('../../../build/peekmycar-production/', import.meta.url));
const output = fileURLToPath(new URL('../../../output/playwright/feature-tools/', import.meta.url));
const routes = ['/tools/fuel-efficiency/', '/tools/ev-charge-cost/', '/tools/car-installment/'];
const viewports = [{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
const storageKey = 'peekmycar.saved-conditions.v1';
const checks = [], failures = [], errors = [], renders = [];
const number = value => {const text=String(value).replace(/[^\d.-]/g,'');return text.trim()===''?NaN:Number(text);};
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
function check(pass, name, actual) {
  const result = {name, pass:Boolean(pass), ...(actual === undefined ? {} : {actual})};
  checks.push(result);
  if (!result.pass) failures.push(result);
}
async function scenario(name, run) {
  try {await run();} catch (error) {check(false, name, {message:error.message, stack:error.stack});}
}
const server = http.createServer((request, response) => {
  let file;
  try {file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));}
  catch {response.writeHead(400); response.end(); return;}
  if (file !== path.resolve(root) && !file.startsWith(path.resolve(root) + path.sep)) {response.writeHead(403); response.end(); return;}
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream'});
    response.end(fs.readFileSync(file));
  } catch {response.writeHead(404, {'content-type':'text/html; charset=utf-8'}); response.end('Not found');}
});
fs.mkdirSync(output, {recursive:true});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
async function qaPage(options = {}) {
  const page = await newQaPage(browser, {viewport:{width:390,height:844}, ...options});
  page.setDefaultTimeout(6500);
  page.setDefaultNavigationTimeout(15000);
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base + '/') || /^(?:data|blob):/.test(url)) return route.continue();
    if (/^https:\/\/(?:thumb|upload|commons)\.wikimedia\.org\//.test(url)) return route.fallback();
    return route.abort();
  });
  page.on('pageerror', error => errors.push({url:page.url(), message:error.message}));
  return page;
}
async function open(page, route) {
  const response = await page.goto(base + route, {waitUntil:'load'});
  check(response?.status() === 200, route + ' HTTP 200', response?.status());
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.site-brand-image').evaluate(image => image.decode());
  const ready = new URL(page.url()).pathname;
  if (ready === routes[0]) await page.waitForFunction(() => document.querySelector('#measuredEfficiencyForm')?.dataset.measuredReady === 'true');
  if (ready === routes[1]) await page.waitForFunction(() => document.querySelector('[data-ev-charge-planner]')?.dataset.chargePlannerReady === 'true');
  if (ready === routes[2]) await page.waitForFunction(() => document.querySelector('#carInstallmentForm')?.dataset.installmentReady === 'true');
}
async function fill(page, values) {for (const [id,value] of Object.entries(values)) await page.locator('#' + id).fill(String(value));}
async function equals(page, selector, expected, label) {
  const text = await page.locator(selector).textContent();
  check(number(text) === expected, label, text);
}
async function screenshot(page, name) {await page.screenshot({path:path.join(output,name),fullPage:true});}
async function savedWidget(page) {
  const widget = page.locator('[data-saved-conditions]');
  if (!await widget.evaluate(element => element.open)) await widget.locator('summary').click();
  return widget;
}

async function geometry(page, route, viewport) {
  const metrics = await page.evaluate(() => {
    const rect = element => {const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const visible = element => {const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const controls = [...document.querySelectorAll('main input:not([type="hidden"]),main select,main button,main summary,main a.utility-button')].filter(visible);
    const targets = controls.map(element => ({id:element.id || element.getAttribute('data-save-condition') || element.textContent.trim().slice(0,55),...rect(element)}));
    const fields = controls.filter(element => element.matches('input,select'));
    const labels = fields.map(element => {
      const label = element.labels?.[0];
      const control = rect(element), wrapper = label ? rect(label) : null;
      const textRects = [];
      if (label) {
        const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
          const node=walker.currentNode;
          if(!node.textContent.trim()||element.contains(node.parentElement))continue;
          const range=document.createRange();range.selectNodeContents(node);
          textRects.push(...[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})));
        }
      }
      const overlap=textRects.some(r=>Math.min(r.right,control.right)-Math.max(r.left,control.left)>1&&Math.min(r.bottom,control.bottom)-Math.max(r.top,control.top)>1);
      return {id:element.id,hasLabel:Boolean(label?.textContent.trim()),control,wrapper,overlap};
    });
    const collisions=[];
    const boxes=controls.filter(element=>element.matches('input,select,button')).map(element=>({element,box:rect(element)}));
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++) {
      const x=boxes[a],y=boxes[b];
      if(x.element.contains(y.element)||y.element.contains(x.element))continue;
      if(Math.min(x.box.right,y.box.right)-Math.max(x.box.left,y.box.left)>1&&Math.min(x.box.bottom,y.box.bottom)-Math.max(x.box.top,y.box.top)>1)collisions.push([x.element.id||x.element.textContent,y.element.id||y.element.textContent]);
    }
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,h1:[...document.querySelectorAll('h1')].map(element=>element.innerText),targets,labels,collisions};
  });
  const label = route + ' ' + viewport.width;
  check(metrics.document <= metrics.viewport && metrics.body <= metrics.viewport, label + ' no page overflow', metrics);
  check(metrics.h1.length === 1 && metrics.h1[0].trim(), label + ' one H1', metrics.h1);
  check(metrics.labels.length > 0 && metrics.labels.every(item=>item.hasLabel), label + ' every visible input has a label', metrics.labels);
  check(metrics.labels.every(item=>!item.overlap), label + ' label text does not overlap its input', metrics.labels.filter(item=>item.overlap));
  check(metrics.labels.every(item=>item.wrapper&&Math.abs(item.wrapper.left-item.control.left)<=2&&item.control.right<=item.wrapper.right+1), label + ' label and input share their left axis', metrics.labels);
  check(metrics.collisions.length === 0, label + ' controls never overlap', metrics.collisions);
  for (const target of metrics.targets) check(target.height >= 43.5 && target.width >= 43.5, label + ' 44px target ' + target.id, target);
  const file=route.split('/').filter(Boolean).at(-1)+'-'+viewport.width+'.png';
  await screenshot(page,file);
  renders.push({route,...viewport,...metrics,screenshot:file});
}

async function measuredValues(page, {distance=600,quantity=40,price=1800} = {}) {
  await page.locator('#measuredMode').selectOption('fuel');
  await page.locator('#measuredFuel').selectOption('gasoline');
  await fill(page,{measuredDistance:distance,measuredQuantity:quantity,measuredPrice:price});
}
async function loanValues(page, values = {}) {
  await fill(page,{loanPrincipal:1000000,loanAnnualRate:12,loanMonths:2,...values});
  await page.locator('#loanMethod').selectOption('equal-payment');
}
async function seedGeometry(page, route) {
  if(route===routes[0])await measuredValues(page);
  if(route===routes[1])await fill(page,{charge_kwh:40,charge_price:300,charge_monthly_km:1000,charge_efficiency:5,charge_slow_price:200,charge_fast_price:400,charge_fast_share:25});
  if(route===routes[2]){
    await loanValues(page);
    await page.locator('#carInstallmentForm button').click();
    await page.locator('#loanSchedule summary').click();
  }
}
async function saveAndReopen(page, label, verify) {
  await page.evaluate(() => {
    const url=new URL(location.href);url.searchParams.set('code','private-code');url.searchParams.set('access_token','private-token');url.searchParams.set('utm_source','qa');url.hash='refresh_token=private-fragment';history.replaceState(history.state,'',url);
  });
  let widget=await savedWidget(page);
  await widget.locator('[data-saved-name]').fill(label);
  await widget.locator('[data-save-condition]').click();
  await page.waitForFunction(name=>[...document.querySelectorAll('[data-saved-list] a')].some(link=>link.textContent===name),label);
  const saved=widget.getByRole('link',{name:label,exact:true});
  const href=await saved.getAttribute('href');
  check(Boolean(href?.startsWith('/tools/')),'saved '+label+' has a local tool URL',href);
  check(!/private-|access_token|refresh_token|utm_source|code=|#/.test(href),'saved '+label+' strips secrets, trackers and fragments',href);
  const raw=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  check(raw.version===1&&raw.items.some(item=>item.label===label&&item.url===href),'saved '+label+' is persisted',raw);
  await page.reload({waitUntil:'load'});
  widget=await savedWidget(page);
  check(await widget.getByRole('link',{name:label,exact:true}).count()===1,'saved '+label+' survives reload');
  await widget.getByRole('link',{name:label,exact:true}).click();
  await page.waitForLoadState('load');
  await verify();
  widget=await savedWidget(page);
  await widget.getByRole('button',{name:label+' 저장 삭제',exact:true}).click();
  check(await widget.getByRole('link',{name:label,exact:true}).count()===0,'saved '+label+' can be deleted');
  check(!(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).items,storageKey)).some(item=>item.label===label),'saved '+label+' deletion is persisted');
}

try {
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const page=await qaPage();
  for(const viewport of viewports) {
    await page.setViewportSize(viewport);
    for(const route of routes) await scenario(route+' '+viewport.width+' geometry',async()=>{await open(page,route);await seedGeometry(page,route);await geometry(page,route,viewport);});
    console.log(JSON.stringify({progress:'viewport complete',...viewport}));
  }
  await page.setViewportSize({width:390,height:844});

  await scenario('measured efficiency and exact fuel-cost handoff',async()=>{
    await open(page,routes[0]);
    await measuredValues(page);
    check((await page.locator('#measuredEfficiencyValue').innerText())==='15 km/L','600km/40L yields 15 km/L');
    await equals(page,'#measuredCostPer100',12000,'measured 100km fuel cost');
    await equals(page,'#measuredRecordCost',72000,'measured record fuel cost');
    check(await page.locator('#measuredCostLink').isVisible(),'valid measurement enables handoff');
    await page.reload({waitUntil:'load'});
    check(await page.locator('#measuredDistance').inputValue()==='600'&&await page.locator('#measuredQuantity').inputValue()==='40'&&await page.locator('#measuredPrice').inputValue()==='1800','measurement query restores all entered values');
    await page.locator('#measuredCostLink').click();
    await page.waitForFunction(()=>document.querySelector('#distance')?.value==='600'&&document.querySelector('#efficiency')?.value==='15'&&document.querySelector('#unitPrice')?.value==='1800');
    check(new URL(page.url()).pathname==='/tools/fuel-cost/','measurement links to existing fuel tool');
    for(const [key,value]of [['distance','600'],['efficiency','15'],['unitPrice','1800']])check(new URL(page.url()).searchParams.get(key)===value,'fuel handoff URL '+key);
    await equals(page,'#costResult',72000,'fuel handoff result keeps its own price');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#unitPrice')?.value==='1800');
    check(await page.locator('#distance').inputValue()==='600'&&await page.locator('#efficiency').inputValue()==='15','fuel handoff reload retains distance and efficiency');
    await equals(page,'#costResult',72000,'fuel handoff reload retains amount');
  });
  await scenario('explicit free measurements retain zero through saving and both existing cost tools',async()=>{
    for(const mode of ['fuel','electric']) {
      await open(page,routes[0]);
      await page.locator('#measuredMode').selectOption(mode);
      await fill(page,{measuredDistance:600,measuredQuantity:120,measuredPrice:0});
      check(await page.locator('#measuredEfficiencyValue').innerText()==='5 '+(mode==='electric'?'km/kWh':'km/L'),'free '+mode+' retains measured efficiency');
      await equals(page,'#measuredCostPer100',0,'free '+mode+' has zero 100km cost');
      await equals(page,'#measuredRecordCost',0,'free '+mode+' has zero interval cost');
      check(new URL(page.url()).searchParams.get('measured_price')==='0','free '+mode+' is explicit in its measurement URL');
      await saveAndReopen(page,'QA 무료 '+mode,async()=>{
        check(await page.locator('#measuredPrice').inputValue()==='0','saved free '+mode+' retains explicit zero');
        await equals(page,'#measuredRecordCost',0,'saved free '+mode+' recalculates zero');
      });
      await page.locator('#measuredCostLink').click();
      await page.waitForFunction(()=>document.querySelector('#unitPrice')?.value==='0'&&document.querySelector('#costResult')?.textContent==='0원');
      check(new URL(page.url()).searchParams.get('unitPrice')==='0','free '+mode+' handoff includes zero');
      check(new URL(page.url()).pathname===(mode==='electric'?routes[1]:'/tools/fuel-cost/'),'free '+mode+' uses the correct existing cost tool');
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(()=>document.querySelector('#costResult')?.textContent==='0원');
      check(await page.locator('#unitPrice').inputValue()==='0','free '+mode+' survives receiving-tool reload and price fetch');
      await equals(page,'#costResult',0,'free '+mode+' receiving result stays zero');
    }
  });
  await scenario('measurement mode changes clear incompatible units and invalid stale results',async()=>{
    await open(page,routes[0]);await measuredValues(page);
    await page.locator('#measuredMode').selectOption('electric');
    check(await page.locator('#measuredQuantity').inputValue()===''&&await page.locator('#measuredPrice').inputValue()==='','switch to electricity clears quantity and price');
    check(await page.locator('#measuredDistance').inputValue()==='600','mode switch retains the distance');
    check(await page.locator('#measuredEfficiencyValue').innerText()==='—'&&await page.locator('#measuredCostLink').isHidden(),'mode switch clears stale result and handoff');
    check((await page.locator('#measuredQuantityLabel').innerText()).includes('kWh')&&await page.locator('#measuredFuelField').isHidden(),'electric mode displays electricity units only');
    await fill(page,{measuredQuantity:120,measuredPrice:300});
    check(await page.locator('#measuredEfficiencyValue').innerText()==='5 km/kWh','electric measurement computes 5km/kWh');
    await page.locator('#measuredCostLink').click();
    await page.waitForFunction(()=>document.querySelector('#distance')?.value==='600'&&document.querySelector('#efficiency')?.value==='5'&&document.querySelector('#unitPrice')?.value==='300');
    check(new URL(page.url()).pathname===routes[1],'electric measurement links to existing charging tool');
    await equals(page,'#costResult',36000,'electric handoff keeps measured efficiency and price');
    await open(page,routes[0]);await measuredValues(page);
    for(const [id,value]of [['measuredQuantity','0'],['measuredDistance','-1'],['measuredPrice','-1']]) {
      await measuredValues(page);await page.locator('#'+id).fill(value);
      check(await page.locator('#measuredEfficiencyValue').innerText()==='—'&&await page.locator('#measuredCostRows').isHidden()&&await page.locator('#measuredCostLink').isHidden(),'invalid '+id+' clears all previous results');
    }
    await measuredValues(page);await page.locator('#measuredPrice').fill('');
    check(await page.locator('#measuredEfficiencyValue').innerText()==='15 km/L'&&await page.locator('#measuredCostRows').isHidden(),'optional blank price retains efficiency only');
    await page.locator('#measuredPrice').fill('1800');await page.locator('#measuredFuel').selectOption('diesel');
    check(await page.locator('#measuredPrice').inputValue()===''&&await page.locator('#measuredCostRows').isHidden(),'fuel change clears the former fuel price');
    await open(page,routes[0]+'?measured_mode=unknown&measured_distance=600&measured_quantity=40&measured_price=1800');
    check(await page.locator('#measuredQuantity').inputValue()===''&&await page.locator('#measuredEfficiencyValue').innerText()==='—','unknown URL mode cannot reinterpret supplied units');
  });

  await scenario('EV session and mixed planner values, explicit zero and stale clearing',async()=>{
    await open(page,routes[1]);
    check(await page.locator('#charge_price').inputValue()===''&&await page.locator('#charge_slow_price').inputValue()===''&&await page.locator('#charge_fast_price').inputValue()==='','EV planner never invents a current unit price');
    await fill(page,{charge_kwh:40,charge_price:300});
    await equals(page,'#charge_session_cost',12000,'40kWh at 300 won yields 12000');
    await page.locator('#charge_price').fill('');
    check(await page.locator('#charge_session_result').isHidden()&&await page.locator('#charge_session_cost').textContent()==='','blank session price clears the previous cost');
    await page.locator('#charge_price').fill('0');
    check(await page.locator('#charge_session_result').isVisible(),'explicit free session remains a valid result');
    await equals(page,'#charge_session_cost',0,'explicit zero price yields a free charge');
    await page.locator('#charge_price').fill('-1');
    check(await page.locator('#charge_session_result').isHidden(),'negative session price clears stale result');
    await fill(page,{charge_monthly_km:1000,charge_efficiency:5,charge_slow_price:200,charge_fast_price:400,charge_fast_share:25});
    await equals(page,'#charge_weighted_price',250,'mixed charging weighted rate');
    await equals(page,'#charge_monthly_cost',50000,'mixed monthly cost');
    await equals(page,'#charge_annual_cost',600000,'mixed annual cost');
    check((await page.locator('#charge_mixed_breakdown').innerText()).includes('200kWh'),'mixed planner uses energy, not charging time');
    await page.locator('#charge_fast_share').fill('0');await equals(page,'#charge_weighted_price',200,'zero fast share uses slow price');
    await page.locator('#charge_fast_share').fill('100');await equals(page,'#charge_weighted_price',400,'100 percent fast share uses fast price');
    await page.locator('#charge_fast_share').fill('101');
    check(await page.locator('#charge_mixed_result').isHidden()&&await page.locator('#charge_monthly_cost').textContent()==='','over-100 share clears previous result');
    await page.locator('#charge_fast_share').fill('25');await page.locator('#charge_efficiency').fill('0');
    check(await page.locator('#charge_mixed_result').isHidden(),'zero efficiency cannot produce a charge estimate');
    await page.locator('#charge_efficiency').fill('5');await page.locator('#charge_slow_price').fill('');
    check(await page.locator('#charge_mixed_result').isHidden(),'blank mixed price is not free charging');
    await fill(page,{charge_slow_price:0,charge_fast_price:0});
    check(await page.locator('#charge_mixed_result').isVisible(),'explicit zero mixed prices are valid');
    await equals(page,'#charge_annual_cost',0,'free mixed charging annual cost is zero');
    await fill(page,{charge_kwh:40,charge_price:300,charge_slow_price:200,charge_fast_price:400});
    await page.reload({waitUntil:'load'});
    check(await page.locator('#charge_price').inputValue()==='300'&&await page.locator('#charge_fast_share').inputValue()==='25','planner restores its own namespaced query');
    await equals(page,'#charge_session_cost',12000,'session survives reload');
    await equals(page,'#charge_annual_cost',600000,'mixed estimate survives reload');
  });

  await scenario('single charging mode disables only the unused quote and restores both quotes when mixed again',async()=>{
    await open(page,routes[1]);
    await fill(page,{charge_monthly_km:1000,charge_efficiency:5,charge_slow_price:200,charge_fast_share:0});
    check(await page.locator('#charge_fast_price').isDisabled(),'all-slow disables the unused fast quote');
    check(!await page.locator('#charge_fast_price').evaluate(input=>input.required),'all-slow does not require a fast quote');
    check(await page.locator('#charge_fast_price').inputValue()==='','all-slow does not invent a zero fast quote');
    await equals(page,'#charge_monthly_cost',40000,'all-slow calculates without a fast quote');
    await equals(page,'#charge_annual_cost',480000,'all-slow annual cost excludes an unused quote');
    await page.locator('#charge_fast_share').fill('25');
    check(await page.locator('#charge_fast_price').isEnabled()&&await page.locator('#charge_fast_price').evaluate(input=>input.required),'mixed charging re-enables and requires the fast quote');
    check(await page.locator('#charge_mixed_result').isHidden(),'missing newly active quote clears the old cost');
    await page.locator('#charge_fast_price').fill('400');
    await equals(page,'#charge_monthly_cost',50000,'mixed charging uses both supplied quotes');
    await page.locator('#charge_fast_share').fill('0');
    check(await page.locator('#charge_fast_price').inputValue()==='400','disabling retains a previous fast quote');
    await saveAndReopen(page,'QA 완속만 사용',async()=>{
      check(await page.locator('#charge_fast_price').isDisabled(),'saved all-slow restores the disabled state');
      check(await page.locator('#charge_fast_price').inputValue()==='400','saved all-slow retains its unused quote for later changes');
      await equals(page,'#charge_monthly_cost',40000,'saved all-slow restores its current cost');
    });
    await page.locator('#charge_fast_share').fill('100');
    check(await page.locator('#charge_slow_price').isDisabled()&&!await page.locator('#charge_slow_price').evaluate(input=>input.required),'all-fast disables only the unused slow quote');
    check(await page.locator('#charge_slow_price').inputValue()==='200','all-fast retains its earlier slow quote');
    await equals(page,'#charge_monthly_cost',80000,'all-fast calculates from the active fast quote');
    await page.locator('#charge_fast_share').fill('25');
    check(await page.locator('#charge_slow_price').isEnabled()&&await page.locator('#charge_fast_price').isEnabled(),'returning to mixed charging restores both input controls');
    await equals(page,'#charge_monthly_cost',50000,'returning to mixed charging restores the two retained quotes');
    await page.locator('#charge_slow_price').fill('');
    check(await page.locator('#charge_mixed_result').isHidden(),'empty active slow quote never becomes free charging');
    await page.locator('#charge_fast_price').fill('0');
    await page.locator('#charge_fast_share').fill('100');
    await equals(page,'#charge_monthly_cost',0,'an explicitly free active fast quote is valid with no slow quote');
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#charge_fast_share')?.value==='100');
    check(await page.locator('#charge_slow_price').isDisabled()&&await page.locator('#charge_fast_price').inputValue()==='0','free all-fast reload retains its zero tariff and unused state');
    await equals(page,'#charge_annual_cost',0,'free all-fast annual estimate survives reload');
  });
  await scenario('loan results, zero rate, equal principal, stale clearing and URL reload',async()=>{
    await open(page,routes[2]);
    check(await page.locator('#loanAnnualRate').inputValue()==='','loan starts with no invented quote rate');
    await loanValues(page);await page.locator('#carInstallmentForm button').click();
    await equals(page,'#loanTotalInterest',15025,'loan two-month total interest');
    await equals(page,'#loanPayment',507512,'loan first month');
    await equals(page,'#loanLastPayment',507513,'loan last month');
    await equals(page,'#loanTotalPayment',1015025,'loan principal plus total interest');
    check(await page.locator('#loanSchedule').isVisible()&&!await page.locator('#loanSchedule').evaluate(element=>element.open),'amortization table starts collapsed');
    await page.locator('#loanSchedule summary').click();
    check(await page.locator('#loanScheduleBody tr').count()===2,'loan table has one row per month');
    await equals(page,'#loanScheduleBody tr:last-child td:last-child',0,'loan ends with zero balance');
    await page.locator('#loanAnnualRate').fill('0');
    check(await page.locator('#loanMetrics').isHidden()&&await page.locator('#loanSchedule').isHidden(),'editing the quote clears old loan results');
    await page.locator('#carInstallmentForm button').click();
    await equals(page,'#loanPayment',500000,'zero-rate first payment');
    await equals(page,'#loanTotalInterest',0,'zero-rate loan has no interest');
    await fill(page,{loanPrincipal:120000,loanAnnualRate:12,loanMonths:12});await page.locator('#loanMethod').selectOption('equal-principal');await page.locator('#carInstallmentForm button').click();
    await equals(page,'#loanPayment',11200,'equal-principal first payment');
    await equals(page,'#loanLastPayment',10100,'equal-principal final payment');
    await equals(page,'#loanTotalInterest',7800,'equal-principal total interest');
    await page.reload({waitUntil:'load'});
    check(await page.locator('#loanPrincipal').inputValue()==='120000'&&await page.locator('#loanAnnualRate').inputValue()==='12'&&await page.locator('#loanMonths').inputValue()==='12'&&await page.locator('#loanMethod').inputValue()==='equal-principal','loan restores all four query values');
    await equals(page,'#loanTotalInterest',7800,'restored loan recalculates its own result');
    for(const [id,value]of [['loanPrincipal',''],['loanAnnualRate','-1'],['loanMonths','1.5']]) {
      await loanValues(page);await page.locator('#carInstallmentForm button').click();await page.locator('#'+id).fill(value);await page.locator('#carInstallmentForm button').click();
      check(await page.locator('#loanMetrics').isHidden()&&await page.locator('#loanSchedule').isHidden()&&await page.locator('#loanError').isVisible(),'invalid '+id+' clears numbers and identifies the error');
    }
    await loanValues(page,{loanPrincipal:0,loanAnnualRate:0,loanMonths:36});await page.locator('#carInstallmentForm button').click();
    check((await page.locator('#loanStatus').innerText()).includes('상환할 차입금과 이자가 없습니다')&&await page.locator('#loanSchedule').isHidden(),'zero principal explicitly reports no borrowing');
    await equals(page,'#loanTotalPayment',0,'zero principal total is zero');
    await screenshot(page,'loan-zero-and-states-390.png');
  });

  await scenario('saved measured record opens the same current inputs',async()=>{
    await open(page,routes[0]);await measuredValues(page,{distance:750,quantity:50,price:2000});
    await saveAndReopen(page,'QA 측정 기록',async()=>{
      check(await page.locator('#measuredDistance').inputValue()==='750'&&await page.locator('#measuredQuantity').inputValue()==='50'&&await page.locator('#measuredPrice').inputValue()==='2000','saved measurement restores displayed inputs');
      check(await page.locator('#measuredEfficiencyValue').innerText()==='15 km/L','saved measurement restores its result');
    });
  });
  await scenario('saved EV session opens the same current inputs',async()=>{
    await open(page,routes[1]);await fill(page,{charge_kwh:60,charge_price:250});
    await saveAndReopen(page,'QA 충전 기록',async()=>{
      check(await page.locator('#charge_kwh').inputValue()==='60'&&await page.locator('#charge_price').inputValue()==='250','saved EV session restores displayed inputs');
      await equals(page,'#charge_session_cost',15000,'saved EV session restores its result');
    });
  });
  await scenario('saving a loan before submitting uses the currently visible values',async()=>{
    await open(page,routes[2]);await fill(page,{loanPrincipal:240000,loanAnnualRate:0,loanMonths:12});await page.locator('#loanMethod').selectOption('equal-principal');
    await saveAndReopen(page,'QA 새 할부 조건',async()=>{
      check(await page.locator('#loanPrincipal').inputValue()==='240000'&&await page.locator('#loanAnnualRate').inputValue()==='0'&&await page.locator('#loanMonths').inputValue()==='12'&&await page.locator('#loanMethod').inputValue()==='equal-principal','saved unsubmitted loan restores current visible fields');
      await equals(page,'#loanPayment',20000,'saved zero-rate loan restores its result');
      await equals(page,'#loanTotalInterest',0,'saved zero rate stays explicit');
    });
  });

  for(const raw of ['{invalid-json','{"version":1,"items":[{"id":"bad","label":"외부 주소","url":"https://evil.test/compare/"}]}'])await scenario('corrupt saved storage is isolated '+raw.slice(0,20),async()=>{
    const isolated=await qaPage();
    await isolated.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:raw});
    const startErrors=errors.length;
    await open(isolated,routes[0]);
    const widget=await savedWidget(isolated);
    check(await widget.locator('[data-saved-list] a').count()===0,'corrupt storage never exposes an unsafe saved link');
    await measuredValues(isolated);
    check(await isolated.locator('#measuredEfficiencyValue').innerText()==='15 km/L','corrupt storage leaves local measurement usable');
    check(errors.length===startErrors,'corrupt storage produces no JavaScript crash');
    await isolated.close();
  });
  await scenario('blocked localStorage leaves calculation and feedback usable',async()=>{
    const blocked=await qaPage();
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage blocked for QA','SecurityError');}}));
    const startErrors=errors.length;
    await open(blocked,routes[2]);await loanValues(blocked,{loanAnnualRate:0});await blocked.locator('#carInstallmentForm button').click();
    await equals(blocked,'#loanPayment',500000,'storage-blocked loan still calculates');
    const widget=await savedWidget(blocked);await widget.locator('[data-save-condition]').click();
    await blocked.waitForFunction(()=>/저장하지 못|저장 공간/.test(document.querySelector('[data-saved-status]')?.textContent||''));
    check((await widget.locator('[data-saved-status]').innerText()).length>0,'blocked storage explains the save failure');
    check(errors.length===startErrors,'blocked storage produces no JavaScript crash');
    await blocked.close();
  });
} catch(error) {check(false,'QA execution',{message:error.stack||error.message});}
finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
check(errors.length===0,'no browser JavaScript errors',errors);
const report={build:root,routes,viewports,renders:renders.length,checks:checks.length,failures:failures.length,details:failures,screenshots:renders,errors};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({renders:report.renders,checks:report.checks,failures:report.failures,output,details:failures}));
if(failures.length)process.exitCode=1;

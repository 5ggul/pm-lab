import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateAnnualMileage, readMileageQuery, mileageUrl, initAnnualMileage, MILEAGE_FIELDS, MILEAGE_ANNUAL_LIMIT, MILEAGE_HANDOFF_BOUNDS} from '../assets/annual-mileage.js';

const example = {oneWayKm: 20, monthlyDays: 21, weekendKm: 80, extraAnnualKm: 0};
const urlBase = 'https://peekmycar.com/guide/annual-mileage-estimate/';
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

test('the worked commute and weekend example sums annual distances before any display rounding', () => {
  const result = calculateAnnualMileage(example);
  assert.equal(result.commuteAnnual, 10080);
  assert.equal(result.weekendAnnual, 4160);
  assert.equal(result.extraAnnual, 0);
  assert.equal(result.annual, 14240);
  assert.equal(result.monthlyAverage, 14240 / 12);
  assert.equal(result.transferKm, 14240);
  assert.notEqual(result.annual, 14244, 'a rounded monthly estimate must not be multiplied back into the annual total');
});

test('fractional distance and average work days retain precision until the final transfer distance', () => {
  const result = calculateAnnualMileage({oneWayKm: 1.234, monthlyDays: 20.5, weekendKm: 3.33, extraAnnualKm: 6.789});
  close(result.commuteAnnual, 607.128);
  close(result.weekendAnnual, 173.16);
  close(result.annual, 787.077);
  assert.equal(result.transferKm, 787);
  assert.equal(result.monthlyAverage, result.annual / 12);
  const a = calculateAnnualMileage({oneWayKm: 0, monthlyDays: 0, extraAnnualKm: 1000.49});
  const b = calculateAnnualMileage({oneWayKm: 0, monthlyDays: 0, extraAnnualKm: 1000.5});
  assert.equal(a.transferKm, 1000);
  assert.equal(b.transferKm, 1001);
});

test('an intentionally zero plan remains a valid result, and only omitted optional distances default to zero', () => {
  assert.deepEqual(calculateAnnualMileage({oneWayKm: 0, monthlyDays: 0}), {commuteAnnual:0, weekendAnnual:0, extraAnnual:0, annual:0, monthlyAverage:0, transferKm:0});
  for (const explicit of ['0', '0.0', '-0', '+0', '0e-999']) assert.equal(calculateAnnualMileage({oneWayKm: explicit, monthlyDays: explicit, weekendKm: explicit, extraAnnualKm: explicit}).annual, 0);
  for (const key of ['weekendKm', 'extraAnnualKm']) for (const value of ['', ' ', null]) assert.equal(calculateAnnualMileage({...example, [key]:value}), null, key+' is explicitly missing');
});

test('all four inputs reject invalid types, syntax, signs, infinity and nonzero decimal underflow', () => {
  for (const input of [null, undefined, [], true, 1, 'example']) assert.equal(calculateAnnualMileage(input), null);
  const invalid = ['', ' ', null, false, true, [], {}, NaN, Infinity, -Infinity, -1, 'NaN', 'Infinity', '0x10', '0b10', '1,000', '<script>', '1e-999', '-1e-999', '2.5e999'];
  for (const key of Object.keys(MILEAGE_FIELDS)) for (const value of invalid) assert.equal(calculateAnnualMileage({...example, [key]:value}), null, `${key}: ${String(value)}`);
});

test('individual field bounds and the derived annual limit reject finite but unusable plans', () => {
  for (const [key, field] of Object.entries(MILEAGE_FIELDS)) assert.equal(calculateAnnualMileage({...example,[key]:field.max+1}), null, key);
  assert.equal(calculateAnnualMileage({oneWayKm:10000,monthlyDays:31}),null,'a combination of individually allowed values cannot exceed the annual limit');
  assert.equal(calculateAnnualMileage({oneWayKm:0,monthlyDays:31,extraAnnualKm:MILEAGE_ANNUAL_LIMIT}).annual, MILEAGE_ANNUAL_LIMIT);
  assert.equal(calculateAnnualMileage({oneWayKm:1,monthlyDays:1,extraAnnualKm:MILEAGE_ANNUAL_LIMIT}),null);
  assert.equal(calculateAnnualMileage({oneWayKm:Number.MIN_VALUE,monthlyDays:Number.MIN_VALUE}),null,'an underflowed positive commute cannot become a zero plan');
  assert.equal(calculateAnnualMileage({oneWayKm:0,monthlyDays:0,extraAnnualKm:Number.MIN_VALUE}),null,'a positive annual distance cannot acquire an unrepresentable zero monthly average');
});

test('distance components are additive and scaling a complete plan scales the total without early rounding', () => {
  const base={oneWayKm:13.7,monthlyDays:20.25,weekendKm:31.9,extraAnnualKm:250.5};
  const a=calculateAnnualMileage(base),b=calculateAnnualMileage({...base,oneWayKm:base.oneWayKm*2,weekendKm:base.weekendKm*2,extraAnnualKm:base.extraAnnualKm*2});
  close(a.annual,a.commuteAnnual+a.weekendAnnual+a.extraAnnual);
  close(b.annual,a.annual*2);
  close(b.monthlyAverage,a.monthlyAverage*2);
});

test('query restoration has pristine defaults but preserves an explicit blank or invalid optional value', () => {
  assert.deepEqual(readMileageQuery(''),{oneWayKm:'',monthlyDays:'',weekendKm:'0',extraAnnualKm:'0'});
  assert.deepEqual(readMileageQuery('?m_one_way=20&m_days=21&m_weekend=80&m_extra=0&km=999'),{oneWayKm:'20',monthlyDays:'21',weekendKm:'80',extraAnnualKm:'0'});
  for(const [key,field] of Object.entries(MILEAGE_FIELDS)) for(const value of ['', '-1', '1e-999', '0x10', 'Infinity', String(field.max+1)]) {
    const restored=readMileageQuery(new URLSearchParams({[field.query]:value}));assert.equal(restored[key],'');
  }
  assert.equal(readMileageQuery('?m_days=20.5').monthlyDays,'20.5');
});

test('a shared URL preserves other parameters and its fragment while round-tripping complete and incomplete plans', () => {
  const original=urlBase+'?ref=guide&km=8000#cost';
  const shared=new URL(mileageUrl(original,example));
  assert.equal(shared.origin,new URL(original).origin);
  assert.equal(shared.pathname,new URL(original).pathname);
  assert.equal(shared.searchParams.get('ref'),'guide');assert.equal(shared.searchParams.get('km'),'8000');assert.equal(shared.hash,'#cost');
  assert.deepEqual(calculateAnnualMileage(readMileageQuery(shared.search)),calculateAnnualMileage(example));
  const blank=new URL(mileageUrl(shared.href,{...example,weekendKm:''}));
  assert.equal(blank.searchParams.has('m_weekend'),true);assert.equal(blank.searchParams.get('m_weekend'),'');
  assert.equal(readMileageQuery(blank.search).weekendKm,'');assert.equal(calculateAnnualMileage(readMileageQuery(blank.search)),null);
  const underflow=new URL(mileageUrl(original,{...example,extraAnnualKm:'1e-999'}));
  assert.equal(underflow.searchParams.get('m_extra'),'');assert.equal(calculateAnnualMileage(readMileageQuery(underflow.search)),null);
});

function node(attributes={}) {
  const attrs=new Map(Object.entries(attributes));let text='',writes=0;
  const classes=new Set();
  return {value:'',hidden:false,disabled:false,dataset:{},handlers:{},writes:()=>writes,
    get textContent(){return text;},set textContent(value){text=String(value);writes++;},
    classList:{toggle(key,on){if(on)classes.add(key);else classes.delete(key);},contains:key=>classes.has(key)},
    addEventListener(name,fn){this.handlers[name]=fn;},getAttribute:key=>attrs.has(key)?attrs.get(key):null,
    setAttribute(key,value){attrs.set(key,String(value));},removeAttribute:key=>attrs.delete(key)};
}
function fixture(url=urlBase) {
  const ids=[...Object.values(MILEAGE_FIELDS).map(field=>field.id),'mileage_form','mileage_example','mileage_result','mileage_status','mileage_annual','mileage_monthly','mileage_commute','mileage_weekend_total','mileage_extra_total','mileage_transfer_note','mileage_copy','mileage_share_status'];
  const nodes=Object.fromEntries(ids.map(id=>[id,node()]));
  const links=Object.fromEntries(Object.entries({annual:'annual-cost',fuel:'fuel-cost',electric:'ev-charge-cost'}).map(([key,slug])=>[key,node({'data-mileage-handoff':key,href:'../../tools/'+slug+'/?ref=annual-guide#result'})]));
  const root={dataset:{},querySelector:selector=>nodes[selector.slice(1)],querySelectorAll:()=>Object.values(links)};
  const clipboard=[],location={href:url},history={state:{test:true},replaceState(_state,_title,url){location.href=url;}};
  const window={location,history,navigator:{clipboard:{async writeText(value){clipboard.push(value);}}}};
  const document={querySelector:()=>root,activeElement:nodes.mileage_days};
  const set=values=>{for(const [key,value] of Object.entries(values))nodes[MILEAGE_FIELDS[key].id].value=String(value);};
  return {nodes,links,root,window,document,set,clipboard};
}

test('initialization is safe, requires complete markup and binds one module instance', () => {
  assert.equal(initAnnualMileage(undefined,undefined),null);assert.equal(initAnnualMileage({querySelector:()=>null},{}),null);
  const f=fixture();const controller=initAnnualMileage(f.document,f.window);assert(controller);assert.equal(f.root.dataset.mileageReady,'true');
  assert.equal(initAnnualMileage(f.document,f.window),null);assert.equal(f.nodes.mileage_result.hidden,true);assert.equal(f.nodes.mileage_copy.disabled,true);
  assert.equal(f.nodes.mileage_weekend.value,'0');assert.equal(f.nodes.mileage_extra.value,'0');assert.equal(f.nodes.mileage_one_way.value,'');
  for(const link of Object.values(f.links)){assert.equal(link.getAttribute('href'),null);assert.equal(link.getAttribute('aria-disabled'),'true');}
});

test('the example populates all inputs, exposes exact annual components and enables matching handoffs', () => {
  const f=fixture(urlBase+'?ref=keep#planner');initAnnualMileage(f.document,f.window);
  f.nodes.mileage_example.handlers.click();assert.equal(f.nodes.mileage_result.hidden,false);assert.equal(f.nodes.mileage_annual.textContent,'14,240 km');
  assert.equal(f.nodes.mileage_commute.textContent,'10,080 km');assert.equal(f.nodes.mileage_weekend_total.textContent,'4,160 km');assert.equal(f.nodes.mileage_extra_total.textContent,'0 km');
  for(const [kind,link] of Object.entries(f.links)){const target=new URL(link.getAttribute('href'));assert.equal(target.searchParams.get(kind==='annual'?'km':'distance'),'14240');assert.equal(target.searchParams.get('ref'),'annual-guide');assert.equal(target.hash,'#result');assert.equal(link.getAttribute('aria-disabled'),null);}
  assert.equal(new URL(f.window.location.href).searchParams.get('ref'),'keep');assert.equal(new URL(f.window.location.href).hash,'#planner');
  assert.equal(f.nodes.mileage_status.classList.contains('mileage-result-ready'),true);assert.match(f.nodes.mileage_status.textContent,/14,240 km/);
  const writes=f.nodes.mileage_status.writes();f.nodes.mileage_form.handlers.change();assert.equal(f.nodes.mileage_status.writes(),writes,'input and change must not repeat the same result announcement');
  assert.equal(f.document.activeElement,f.nodes.mileage_days,'calculation must not move the current input focus');
});

test('invalid edits clear all previous amounts and links, keep errors visible, and retain blank intent in the URL', () => {
  const f=fixture();initAnnualMileage(f.document,f.window);f.nodes.mileage_example.handlers.click();f.nodes.mileage_weekend.value='';f.nodes.mileage_form.handlers.input();
  assert.equal(f.nodes.mileage_result.hidden,true);assert.equal(f.nodes.mileage_copy.disabled,true);assert.equal(f.nodes.mileage_status.classList.contains('mileage-result-ready'),false);
  for(const id of ['mileage_annual','mileage_monthly','mileage_commute','mileage_weekend_total','mileage_extra_total','mileage_transfer_note'])assert.equal(f.nodes[id].textContent,'',id);
  for(const link of Object.values(f.links)){assert.equal(link.getAttribute('href'),null);assert.equal(link.getAttribute('aria-disabled'),'true');}
  const reloaded=fixture(f.window.location.href);initAnnualMileage(reloaded.document,reloaded.window);assert.equal(reloaded.nodes.mileage_weekend.value,'');assert.equal(reloaded.nodes.mileage_result.hidden,true);
  f.nodes.mileage_weekend.value='80';f.nodes.mileage_form.handlers.input();assert.equal(f.nodes.mileage_annual.textContent,'14,240 km');
});

test('handoffs respect the existing annual-tool range while fuel and electric tools allow explicit zero', () => {
  assert.deepEqual(MILEAGE_HANDOFF_BOUNDS,{annual:{min:1000,max:100000},fuel:{min:0,max:10000000},electric:{min:0,max:10000000}});
  const f=fixture();const controller=initAnnualMileage(f.document,f.window);
  for(const distance of [0,0.49,0.5,999,999.5,1000,100000,100000.49,100000.5,100001,1000000]){
    f.set({oneWayKm:0,monthlyDays:0,weekendKm:0,extraAnnualKm:distance});const result=controller.render();assert(result);
    assert.equal(f.nodes.mileage_result.hidden,false);assert.equal(f.nodes.mileage_copy.disabled,false);
    for(const [kind,link] of Object.entries(f.links)){
      const bounds=MILEAGE_HANDOFF_BOUNDS[kind],allowed=result.transferKm>=bounds.min&&result.transferKm<=bounds.max;
      if(allowed){assert.equal(Number(new URL(link.getAttribute('href')).searchParams.get(kind==='annual'?'km':'distance')),result.transferKm);assert.equal(link.getAttribute('aria-disabled'),null);}
      else {assert.equal(link.getAttribute('href'),null);assert.equal(link.getAttribute('aria-disabled'),'true');}
    }
    assert.match(f.nodes.mileage_transfer_note.textContent,/1,000~100,000 km/);
  }
});

test('restored query plans, explicit zero plans and copied links use exactly the displayed current inputs', async () => {
  const f=fixture(mileageUrl(urlBase+'?ref=keep#planner',example));initAnnualMileage(f.document,f.window);
  assert.equal(f.nodes.mileage_annual.textContent,'14,240 km');await f.nodes.mileage_copy.handlers.click();
  assert.equal(f.clipboard.length,1);assert.deepEqual(calculateAnnualMileage(readMileageQuery(new URL(f.clipboard[0]).search)),calculateAnnualMileage(example));
  assert.match(f.nodes.mileage_share_status.textContent,/복사했습니다/);
  f.set({oneWayKm:0,monthlyDays:0,weekendKm:0,extraAnnualKm:0});f.nodes.mileage_form.handlers.input();await f.nodes.mileage_copy.handlers.click();assert.equal(readMileageQuery(new URL(f.clipboard[1]).search).extraAnnualKm,'0');
  assert.equal(f.nodes.mileage_annual.textContent,'0 km');
});

test('history and clipboard failures do not disable calculation or promise a successful copy', async () => {
  const f=fixture();f.window.history.replaceState=()=>{throw new Error('unavailable');};f.window.navigator.clipboard.writeText=async()=>{throw new Error('denied');};
  initAnnualMileage(f.document,f.window);f.nodes.mileage_example.handlers.click();assert.equal(f.nodes.mileage_annual.textContent,'14,240 km');await f.nodes.mileage_copy.handlers.click();assert.match(f.nodes.mileage_share_status.textContent,/복사하지 못했습니다/);
});

test('completion of an older clipboard write cannot show a copied message after an invalid edit', async () => {
  const f=fixture();let resolveCopy;f.window.navigator.clipboard.writeText=()=>new Promise(resolve=>{resolveCopy=resolve;});initAnnualMileage(f.document,f.window);f.nodes.mileage_example.handlers.click();
  const copy=f.nodes.mileage_copy.handlers.click();f.nodes.mileage_days.value='';f.nodes.mileage_form.handlers.input();resolveCopy();await copy;
  assert.equal(f.nodes.mileage_share_status.textContent,'');assert.equal(f.nodes.mileage_result.hidden,true);
});

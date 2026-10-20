import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionUrl, readConditions, addCondition, MAX_SAVED} from '../assets/saved-conditions.js';
import {patchSavedConditions} from './saved-conditions.mjs';
const origin = 'https://peekmycar.com';
test('keeps only condition keys and drops credentials, OAuth fragments and trackers', () => {
  assert.equal(conditionUrl(origin+'/compare/?fa=kia-sorento&km=20000&code=secret&access_token=secret&utm_source=x#access_token=x',origin), '/compare/?fa=kia-sorento&km=20000');
  assert.equal(conditionUrl(origin+'/tools/car-installment/?loan_rate=0&loan_months=36',origin), '/tools/car-installment/?loan_rate=0&loan_months=36');
});
test('hybrid payback keeps its selected pair and purchase-price gap while dropping secrets', () => {
  const url='/tools/hybrid-break-even/?pair=sorento-gasoline-vs-hybrid&gap=3000000&price=1800&km=30000&code=private&access_token=private#refresh_token=private';
  const cleaned=conditionUrl(origin+url,origin);
  assert.equal(cleaned,'/tools/hybrid-break-even/?pair=sorento-gasoline-vs-hybrid&gap=3000000&price=1800&km=30000');
  const stored=readConditions(JSON.stringify({version:1,items:[{id:'hybrid',label:'출퇴근 하이브리드',url,createdAt:1}]}),origin);
  assert.equal(stored[0].url,cleaned);
});
test('reviewed detail keeps engine, drive and wheel selection rather than reverting to its representative trim', () => {
  const url='/cars/hyundai/grandeur-gn7/?spec=gas35&drive=AWD&wheel=20&km=30000&reg=2024-01&cprice_gasoline=1800';
  assert.equal(conditionUrl(origin+url+'&code=secret&access_token=secret#refresh_token=secret',origin),url);
  const stored=readConditions(JSON.stringify({version:1,items:[{id:'grandeur-awd',label:'그랜저 3.5 AWD 20인치',url,createdAt:2}]}),origin);
  const params=new URL(stored[0].url,origin).searchParams;
  for(const [key,value]of [['spec','gas35'],['drive','AWD'],['wheel','20'],['km','30000'],['reg','2024-01'],['cprice_gasoline','1800']])assert.equal(params.get(key),value);
});
test('the shared allowlist preserves the existing comparison and tool condition namespaces', () => {
  const inputs=[
    ['/compare/','mode=reviewed&a=grandeur-gn7&av=gn7-g25-2wd-18&b=k8-gl3&bv=k8-g25&km=30000&gas=1800&diesel=1700&lpg=1100&elec=300'],
    ['/tools/annual-cost/','mode=all&fa=kia-sorento&calc=kea-display-example&reg=2024-01&km=15000&cprice_gasoline=1800'],
    ['/tools/car-tax/','taxFuel=engine&cc=1599&registration=2024-01'],
    ['/tools/fuel-cost/','fuel=diesel&distance=600&efficiency=15&unitPrice=1700'],
    ['/tools/ev-charge-cost/','distance=600&efficiency=5&unitPrice=300&charge_kwh=60&charge_price=300&charge_monthly_km=1000&charge_efficiency=5&charge_slow_price=200&charge_fast_price=400&charge_fast_share=25'],
    ['/tools/fuel-efficiency/','measured_mode=fuel&measured_distance=600&measured_quantity=40&measured_price=1800&measured_fuel=gasoline'],
    ['/tools/car-installment/','loan_principal=30000000&loan_rate=4.5&loan_months=36&loan_method=equal-payment']
  ];
  for(const [path,query]of inputs)assert.equal(conditionUrl(origin+path+'?'+query+'&code=secret&refresh_token=secret&utm_source=qa',origin),path+'?'+query);
});
test('rejects external, protocol-relative, auth and non-tool paths', () => {
  for (const href of ['https://evil.test/compare/','//evil.test/compare/','javascript:alert(1)',origin+'/community/',origin+'/auth/callback/',origin+'/cars/',origin+'/cars/kia/',origin+'/cars/%2e%2e/compare/',origin+'/tools/../community/']) assert.equal(conditionUrl(href,origin),null,href);
});
test('supports preview prefix without leaking it across origins', () => {
  assert.equal(conditionUrl(origin+'/docs/car-data-preview/cars/family/?id=kia-sorento',origin,'/docs/car-data-preview/'),'/docs/car-data-preview/cars/family/?id=kia-sorento');
  assert.equal(conditionUrl(origin+'/compare/',origin,'/docs/car-data-preview/'),null);
});
test('malformed, unknown schemas and duplicate IDs cannot break load', () => {
  for(const raw of ['', 'null', '{}','{bad','{"version":2,"items":[]}']) assert.deepEqual(readConditions(raw,origin),[]);
  const items=[{id:'a',label:'한글',url:'/compare/?code=secret',createdAt:2},{id:'a',label:'중복',url:'/compare/'},{id:'b',label:'외부',url:'//evil.test/compare/'},{id:'c',label:'긴 이름'.repeat(40),url:'/tools/fuel-cost/'}];
  const got=readConditions(JSON.stringify({version:1,items}),origin);
  assert.equal(got.length,2);assert.equal(got[0].url,'/compare/');assert.equal(got[1].label.length,60);
});
test('saving updates duplicates and enforces bounded storage', () => {
  let items=[];for(let i=0;i<20;i++) items=addCondition(items,{id:String(i),url:'/compare/?km='+i,label:String(i)});
  assert.equal(items.length,MAX_SAVED);items=addCondition(items,{id:'again',url:items[3].url,label:'수정'});assert.equal(items.length,MAX_SAVED);assert.equal(items[0].id,'again');
});
test('HTML patch is idempotent, one module and no widget on auth or search', () => {
  const html='<html><head></head><body><main><h1>도구</h1></main></body></html>';
  const first=patchSavedConditions(html,'tools/car-installment/index.html');assert.equal(patchSavedConditions(first,'tools/car-installment/index.html'),first);assert.equal((first.match(/data-save-condition>/g)||[]).length,1);
  assert.equal(patchSavedConditions(html,'search/index.html'),html);assert.equal(patchSavedConditions(html,'community/index.html'),html);
});
test('privacy disclosure describes explicit local-only storage and stays single-shot', () => {
  const html='<html><body><main><h2>계산 입력값</h2><p>계산은 브라우저에서 합니다.</p></main></body></html>';
  const once=patchSavedConditions(html,'privacy/index.html');
  assert.match(once,/localStorage/);assert.match(once,/최대 12개/);assert.match(once,/공유하면 해당 입력값/);assert.equal(patchSavedConditions(once,'privacy/index.html'),once);assert(!once.includes('data-saved-conditions'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {renderMeasuredEfficiencyPage} from './measured-efficiency-page.mjs';
import {renderCarInstallmentPage} from './car-installment-page.mjs';
import {calculateMeasuredEfficiency} from '../assets/measured-efficiency.js';
import {calculateInstallment} from '../assets/car-installment.js';
import {REVIEWED_TOOL_FILES, REVIEWED_TOOL_ROUTES, reviewedToolIndexChecks, reviewedToolStructuredData, reviewedToolSchemaChecks} from './reviewed-tool-index-quality.mjs';

const measuredFile='tools/fuel-efficiency/index.html';
const loanFile='tools/car-installment/index.html';
const measured=()=>renderMeasuredEfficiencyPage().content;
const loan=()=>renderCarInstallmentPage().content;
const failures=(file,html)=>reviewedToolIndexChecks(file,html).filter(check=>!check.pass).map(check=>check.name);
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const money=number=>number.toLocaleString('ko-KR')+'원';

test('new indexing approval names exactly the two reviewed calculator routes',()=>{
  assert.deepEqual(REVIEWED_TOOL_FILES,[measuredFile,loanFile]);
  assert.deepEqual(REVIEWED_TOOL_ROUTES,['/tools/fuel-efficiency/','/tools/car-installment/']);
  for(const file of ['tools/ev-charge-cost/index.html','tools/index.html','community/index.html','cars/family/index.html','search/index.html'])assert.equal(reviewedToolIndexChecks(file,measured()),null);
});

test('both real templates pass the published method, example, limits and linking checks',()=>{
  assert.deepEqual(failures(measuredFile,measured()),[]);
  assert.deepEqual(failures(loanFile,loan()),[]);
  assert.equal(renderMeasuredEfficiencyPage().faqs.length,4);
  assert.equal(renderCarInstallmentPage().faqs.length,4);
});

test('static fuel and electric examples agree with the actual calculator and keep their units',()=>{
  const html=text(measured());
  const fuel=calculateMeasuredEfficiency({mode:'fuel',distance:600,quantity:40,unitPrice:1800});
  const electric=calculateMeasuredEfficiency({mode:'electric',distance:600,quantity:120,unitPrice:300});
  assert.equal(fuel.efficiency,600/40);
  assert.equal(electric.efficiency,600/120);
  assert.ok(html.includes(fuel.efficiency+' '+fuel.efficiencyUnit));
  assert.ok(html.includes(electric.efficiency+' '+electric.efficiencyUnit));
  assert.ok(html.includes(money(fuel.costPer100)));
  assert.ok(html.includes(money(electric.recordCost)));
  assert.equal(fuel.costPer100,12000);
  assert.equal(electric.recordCost,36000);
});

test('static installment examples reconcile with both repayment methods',()=>{
  const html=text(loan());
  const payment=calculateInstallment({principal:30000000,annualRate:5,months:36,method:'equal-payment'});
  const principal=calculateInstallment({principal:30000000,annualRate:5,months:36,method:'equal-principal'});
  for(const amount of [payment.firstPayment,payment.totalInterest,payment.totalPayment,principal.firstPayment,principal.lastPayment,principal.totalInterest])assert.ok(html.includes(money(amount)),money(amount)+' must match the calculator');
  const monthlyRate=5/100/12;
  const independentMonthly=30000000*monthlyRate/(1-Math.pow(1+monthlyRate,-36));
  assert.ok(Math.abs(payment.referencePayment-independentMonthly)<0.000001);
  assert.equal(payment.totalPayment,30000000+payment.totalInterest);
});

test('missing method sections cannot be replaced by arbitrary FAQ or saved-condition details',()=>{
  const fake='<form><input><button>계산</button></form>'+Array.from({length:8},()=>'<details><summary>저장한 조건</summary></details>').join('');
  for(const file of REVIEWED_TOOL_FILES)assert.ok(failures(file,fake).includes('reviewed_method_section'));
});

test('wrong units, amounts or monthly-rate formula block the newly approved tool',()=>{
  assert.ok(failures(measuredFile,measured().replace('<strong>15 km/L</strong>','<strong>15 km/kWh</strong>')).includes('measured_worked_examples'));
  assert.ok(failures(measuredFile,measured().replace('<strong>36,000원</strong>','<strong>3,600원</strong>')).includes('measured_worked_examples'));
  assert.ok(failures(loanFile,loan().replace('899,127원','899,128원')).includes('installment_worked_examples'));
  assert.ok(failures(loanFile,loan().replace('÷ 100 ÷ 12','÷ 12')).includes('installment_formulas'));
});

test('related tool links and measurement or quote limitations are mandatory',()=>{
  assert.ok(failures(measuredFile,measured().replace('href="../fuel-cost/"','href="#"')).includes('related_calculation_links'));
  assert.ok(failures(loanFile,loan().replace('href="../annual-cost/"','href="#"')).includes('related_calculation_links'));
  assert.ok(failures(measuredFile,measured().replace('data-calculation-limits="measured"','data-removed="measured"')).includes('measured_scope_and_measurement_limits'));
  assert.ok(failures(loanFile,loan().replace('현재 금융상품의 금리가 아닙니다','일반적인 금리입니다')).includes('installment_quote_and_scope_limits'));
});

test('measured optional price markup accepts an explicitly free record',()=>{
  const input=measured().match(/<input\b[^>]*id="measuredPrice"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input,/\bmin="0"/);
  assert.ok(!/\brequired\b/.test(input));
});


test('both newly approved pages declare an informational WebPage and breadcrumbs only',()=>{
  for(const [file,page] of [[measuredFile,renderMeasuredEfficiencyPage()],[loanFile,renderCarInstallmentPage()]]) {
    assert.equal(page.schemaType,'WebPage');
    for(const base of ['https://peekmycar.com/','https://5ggul.github.io/pm-lab/car-data-preview/']) {
      const url=new URL(file.replace(/index\.html$/,''),base).href;
      const graph=reviewedToolStructuredData(file,{url,title:page.title,base});
      assert.deepEqual(graph.map(node=>node['@type']),['WebPage','BreadcrumbList']);
      assert.equal(graph[0].url,url);
      assert.equal(graph[1].itemListElement.at(-1).item,url);
      assert.equal(graph[1].itemListElement[1].item,new URL('tools/',base).href);
      const html='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':graph})+'</script>';
      assert.deepEqual(reviewedToolSchemaChecks(html).filter(check=>!check.pass),[]);
      for(const property of ['offers','review','aggregateRating','applicationCategory','operatingSystem'])assert.ok(!JSON.stringify(graph).includes('"'+property+'"'));
    }
  }
});

test('the schema change cannot apply to an existing tool, community or internal page',()=>{
  for(const file of ['tools/annual-cost/index.html','tools/ev-charge-cost/index.html','tools/car-tax/index.html','community/index.html','cars/family/index.html']) {
    assert.equal(reviewedToolStructuredData(file,{url:'https://peekmycar.com/',title:'unchanged',base:'https://peekmycar.com/'}),null);
  }
});

test('incomplete application schemas and invented offers or ratings block the reviewed pages',()=>{
  const config={url:'https://peekmycar.com/tools/car-installment/',title:renderCarInstallmentPage().title,base:'https://peekmycar.com/'};
  const wrap=graph=>'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':graph})+'</script>';
  const original=reviewedToolStructuredData(loanFile,config);
  for(const type of ['WebApplication','SoftwareApplication','https://schema.org/Product']) {
    const graph=structuredClone(original);graph[0]['@type']=type;
    assert.ok(reviewedToolSchemaChecks(wrap(graph)).some(check=>check.name==='reviewed_informational_schema'&&!check.pass));
  }
  for(const property of ['offers','review','aggregateRating','applicationCategory','operatingSystem']) {
    const graph=structuredClone(original);graph[0][property]={value:'unverified'};
    assert.ok(reviewedToolSchemaChecks(wrap(graph)).some(check=>check.name==='no_unsubstantiated_app_offer_or_rating'&&!check.pass));
  }
});

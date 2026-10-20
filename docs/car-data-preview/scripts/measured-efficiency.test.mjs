import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {calculateMeasuredEfficiency, measuredCostHref, parseMeasuredEfficiencyParams, initMeasuredEfficiency, MEASURED_LIMITS} from '../assets/measured-efficiency.js';
import {renderMeasuredEfficiencyPage} from './measured-efficiency-page.mjs';

test('fill-to-fill fuel records produce measured km/L and cost for the same interval', () => {
  const result = calculateMeasuredEfficiency({distance: 600, quantity: 40, unitPrice: 1800});
  assert.equal(result.efficiency, 15);
  assert.equal(result.efficiencyUnit, 'km/L');
  assert.equal(result.quantityUnit, 'L');
  assert.equal(result.priceUnit, '원/L');
  assert.equal(result.costPer100, 12000);
  assert.equal(result.recordCost, 72000);
});

test('electric records retain kWh units and never become a fuel-cost link', () => {
  const input = {mode: 'electric', distance: 360, quantity: 60, unitPrice: 300};
  const result = calculateMeasuredEfficiency(input);
  assert.equal(result.efficiency, 6);
  assert.equal(result.efficiencyUnit, 'km/kWh');
  assert.equal(result.quantityUnit, 'kWh');
  assert.equal(result.priceUnit, '원/kWh');
  assert(Math.abs(result.costPer100 - 5000) < 1e-9);
  assert.equal(result.recordCost, 18000);
  assert.equal(result.fuel, null);
  const target = new URL(measuredCostHref(input), 'https://peekmycar.com/tools/fuel-efficiency/');
  assert.equal(target.pathname, '/tools/ev-charge-cost/');
  assert.equal(target.searchParams.get('unitPrice'), '300');
  assert(!target.searchParams.has('fuel'));
});

test('doubling a complete record preserves efficiency and per-100km cost, but doubles interval cost', () => {
  const a = calculateMeasuredEfficiency({distance: 375.6, quantity: 25.04, unitPrice: 1777.12});
  const b = calculateMeasuredEfficiency({distance: 751.2, quantity: 50.08, unitPrice: 1777.12});
  assert.equal(a.efficiency, b.efficiency);
  assert.equal(a.costPer100, b.costPer100);
  assert.equal(b.recordCost, a.recordCost * 2);
  assert(Math.abs(a.per100 * a.distance / 100 - a.quantity) < 1e-10);
});

test('an omitted optional unit price never invents zero-cost travel', () => {
  for (const unitPrice of [undefined, null, '', '   ']) {
    const result = calculateMeasuredEfficiency({distance: 400, quantity: 25, unitPrice});
    assert.equal(result.efficiency, 16);
    assert.equal(result.costPer100, null);
    assert.equal(result.recordCost, null);
    assert(!new URL(measuredCostHref({distance: 400, quantity: 25, unitPrice}), 'https://peekmycar.com/tools/fuel-efficiency/').searchParams.has('unitPrice'));
  }
});

test('invalid required values, invalid supplied prices and unsupported units cannot produce usable results', () => {
  for (const value of [null, undefined, '', [], false]) assert.equal(calculateMeasuredEfficiency(value), null);
  const bad = ['', ' ', 0, -1, NaN, Infinity, -Infinity, 'NaN', 'Infinity', '0x10', '1,000', '<script>', true, {}, []];
  for (const field of ['distance', 'quantity']) {
    for (const value of bad) {
      const input = {distance: 600, quantity: 40, [field]: value};
      assert.equal(calculateMeasuredEfficiency(input), null, `${field}: ${String(value)}`);
      assert.equal(measuredCostHref(input), null);
    }
  }
  for (const unitPrice of bad.filter(value => !['', ' '].includes(value))) assert.equal(calculateMeasuredEfficiency({distance: 600, quantity: 40, unitPrice}), null);
  for (const input of [{mode: 'diesel'}, {mode: 'kWh'}, {mode: '__proto__'}, {fuel: 'electric'}, {fuel: 'unknown'}]) assert.equal(calculateMeasuredEfficiency({distance: 600, quantity: 40, ...input}), null);
});

test('limits and floating-point overflow are guarded without rounding valid inputs early', () => {
  for (const [field, limit] of Object.entries(MEASURED_LIMITS)) {
    const key = field === 'price' ? 'unitPrice' : field;
    assert.equal(calculateMeasuredEfficiency({distance: 600, quantity: 40, unitPrice: 1800, [key]: limit * 2}), null);
  }
  assert.equal(calculateMeasuredEfficiency({distance: 1, quantity: '1e-324'}), null);
  assert.equal(calculateMeasuredEfficiency({distance: 1000000, quantity: '1e-310'}), null);
  const result = calculateMeasuredEfficiency({distance: 1, quantity: 3});
  assert.equal(result.efficiency, 1 / 3);
  const target = new URL(measuredCostHref({distance: 1, quantity: 3}), 'https://peekmycar.com/tools/fuel-efficiency/');
  assert.equal(Number(target.searchParams.get('efficiency')), 1 / 3);
});

test('fuel and price context reach the existing fuel calculator with full-precision results', () => {
  const target = new URL(measuredCostHref({mode: 'fuel', fuel: 'diesel', distance: '555.5', quantity: '42.1', unitPrice: '1700.55'}), 'https://peekmycar.com/tools/fuel-efficiency/');
  assert.equal(target.pathname, '/tools/fuel-cost/');
  assert.equal(target.searchParams.get('fuel'), 'diesel');
  assert.equal(target.searchParams.get('distance'), '555.5');
  assert.equal(target.searchParams.get('unitPrice'), '1700.55');
  assert.equal(Number(target.searchParams.get('efficiency')), 555.5 / 42.1);
});

test('direct query input uses namespaced parameters and rejects invalid or ambiguous units', () => {
  const state = parseMeasuredEfficiencyParams('?measured_mode=electric&measured_distance=360&measured_quantity=60&measured_price=300&distance=999');
  assert.deepEqual(state, {mode: 'electric', fuel: 'gasoline', distance: '360', quantity: '60', unitPrice: '300', invalidFields: []});
  const invalid = parseMeasuredEfficiencyParams('?measured_mode=unknown&measured_distance=600&measured_quantity=40&measured_price=1800');
  assert.deepEqual(invalid.invalidFields, ['mode']);
  assert.equal(invalid.quantity, '');
  assert.equal(invalid.unitPrice, '');
  for (const value of ['0', '-1', 'Infinity', 'NaN', '1e100']) {
    const restored = parseMeasuredEfficiencyParams(new URLSearchParams({measured_distance: value, measured_quantity: '40'}));
    assert.equal(restored.distance, '');
    assert(restored.invalidFields.includes('distance'));
  }
});

function fakePage() {
  const names = ['Mode', 'Fuel', 'FuelField', 'Distance', 'Quantity', 'Price', 'QuantityLabel', 'PriceLabel', 'RecordHint', 'ResultHeading', 'EfficiencyValue', 'Breakdown', 'Status', 'CostRows', 'CostPer100', 'RecordCost', 'CostLink'];
  const element = () => ({value: '', textContent: '', hidden: false, dataset: {}, listeners: {}, addEventListener(name, run) {this.listeners[name] = run;}, removeAttribute(name) {delete this[name];}});
  const elements = Object.fromEntries(names.map(name => [name, element()])), form = element();
  return {elements, form, document: {querySelector: () => form, getElementById: id => elements[id.slice('measured'.length)]}};
}

test('invalid edits immediately remove the prior result, cost and transfer link', () => {
  const page = fakePage(), controller = initMeasuredEfficiency(page.document), e = page.elements;
  e.Distance.value = '600'; e.Quantity.value = '40'; e.Price.value = '1800'; controller.render();
  assert.equal(e.EfficiencyValue.textContent, '15 km/L');
  assert.equal(e.CostPer100.textContent, '12,000원');
  assert.equal(e.CostRows.hidden, false);
  assert.equal(e.CostLink.hidden, false);
  for (const value of ['', '0', '-1', 'NaN', 'Infinity', '1e100']) {
    e.Quantity.value = value; controller.render();
    assert.equal(e.EfficiencyValue.textContent, '—');
    assert.equal(e.CostPer100.textContent, '—');
    assert.equal(e.CostRows.hidden, true);
    assert.equal(e.CostLink.hidden, true);
    assert.equal(e.CostLink.href, undefined);
  }
});

test('switching between litres and kWh clears quantity and price before recalculating', () => {
  const page = fakePage(), controller = initMeasuredEfficiency(page.document), e = page.elements;
  e.Distance.value = '600'; e.Quantity.value = '40'; e.Price.value = '1800'; controller.render();
  e.Mode.value = 'electric'; e.Mode.listeners.change();
  assert.equal(e.Quantity.value, '');
  assert.equal(e.Price.value, '');
  assert.equal(e.Distance.value, '600');
  assert.equal(e.FuelField.hidden, true);
  assert.match(e.QuantityLabel.textContent, /kWh/);
  assert.equal(e.EfficiencyValue.textContent, '—');
  assert.equal(e.CostLink.hidden, true);
  e.Quantity.value = '100'; e.Price.value = '300'; controller.render();
  assert.equal(e.EfficiencyValue.textContent, '6 km/kWh');
  e.Mode.value = 'fuel'; e.Mode.listeners.change();
  assert.equal(e.Quantity.value, '');
  assert.equal(e.Price.value, '');
  assert.equal(e.FuelField.hidden, false);
  assert.equal(e.EfficiencyValue.textContent, '—');
  assert.equal(initMeasuredEfficiency(page.document), null, 'initializing twice cannot register duplicate listeners');
});

test('page renderer supplies isolated markup and a module script while importing safely in Node', () => {
  assert.equal(initMeasuredEfficiency(), null);
  const page = renderMeasuredEfficiencyPage();
  assert.equal(page.title, '실연비 계산기');
  assert.deepEqual(page.scripts, [{src: 'measured-efficiency.js', type: 'module'}]);
  assert(page.faqs.every(row => row.length === 2 && row.every(value => typeof value === 'string' && value.length > 0)));
  for (const name of ['measured_mode', 'measured_fuel', 'measured_distance', 'measured_quantity', 'measured_price']) assert(page.content.includes(`name="${name}"`));
  assert.match(page.content, /form id="measuredEfficiencyForm" class="tool-panel"/);
  assert.match(page.content, /class="tool-panel utility-result"/);
  assert.match(page.content, /공인연비·전비가 아닙니다/);
  assert.match(page.content, /id="measuredCostLink"[^>]* hidden/);
  assert.doesNotMatch(page.content, /<script|<style|localStorage|sessionStorage|fetch\(/);
});

test('measurement transfer accepts only efficiency values the receiving tools can restore', () => {
  for (const mode of ['fuel', 'electric']) {
    for (const input of [{distance: 100, quantity: 0.000001}, {distance: 0.000001, quantity: 100000}]) {
      const record = {mode, unitPrice: 1800, ...input};
      assert(calculateMeasuredEfficiency(record), 'the measurement remains readable');
      assert.equal(measuredCostHref(record), null, 'an unrepresentable target value has no transfer URL');
    }
    for (const input of [{distance: 0.1, quantity: 100000}, {distance: 10000, quantity: 1}]) {
      assert(measuredCostHref({mode, ...input}), 'both receiving-tool boundaries remain transferable');
    }
  }
});

test('out-of-range transfer clears an earlier link without discarding the measured record', () => {
  const page = fakePage(), controller = initMeasuredEfficiency(page.document), e = page.elements;
  e.Distance.value = '600'; e.Quantity.value = '40'; e.Price.value = '1800'; controller.render();
  assert.equal(e.CostLink.hidden, false);
  e.Distance.value = '100'; e.Quantity.value = '0.000001'; controller.render();
  assert.notEqual(e.EfficiencyValue.textContent, '—');
  assert.equal(e.CostLink.hidden, true);
  assert.equal(e.CostLink.href, undefined);
  assert.match(e.Status.textContent, /비용 계산기로 전달할 수 있는 효율 범위/);
});

async function existingCostTool(kind, search) {
  const values = {distance: '20000', efficiency: '12', unitPrice: '1800', fuel: 'gasoline', taxFuel: 'engine', cc: '1599', registration: '2026-01'};
  const elements = Object.fromEntries(Object.entries({...values, costResult: '', costBreakdown: '', priceOrigin: '', liveFuelStatus: ''}).map(([id, value]) => [id, {value, textContent: '', listeners: {}, classList: {toggle() {}, add() {}}, addEventListener(name, run) {this.listeners[name] = run;}}]));
  const form = {dataset: {kind,taxYear:'2026'}, addEventListener() {}};
  const location = new URL('https://peekmycar.com/tools/' + kind + '/' + search);
  const context = vm.createContext({URL, URLSearchParams, Date, document: {querySelector() {return form;}, getElementById(id) {return elements[id];}, currentScript: {src: 'https://peekmycar.com/assets/simple-cost-tools.js'}}, location, history: {state: null, replaceState() {}}, fetch: async url => ({ok: true, json: async () => String(url).includes('fuel-price.json') ? {prices: {gasoline: 1999, diesel: 1888, lpg: 1111}, price_as_of: '2026-10-20'} : {}})});
  vm.runInContext(fs.readFileSync(new URL('../assets/cost-math.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../assets/simple-cost-tools.js', import.meta.url), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}

test('the receiving tool never silently replaces an explicitly invalid efficiency with its default', async () => {
  for (const kind of ['fuel-cost', 'ev-charge-cost']) {
    for (const efficiency of ['100000000', '0.00000000001', 'Infinity', '', '-1']) {
      const elements = await existingCostTool(kind, '?distance=100&unitPrice=1800&efficiency=' + efficiency);
      assert.equal(elements.efficiency.value, '');
      assert.equal(elements.costResult.textContent, '거리·효율·단가를 입력하세요');
    }
    const valid = await existingCostTool(kind, '?distance=600&unitPrice=1800&efficiency=15');
    assert.equal(valid.efficiency.value, '15');
    assert.equal(valid.unitPrice.value, '1800');
    assert.equal(valid.costResult.textContent, '72,000원');
  }
});

test('a bad explicitly supplied price remains blank after the asynchronous national-price request', async () => {
  const invalid = await existingCostTool('fuel-cost', '?distance=600&efficiency=15&unitPrice=0');
  assert.equal(invalid.unitPrice.value, '');
  assert.equal(invalid.costResult.textContent, '거리·효율·단가를 입력하세요');
  assert.match(invalid.priceOrigin.textContent, /주소의 단가가 올바르지 않습니다/);
  const omitted = await existingCostTool('fuel-cost', '?distance=600&efficiency=15');
  assert.equal(omitted.unitPrice.value, 1999, 'an absent price retains the intentional national-average default');
});

test('an explicitly invalid tax registration month cannot silently become the default new-car month', async () => {
  for(const registration of ['', 'bad', '2026-13', '2027-01', '1899-12']){
    const invalid=await existingCostTool('car-tax','?taxFuel=engine&cc=1599&registration='+registration);
    assert.equal(invalid.registration.value,'');
    assert.equal(invalid.costResult.textContent,'입력값을 확인하세요');
  }
  const restored=await existingCostTool('car-tax','?taxFuel=engine&cc=1599&registration=2024-01');
  assert.equal(restored.registration.value,'2024-01');
  assert.notEqual(restored.costResult.textContent,'입력값을 확인하세요');
  const omitted=await existingCostTool('car-tax','');
  assert.equal(omitted.registration.value,'2026-01');
  assert.notEqual(omitted.costResult.textContent,'입력값을 확인하세요');
});

test('unknown explicit fuel and tax vehicle types require a selection rather than a default calculation', async () => {
  for(const value of ['', 'unknown', 'hydrogen']){
    const fuel=await existingCostTool('fuel-cost','?distance=600&efficiency=15&unitPrice=1800&fuel='+value);
    assert.equal(fuel.fuel.value,'');
    assert.equal(fuel.costResult.textContent,'연료 종류를 선택하세요');
    const tax=await existingCostTool('car-tax','?cc=1599&registration=2026-01&taxFuel='+value);
    assert.equal(tax.taxFuel.value,'');
    assert.equal(tax.costResult.textContent,'입력값을 확인하세요');
    assert.equal(tax.costBreakdown.textContent,'차량 유형을 다시 선택하세요.');
  }
  const electric=await existingCostTool('car-tax','?taxFuel=electric');
  assert.equal(electric.costResult.textContent,'130,000원');
  const omittedFuel=await existingCostTool('fuel-cost','?distance=600&efficiency=15&unitPrice=1800');
  assert.equal(omittedFuel.fuel.value,'gasoline');
  assert.equal(omittedFuel.costResult.textContent,'72,000원');
});

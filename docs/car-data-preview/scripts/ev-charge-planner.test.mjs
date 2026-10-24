import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARGE_PLANNER_FIELDS, CHARGE_PLANNER_LIMITS, chargeNumber, calculateChargeSession, calculateMixedCharge,
  readChargePlannerQuery, chargePlannerUrl, initEvChargePlanner} from '../assets/ev-charge-planner.js';
import {renderEvChargePlanner} from './ev-charge-planner.mjs';

const mixed = overrides => calculateMixedCharge({monthlyKm: 1000, efficiency: 5, slowPrice: 200, fastPrice: 400, fastShare: 25, ...overrides});
const close = (actual, expected) => assert(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} != ${expected}`);

test('single-session cost uses metered kWh and the exact entered price without a charging-loss assumption', () => {
  const result = calculateChargeSession({energyKwh: '42.6', unitPrice: '347.2'});
  close(result.cost, 42.6 * 347.2);
  assert.equal(result.energyKwh, 42.6);
  assert.equal(result.unitPrice, 347.2);
  assert.equal(calculateChargeSession({energyKwh: 0, unitPrice: 347.2}).cost, 0);
});

test('an explicit zero price is free charging while empty or nonnumeric values never become zero', () => {
  assert.equal(calculateChargeSession({energyKwh: 50, unitPrice: '0'}).cost, 0);
  assert.equal(mixed({slowPrice: 0, fastPrice: 0}).annualCost, 0);
  for (const invalid of ['', '  ', null, undefined, false, [], {}, NaN, Infinity, -Infinity, 'Infinity', '0x10', '-1']) {
    assert.equal(chargeNumber(invalid), null, String(invalid));
    assert.equal(calculateChargeSession({energyKwh: 50, unitPrice: invalid}), null);
    assert.equal(mixed({slowPrice: invalid}), null);
  }
});

test('mixed prices are weighted by energy share and annual cost uses twelve unrounded monthly costs', () => {
  assert.deepEqual(mixed(), {monthlyKm: 1000, efficiency: 5, slowPrice: 200, fastPrice: 400, fastShare: 25,
    weightedPrice: 250, monthlyKwh: 200, monthlyCost: 50000, annualCost: 600000});
  const fractional = mixed({monthlyKm: 17, efficiency: 3, slowPrice: 201.1, fastPrice: 402.2, fastShare: 37.5});
  close(fractional.weightedPrice, 201.1 * 0.625 + 402.2 * 0.375);
  close(fractional.annualCost, (17 / 3) * fractional.weightedPrice * 12);
  assert.notEqual(fractional.annualCost, Math.round(fractional.monthlyCost) * 12);
});

test('all-slow and all-fast boundaries preserve their prices; zero distance has zero energy and cost', () => {
  assert.equal(mixed({fastShare: 0}).weightedPrice, 200);
  assert.equal(mixed({fastShare: 100}).weightedPrice, 400);
  const zero = mixed({monthlyKm: 0});
  assert.equal(zero.monthlyKwh, 0);
  assert.equal(zero.monthlyCost, 0);
  assert.equal(zero.annualCost, 0);
  assert.equal(zero.weightedPrice, 250);
  assert.equal(mixed({fastShare: 0, fastPrice: ''}).annualCost, 480000);
  assert.equal(mixed({fastShare: 100, slowPrice: ''}).annualCost, 960000);
});

test('negative, incomplete, out-of-range and overflowing calculations cannot leave a usable result', () => {
  for (const overrides of [{monthlyKm: -1}, {efficiency: 0}, {efficiency: -1}, {efficiency: ''},
    {slowPrice: -1}, {fastPrice: -1}, {fastShare: -1}, {fastShare: 100.01}, {fastShare: ''},
    {monthlyKm: Infinity}, {fastPrice: NaN}, {monthlyKm: 1e308, efficiency: 1e-300},
    {monthlyKm: 1e300, efficiency: 1, slowPrice: 1e300}, {monthlyKm: 2e307, efficiency: 1, slowPrice: 1, fastPrice: 1}]) {
    assert.equal(mixed(overrides), null, JSON.stringify(overrides));
  }
  assert.equal(calculateChargeSession({energyKwh: 1e308, unitPrice: 2}), null);
  assert.equal(calculateChargeSession({energyKwh: '', unitPrice: 0}), null);
  assert.equal(calculateChargeSession(null), null);
  assert.equal(calculateMixedCharge(null), null);
});

test('declared input and derived energy bounds reject enormous finite values', () => {
  const limits = CHARGE_PLANNER_LIMITS;
  assert.equal(calculateChargeSession({energyKwh: limits.energy, unitPrice: limits.price}).cost, limits.energy * limits.price);
  for (const input of [{energyKwh: limits.energy + 1, unitPrice: 1}, {energyKwh: 1, unitPrice: limits.price + 1}, {energyKwh: 1e200, unitPrice: 1}]) assert.equal(calculateChargeSession(input), null);
  for (const overrides of [{monthlyKm: limits.distance + 1}, {efficiency: limits.efficiency + 1}, {slowPrice: limits.price + 1}, {fastPrice: limits.price + 1}, {monthlyKm: 1001, efficiency: 0.001}]) assert.equal(mixed(overrides), null);
  const edge = mixed({monthlyKm: limits.distance, efficiency: 10, slowPrice: limits.price, fastPrice: limits.price});
  assert.equal(edge.monthlyKwh, limits.energy);
  assert(edge.monthlyCost <= limits.amount && edge.annualCost <= limits.amount);
  assert.equal(mixed({efficiency: limits.efficiency}).efficiency, limits.efficiency);
  assert.equal(calculateChargeSession({energyKwh: Number.MIN_VALUE, unitPrice: Number.MIN_VALUE}), null, 'positive values must not underflow into free charging');
  assert.equal(mixed({monthlyKm: Number.MIN_VALUE, efficiency: limits.efficiency}), null);
});

test('query restoration and sharing apply exactly the same declared field bounds', () => {
  for (const [key, field] of Object.entries(CHARGE_PLANNER_FIELDS)) {
    const params = new URLSearchParams({[field.query]: String(field.max + 1)});
    assert.equal(readChargePlannerQuery(params.toString())[key], '');
    const shared = new URL(chargePlannerUrl('https://peekmycar.com/tools/ev-charge-cost/', {[key]: field.max + 1}));
    assert(!shared.searchParams.has(field.query));
    assert.equal(readChargePlannerQuery(new URLSearchParams({[field.query]: String(field.max)}).toString())[key], String(field.max));
  }
  const html = renderEvChargePlanner();
  for (const field of Object.values(CHARGE_PLANNER_FIELDS)) {
    const tag = html.match(new RegExp('<input\\b[^>]*id="' + field.id + '"[^>]*>'))[0];
    assert(tag.includes(`max="${field.max}"`));
  }
  assert.match(html, /입력 범위/);
});

test('increasing energy share interpolates prices while scaling distance scales cost, not the tariff', () => {
  for (const fastShare of [0, 12.5, 50, 87.5, 100]) {
    const result = mixed({fastShare}), twice = mixed({fastShare, monthlyKm: 2000});
    assert(result.weightedPrice >= 200 && result.weightedPrice <= 400);
    assert.equal(twice.weightedPrice, result.weightedPrice);
    close(twice.monthlyCost, result.monthlyCost * 2);
    close(result.annualCost, result.monthlyCost * 12);
  }
});

test('shared planner inputs use only charge-prefixed parameters and preserve legacy inputs and fragments', () => {
  const original = 'https://peekmycar.com/tools/ev-charge-cost/?distance=20000&efficiency=5&unitPrice=300&charge_price=400#result';
  const values = {sessionKwh: '0', sessionPrice: '0', monthlyKm: '1000', efficiency: '5.1', slowPrice: '200', fastPrice: '400', fastShare: '25'};
  const shared = new URL(chargePlannerUrl(original, values));
  assert.equal(shared.searchParams.get('distance'), '20000');
  assert.equal(shared.searchParams.get('efficiency'), '5');
  assert.equal(shared.searchParams.get('unitPrice'), '300');
  assert.equal(shared.hash, '#result');
  assert.deepEqual(readChargePlannerQuery(shared.search), values);
  assert.equal(new URL(chargePlannerUrl(shared, {...values, sessionPrice: ''})).searchParams.has('charge_price'), false);
  const invalid = readChargePlannerQuery('?charge_price=-1&charge_fast_share=101&charge_efficiency=0&charge_kwh=Infinity');
  for (const value of Object.values(invalid)) assert.equal(value, '');
});

test('the fragment has no invented price defaults or legacy IDs and explicitly describes energy-based shares', () => {
  const html = renderEvChargePlanner();
  for (const {id} of Object.values(CHARGE_PLANNER_FIELDS)) {
    const input = html.match(new RegExp('<input\\b[^>]*id="' + id + '"[^>]*>'))?.[0];
    assert(input, id);
    assert.doesNotMatch(input, /\bvalue=/);
    assert.match(input, /required/);
  }
  assert.doesNotMatch(html, /id="(?:simpleCostForm|distance|efficiency|unitPrice|costResult|costBreakdown)"/);
  assert.match(html, /충전 횟수나 충전 시간이 아닌 kWh 기준/);
  assert.match(html, /단가에 0을 직접 입력/);
  assert.match(html, /id="charge_session_result" hidden/);
  assert.match(html, /id="charge_mixed_result" hidden/);
  assert.doesNotMatch(html, /<script\b|<meta\b|<link\b/);
});

function fixture(url = 'https://peekmycar.com/tools/ev-charge-cost/') {
  const nodes = new Map();
  for (const match of renderEvChargePlanner().matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    nodes.set(match[1], {value: '', textContent: '', hidden: /\shidden(?:\s|>)/.test(match[0]), disabled: false,
      handlers: {}, addEventListener(kind, handler) {this.handlers[kind] = handler;}});
  }
  const root = {dataset: {}, querySelector: selector => nodes.get(selector.slice(1))};
  const location = {href: url};
  const window = {location, history: {state: null, replaceState(_state, _title, next) {location.href = next;}},
    navigator: {clipboard: {writeText: async () => {}}}};
  const document = {querySelector: () => root};
  return {nodes, root, window, document};
}

test('invalidating a previously valid form immediately hides and clears its previous outputs', () => {
  const f = fixture();
  initEvChargePlanner(f.document, f.window);
  const set = (key, value) => {f.nodes.get(CHARGE_PLANNER_FIELDS[key].id).value = value;};
  set('sessionKwh', '50'); set('sessionPrice', '300');
  f.nodes.get('charge_session_form').handlers.input();
  assert.equal(f.nodes.get('charge_session_result').hidden, false);
  assert.equal(f.nodes.get('charge_session_cost').textContent, '15,000원');
  set('sessionPrice', '');
  f.nodes.get('charge_session_form').handlers.input();
  assert.equal(f.nodes.get('charge_session_result').hidden, true);
  assert.equal(f.nodes.get('charge_session_cost').textContent, '');
  for (const [key, value] of Object.entries({monthlyKm: '1000', efficiency: '5', slowPrice: '200', fastPrice: '400', fastShare: '25'})) set(key, value);
  f.nodes.get('charge_mixed_form').handlers.input();
  assert.equal(f.nodes.get('charge_mixed_result').hidden, false);
  assert.equal(f.nodes.get('charge_annual_cost').textContent, '600,000원');
  set('efficiency', '0');
  f.nodes.get('charge_mixed_form').handlers.input();
  assert.equal(f.nodes.get('charge_mixed_result').hidden, true);
  for (const id of ['charge_weighted_price', 'charge_monthly_cost', 'charge_annual_cost', 'charge_mixed_breakdown']) assert.equal(f.nodes.get(id).textContent, '');
  assert.equal(f.nodes.get('charge_copy_link').disabled, true);
});

test('query restoration includes explicit free charging and initialization stays safe and single-shot', () => {
  assert.equal(initEvChargePlanner(undefined, undefined), null);
  assert.equal(initEvChargePlanner({querySelector: () => null}, {}), null);
  const f = fixture('https://peekmycar.com/tools/ev-charge-cost/?charge_kwh=50&charge_price=0');
  assert(initEvChargePlanner(f.document, f.window));
  assert.equal(f.nodes.get('charge_session_cost').textContent, '0원');
  assert.equal(f.nodes.get('charge_session_result').hidden, false);
  assert.equal(initEvChargePlanner(f.document, f.window), null);
});

test('small positive prices and efficiency stay nonzero in the displayed calculation basis', () => {
  const f = fixture('https://peekmycar.com/tools/ev-charge-cost/?charge_kwh=1000&charge_price=0.0049&charge_monthly_km=1000&charge_efficiency=0.001&charge_slow_price=200&charge_fast_price=400&charge_fast_share=25');
  initEvChargePlanner(f.document, f.window);
  assert.equal(f.nodes.get('charge_session_cost').textContent, '5원');
  assert.match(f.nodes.get('charge_session_breakdown').textContent, /0\.0049원\/kWh/);
  assert.match(f.nodes.get('charge_mixed_breakdown').textContent, /전비 0\.001km\/kWh/);
  assert.equal(f.nodes.get('charge_monthly_cost').textContent, '250,000,000원');
  const tiny = fixture('https://peekmycar.com/tools/ev-charge-cost/?charge_kwh=1&charge_price=0.00000001');
  initEvChargePlanner(tiny.document, tiny.window);
  assert.equal(tiny.nodes.get('charge_session_cost').textContent, '1원 미만');
  assert.match(tiny.nodes.get('charge_session_breakdown').textContent, /1E-8원\/kWh/);
});


test('only an unused tariff may be absent; a missing active tariff never becomes free', () => {
  for (const unused of ['', undefined, null, NaN, -1, Infinity, 'not-a-number', CHARGE_PLANNER_LIMITS.price + 1]) {
    const slow = mixed({fastShare: 0, fastPrice: unused});
    assert.equal(slow.weightedPrice, 200); assert.equal(slow.monthlyCost, 40000); assert.equal(slow.annualCost, 480000);
    const fast = mixed({fastShare: 100, slowPrice: unused});
    assert.equal(fast.weightedPrice, 400); assert.equal(fast.monthlyCost, 80000); assert.equal(fast.annualCost, 960000);
  }
  for (const fastShare of [0.000001, 25, 99.999999]) {
    assert.equal(mixed({fastShare, slowPrice: ''}), null);
    assert.equal(mixed({fastShare, fastPrice: ''}), null);
  }
  assert.equal(mixed({fastShare: 0, slowPrice: ''}), null);
  assert.equal(mixed({fastShare: 100, fastPrice: ''}), null);
  assert.equal(mixed({fastShare: 0, slowPrice: 0, fastPrice: ''}).annualCost, 0);
  assert.equal(mixed({fastShare: 100, slowPrice: '', fastPrice: 0}).annualCost, 0);
});

test('single-mode inputs become optional and disabled without losing their retained quote', () => {
  const f = fixture();
  initEvChargePlanner(f.document, f.window);
  const set = (key, value) => {f.nodes.get(CHARGE_PLANNER_FIELDS[key].id).value = value;};
  const render = () => f.nodes.get('charge_mixed_form').handlers.input();
  for (const [key, value] of Object.entries({monthlyKm: '1000', efficiency: '5', slowPrice: '200', fastPrice: '400', fastShare: '25'})) set(key, value);
  render();
  set('fastShare', '0'); render();
  assert.equal(f.nodes.get('charge_fast_price').disabled, true);
  assert.equal(f.nodes.get('charge_fast_price').required, false);
  assert.equal(f.nodes.get('charge_slow_price').disabled, false);
  assert.equal(f.nodes.get('charge_fast_price').value, '400');
  assert.equal(f.nodes.get('charge_monthly_cost').textContent, '40,000원');
  assert.equal(new URL(f.window.location.href).searchParams.get('charge_fast_price'), '400');
  set('fastShare', '100'); render();
  assert.equal(f.nodes.get('charge_slow_price').disabled, true);
  assert.equal(f.nodes.get('charge_slow_price').required, false);
  assert.equal(f.nodes.get('charge_fast_price').disabled, false);
  assert.equal(f.nodes.get('charge_slow_price').value, '200');
  assert.equal(f.nodes.get('charge_monthly_cost').textContent, '80,000원');
  set('fastShare', '25'); render();
  assert.equal(f.nodes.get('charge_slow_price').disabled, false);
  assert.equal(f.nodes.get('charge_fast_price').disabled, false);
  assert.equal(f.nodes.get('charge_slow_price').required, true);
  assert.equal(f.nodes.get('charge_fast_price').required, true);
  assert.equal(f.nodes.get('charge_monthly_cost').textContent, '50,000원');
  set('fastPrice', ''); render();
  assert.equal(f.nodes.get('charge_mixed_result').hidden, true);
  set('fastShare', '0'); render();
  assert.equal(f.nodes.get('charge_mixed_result').hidden, false);
  assert.equal(f.nodes.get('charge_monthly_cost').textContent, '40,000원');
  set('fastShare', '25'); render();
  assert.equal(f.nodes.get('charge_mixed_result').hidden, true);
  assert.equal(f.nodes.get('charge_fast_price').disabled, false);
  assert.equal(f.nodes.get('charge_fast_price').required, true);
});

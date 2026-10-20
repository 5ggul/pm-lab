import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateInstallment, equalMonthlyPayment, initCarInstallment, installmentStateFromSearch, installmentStateUrl, validateInstallmentInput} from '../assets/car-installment.js';
import {renderCarInstallmentPage} from './car-installment-page.mjs';

const input = overrides => ({principal: 1_000_000, annualRate: 12, months: 12, method: 'equal-payment', ...overrides});
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

function reconciles(result) {
  assert.equal(result.schedule.length, result.months);
  assert.equal(result.schedule.at(-1).balance, 0);
  assert.equal(sum(result.schedule, 'principal'), result.principal);
  assert.equal(sum(result.schedule, 'interest'), result.totalInterest);
  assert.equal(sum(result.schedule, 'payment'), result.totalPayment);
  assert.equal(result.totalPayment, result.principal + result.totalInterest);
  assert.equal(result.firstPayment, result.schedule[0].payment);
  assert.equal(result.lastPayment, result.schedule.at(-1).payment);
  for (let index = 0; index < result.schedule.length; index++) {
    const row = result.schedule[index];
    assert.equal(row.month, index + 1);
    assert.equal(row.openingBalance, index === 0 ? result.principal : result.schedule[index - 1].balance);
    assert.equal(row.openingBalance - row.principal, row.balance);
    assert.equal(row.principal + row.interest, row.payment);
    for (const key of ['openingBalance', 'principal', 'interest', 'payment', 'balance']) {
      assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0, key + ': ' + row[key]);
    }
  }
}

test('equal-payment formula agrees with independent closed-form reference cases', () => {
  close(equalMonthlyPayment(1_000_000, 12, 12), 88848.78867834168);
  close(equalMonthlyPayment(1_000_000, 12, 2), 507512.4378109453);
  close(equalMonthlyPayment(1_000_000, 12, 1), 1_010_000);
  const result = calculateInstallment(input({months: 2}));
  assert.equal(result.firstPayment, 507512);
  assert.equal(result.lastPayment, 507513);
  assert.equal(result.totalInterest, 15025);
  assert.equal(result.totalPayment, 1015025);
  reconciles(result);
});

test('equal-principal first and last months use declining outstanding principal', () => {
  const result = calculateInstallment(input({principal: 120000, method: 'equal-principal'}));
  assert.equal(result.firstPayment, 11200);
  assert.equal(result.lastPayment, 10100);
  assert.equal(result.totalInterest, 7800);
  assert.equal(result.totalPayment, 127800);
  assert.equal(result.schedule[0].interest, 1200);
  assert.equal(result.schedule.at(-1).interest, 100);
  assert.ok(result.schedule.every(row => row.principal === 10000));
  reconciles(result);
});

test('zero percent repays only the original principal, including a non-divisible won balance', () => {
  for (const method of ['equal-payment', 'equal-principal']) {
    const result = calculateInstallment(input({annualRate: 0, months: 3, method}));
    assert.equal(result.totalInterest, 0);
    assert.equal(result.totalPayment, 1000000);
    assert.deepEqual(result.schedule.map(row => row.principal), [333333, 333334, 333333]);
    close(equalMonthlyPayment(1_000_000, 0, 3), 1_000_000 / 3);
    reconciles(result);
  }
});

test('zero principal explicitly reports no borrowing and no fictitious payment schedule', () => {
  for (const method of ['equal-payment', 'equal-principal']) {
    const result = calculateInstallment(input({principal: 0, annualRate: 0, method}));
    assert.equal(result.noLoan, true);
    assert.equal(result.firstPayment, 0);
    assert.equal(result.lastPayment, 0);
    assert.equal(result.totalPayment, 0);
    assert.equal(result.totalInterest, 0);
    assert.deepEqual(result.schedule, []);
  }
});

test('tiny positive rates stay finite and approach the zero-rate result without cancellation', () => {
  close(equalMonthlyPayment(30_000_000, 1e-12, 36), 30_000_000 / 36, 1e-6);
  for (const annualRate of [Number.MIN_VALUE, 1e-300, 1e-12, 1e-10]) {
    for (const method of ['equal-payment', 'equal-principal']) {
      const result = calculateInstallment(input({principal: 1_000_000_000_000, annualRate, months: 600, method}));
      assert.ok(Number.isFinite(result.totalInterest));
      if (annualRate <= 1e-12) assert.equal(result.totalInterest, 0);
      if (annualRate === 1e-10) assert.equal(result.totalInterest, 25);
      reconciles(result);
    }
  }
});

test('whole-won schedules reconcile across small amounts, bounds and high rates', () => {
  for (const principal of [1, 100, 1_000_000, 30_000_000, 1_000_000_000_000]) {
    for (const annualRate of [0, 0.01, 5, 100]) {
      for (const months of [1, 3, 36, 120, 600]) {
        for (const method of ['equal-payment', 'equal-principal']) {
          const result = calculateInstallment(input({principal, annualRate, months, method}));
          reconciles(result);
          if (method === 'equal-payment') {
            for (const row of result.schedule) assert.ok(Math.abs(row.payment - result.referencePayment) <= 2.01, 'rounding drift');
          }
        }
      }
    }
  }
});

test('blank, negative, non-finite, fractional and out-of-range inputs are rejected', () => {
  for (const value of ['', ' ', null, undefined, NaN, Infinity, -Infinity, true, [], {}, 'Infinity', '0x10', '30,000']) {
    for (const field of ['principal', 'annualRate', 'months']) assert.throws(() => calculateInstallment(input({[field]: value})), RangeError);
  }
  for (const principal of [-1, 0.5, 1_000_000_000_001]) assert.throws(() => calculateInstallment(input({principal})), RangeError);
  for (const annualRate of [-0.1, 100.01]) assert.throws(() => calculateInstallment(input({annualRate})), RangeError);
  for (const months of [-1, 0, 1.5, 601]) assert.throws(() => calculateInstallment(input({months})), RangeError);
  for (const method of ['', null, 'interest-only']) assert.throws(() => calculateInstallment(input({method})), RangeError);
  assert.throws(() => calculateInstallment(null), RangeError);
  assert.deepEqual(validateInstallmentInput(input({principal: '1000000', annualRate: '0', months: '36'})), input({annualRate: 0, months: 36}));
});

test('calculations do not mutate input state', () => {
  const values = Object.freeze(input());
  calculateInstallment(values);
  assert.deepEqual(values, input());
});

test('URL round trips use only loan_ fields and preserve unrelated calculator state', () => {
  const initial = 'https://peekmycar.com/tools/car-installment/?car=sorento&km=10000&loan_rate=99#calculator';
  const values = input({annualRate: 0, months: 60, method: 'equal-principal'});
  const url = new URL(installmentStateUrl(initial, values));
  assert.equal(url.searchParams.get('car'), 'sorento');
  assert.equal(url.searchParams.get('km'), '10000');
  assert.equal(url.hash, '#calculator');
  assert.deepEqual(installmentStateFromSearch(url.search), values);
  assert.equal(url.searchParams.getAll('loan_rate').length, 1);
  assert.equal(installmentStateFromSearch('?principal=1&rate=5&months=12'), null);
  assert.equal(installmentStateFromSearch('?loan_principal=1000&loan_rate=0&loan_months=12'), null);
  assert.equal(installmentStateFromSearch(url.search + '&loan_rate=1'), null);
  for (const [key, value] of [['loan_rate', 'Infinity'], ['loan_principal', '-1'], ['loan_months', '1.5'], ['loan_method', 'other']]) {
    const invalid = new URL(url);
    invalid.searchParams.set(key, value);
    assert.equal(installmentStateFromSearch(invalid.search), null);
  }
});

test('page contract has a blank quote rate, accessible controls and a collapsed amortization table', () => {
  const page = renderCarInstallmentPage();
  assert.equal(page.title, '자동차 할부 계산기');
  assert.deepEqual(page.scripts, [{src: 'car-installment.js', type: 'module'}]);
  assert.ok(page.faqs.every(item => item.length === 2 && item.every(value => typeof value === 'string')));
  for (const id of ['loanPrincipal', 'loanAnnualRate', 'loanMonths', 'loanMethod']) assert.ok(page.content.includes(`for="${id}"`));
  const rate = page.content.match(/<input id="loanAnnualRate"[^>]*>/)[0];
  assert.doesNotMatch(rate, /\bvalue="[^"]+"/);
  assert.match(page.content, /role="alert" hidden/);
  assert.match(page.content, /<details id="loanSchedule"[^>]* hidden>/);
  assert.doesNotMatch(page.content.match(/<details id="loanSchedule"[^>]*>/)[0], /\bopen\b/);
  assert.match(page.content, /scope="col"/);
  assert.match(page.content, /실제 계약일.*수수료/);
  assert.doesNotThrow(() => initCarInstallment());
  assert.doesNotThrow(() => initCarInstallment({getElementById: () => null}, {}));
});

export const INSTALLMENT_LIMITS = Object.freeze({principal: 1_000_000_000_000, annualRate: 100, months: 600});
export const INSTALLMENT_METHODS = Object.freeze(['equal-payment', 'equal-principal']);
const stateFields = {principal: 'loan_principal', annualRate: 'loan_rate', months: 'loan_months', method: 'loan_method'};

function invalid(field, message) {
  const error = new RangeError(message);
  error.field = field;
  throw error;
}

function number(value, field, message) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim()
    || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) invalid(field, message);
  const result = Number(value);
  if (!Number.isFinite(result)) invalid(field, message);
  return result;
}

export function validateInstallmentInput(input = {}) {
  if (!input || typeof input !== 'object') invalid('principal', '대출 원금과 견적 연금리·기간을 입력하세요.');
  const principal = number(input.principal, 'principal', '대출 원금은 0원부터 1조 원까지 정수로 입력하세요.');
  if (!Number.isSafeInteger(principal) || principal < 0 || principal > INSTALLMENT_LIMITS.principal) invalid('principal', '대출 원금은 0원부터 1조 원까지 정수로 입력하세요.');
  const annualRate = number(input.annualRate, 'annualRate', '견적 연금리는 0%부터 100%까지 입력하세요.');
  if (annualRate < 0 || annualRate > INSTALLMENT_LIMITS.annualRate) invalid('annualRate', '견적 연금리는 0%부터 100%까지 입력하세요.');
  const months = number(input.months, 'months', '상환 기간은 1개월부터 600개월까지 정수로 입력하세요.');
  if (!Number.isInteger(months) || months < 1 || months > INSTALLMENT_LIMITS.months) invalid('months', '상환 기간은 1개월부터 600개월까지 정수로 입력하세요.');
  if (!INSTALLMENT_METHODS.includes(input.method)) invalid('method', '원리금균등 또는 원금균등 상환을 선택하세요.');
  return {principal, annualRate, months, method: input.method};
}

/** Nominal annual percentage rate / 12, without daily accrual or fees. */
export function equalMonthlyPayment(principal, annualRate, months) {
  const values = validateInstallmentInput({principal, annualRate, months, method: 'equal-payment'});
  const rate = values.annualRate / 1200;
  if (rate === 0 || rate < 1e-300) return values.principal / values.months;
  return values.principal * rate / -Math.expm1(-values.months * Math.log1p(rate));
}

/**
 * Compute the exact amortization curve first, then round cumulative principal and
 * interest to whole won. This keeps every displayed row and total reconcilable;
 * equal-payment rows can differ by a small rounding amount.
 */
export function calculateInstallment(input) {
  const values = validateInstallmentInput(input);
  const {principal, annualRate, months, method} = values;
  const rate = annualRate / 1200;
  const referencePayment = method === 'equal-payment' ? equalMonthlyPayment(principal, annualRate, months) : null;
  if (principal === 0) return {...values, noLoan: true, referencePayment, firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPayment: 0, schedule: []};
  const logarithm = Math.log1p(rate);
  const denominator = rate > 0 ? -Math.expm1(-months * logarithm) : 0;
  function exactBalance(completed) {
    if (completed === 0) return principal;
    if (completed === months) return 0;
    if (method === 'equal-principal' || rate === 0 || rate < 1e-300) return principal * (months - completed) / months;
    return principal * -Math.expm1(-(months - completed) * logarithm) / denominator;
  }
  let balance = principal;
  let exactInterest = 0;
  let compensation = 0;
  let totalInterest = 0;
  const schedule = [];
  for (let month = 1; month <= months; month++) {
    const nextBalance = Math.max(0, Math.min(balance, Math.round(exactBalance(month))));
    const principalPayment = balance - nextBalance;
    const adjustedInterest = exactBalance(month - 1) * rate - compensation;
    const nextExactInterest = exactInterest + adjustedInterest;
    compensation = (nextExactInterest - exactInterest) - adjustedInterest;
    exactInterest = nextExactInterest;
    const nextTotalInterest = Math.round(exactInterest);
    const interest = nextTotalInterest - totalInterest;
    const payment = principalPayment + interest;
    schedule.push({month, openingBalance: balance, principal: principalPayment, interest, payment, balance: nextBalance});
    balance = nextBalance;
    totalInterest = nextTotalInterest;
  }
  return {...values, noLoan: false, referencePayment, firstPayment: schedule[0].payment, lastPayment: schedule.at(-1).payment, totalInterest, totalPayment: principal + totalInterest, schedule};
}

/** Read only the complete, uniquely specified loan_ namespace; reject partial/invalid state. */
export function installmentStateFromSearch(search) {
  const params = new URLSearchParams(search);
  if (!Object.values(stateFields).every(key => params.getAll(key).length === 1)) return null;
  try {
    return validateInstallmentInput(Object.fromEntries(Object.entries(stateFields).map(([field, key]) => [field, params.get(key)])));
  } catch {
    return null;
  }
}

/** Preserve other query parameters and the hash when saving this calculator's state. */
export function installmentStateUrl(currentUrl, input) {
  const values = validateInstallmentInput(input);
  const url = new URL(currentUrl);
  for (const [field, key] of Object.entries(stateFields)) url.searchParams.set(key, String(values[field]));
  return url.href;
}

export function initCarInstallment(documentRoot = globalThis.document, browser = globalThis.window) {
  if (!documentRoot || !browser) return;
  const form = documentRoot.getElementById('carInstallmentForm');
  if (!form || form.dataset.installmentReady === 'true') return;
  const elements = Object.fromEntries(['loanPrincipal', 'loanAnnualRate', 'loanMonths', 'loanMethod', 'loanError', 'loanPayment', 'loanLastPayment', 'loanTotalInterest', 'loanTotalPayment', 'loanStatus', 'loanMetrics', 'loanSchedule', 'loanScheduleBody'].map(id => [id, documentRoot.getElementById(id)]));
  if (Object.values(elements).some(element => !element)) return;
  form.dataset.installmentReady = 'true';
  const fields = {principal: elements.loanPrincipal, annualRate: elements.loanAnnualRate, months: elements.loanMonths, method: elements.loanMethod};
  const money = amount => amount.toLocaleString('ko-KR') + '원';
  function clear() {
    elements.loanError.hidden = true;
    elements.loanError.textContent = '';
    for (const field of Object.values(fields)) field.removeAttribute('aria-invalid');
    elements.loanPayment.textContent = '대출 조건을 입력하세요';
    elements.loanStatus.textContent = '원금·견적 연금리·기간을 입력한 뒤 계산하세요.';
    elements.loanMetrics.hidden = true;
    elements.loanSchedule.hidden = true;
    elements.loanSchedule.open = false;
    elements.loanScheduleBody.replaceChildren();
  }
  function render(save, focusError = false) {
    clear();
    try {
      const result = calculateInstallment(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])));
      elements.loanPayment.textContent = money(result.firstPayment);
      elements.loanLastPayment.textContent = money(result.lastPayment);
      elements.loanTotalInterest.textContent = money(result.totalInterest);
      elements.loanTotalPayment.textContent = money(result.totalPayment);
      elements.loanMetrics.hidden = false;
      elements.loanStatus.textContent = result.noLoan ? '대출 원금이 0원이므로 상환할 차입금과 이자가 없습니다.' : `${result.method === 'equal-payment' ? '원리금균등' : '원금균등'} · ${result.months}개월 · 고정 연금리 ${result.annualRate}%`;
      if (!result.noLoan) {
        const fragment = documentRoot.createDocumentFragment();
        for (const row of result.schedule) {
          const tr = documentRoot.createElement('tr');
          const month = documentRoot.createElement('th');
          month.scope = 'row';
          month.textContent = row.month + '회';
          tr.appendChild(month);
          for (const key of ['principal', 'interest', 'payment', 'balance']) {
            const cell = documentRoot.createElement('td');
            cell.textContent = money(row[key]);
            tr.appendChild(cell);
          }
          fragment.appendChild(tr);
        }
        elements.loanScheduleBody.appendChild(fragment);
        elements.loanSchedule.hidden = false;
      }
      if (save) {
        try { browser.history.replaceState(null, '', installmentStateUrl(browser.location.href, result)); } catch {}
      }
    } catch (error) {
      elements.loanError.hidden = false;
      elements.loanError.textContent = error.message;
      const field = fields[error.field];
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        if (focusError) field.focus();
      }
    }
  }
  form.addEventListener('submit', event => {event.preventDefault(); render(true, true);});
  function changed() {
    clear();
    try {
      const input = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
      browser.history.replaceState(browser.history.state, '', installmentStateUrl(browser.location.href, input));
    } catch {
      try {
        const url = new URL(browser.location.href);
        for (const key of Object.values(stateFields)) url.searchParams.delete(key);
        browser.history.replaceState(browser.history.state, '', url);
      } catch { /* Restricted history must not prevent input. */ }
    }
  }
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  const restored = installmentStateFromSearch(browser.location.search);
  if (restored) {
    for (const [key, field] of Object.entries(fields)) field.value = String(restored[key]);
    render(false);
  } else {
    clear();
    if (Object.values(stateFields).some(key => new URLSearchParams(browser.location.search).has(key))) {
      elements.loanError.hidden = false;
      elements.loanError.textContent = '주소의 할부 계산 조건이 올바르지 않습니다. 원금·견적 연금리·기간을 다시 입력하세요.';
    }
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initCarInstallment(), {once: true});
  else initCarInstallment();
}

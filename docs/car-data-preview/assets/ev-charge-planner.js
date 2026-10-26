export const CHARGE_PLANNER_LIMITS = Object.freeze({distance: 10000000, energy: 1000000, price: 10000000, efficiency: 10000, amount: Number.MAX_SAFE_INTEGER});

export const CHARGE_PLANNER_FIELDS = Object.freeze({
  sessionKwh: {id: 'charge_kwh', query: 'charge_kwh', max: CHARGE_PLANNER_LIMITS.energy},
  sessionPrice: {id: 'charge_price', query: 'charge_price', max: CHARGE_PLANNER_LIMITS.price},
  monthlyKm: {id: 'charge_monthly_km', query: 'charge_monthly_km', max: CHARGE_PLANNER_LIMITS.distance},
  efficiency: {id: 'charge_efficiency', query: 'charge_efficiency', positive: true, max: CHARGE_PLANNER_LIMITS.efficiency},
  slowPrice: {id: 'charge_slow_price', query: 'charge_slow_price', max: CHARGE_PLANNER_LIMITS.price},
  fastPrice: {id: 'charge_fast_price', query: 'charge_fast_price', max: CHARGE_PLANNER_LIMITS.price},
  fastShare: {id: 'charge_fast_share', query: 'charge_fast_share', max: 100}
});

// A missing value is different from an explicitly entered zero, including in
// shared URLs. Accept finite numeric input only; do not coerce null or booleans.
export function chargeNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string') {
    value = value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  }
  const number = Number(value);
  // A nonzero decimal can underflow during Number conversion. It must not turn
  // into the explicit zero that represents free charging or no travel.
  if (number === 0 && typeof value === 'string' && /[1-9]/.test(value.split(/[eE]/)[0])) return null;
  return Number.isFinite(number) && number >= 0 ? (number === 0 ? 0 : number) : null;
}

export function calculateChargeSession(input = {}) {
  const {energyKwh, unitPrice} = input ?? {};
  const kwh = chargeNumber(energyKwh), price = chargeNumber(unitPrice);
  if (kwh === null || price === null || kwh > CHARGE_PLANNER_LIMITS.energy || price > CHARGE_PLANNER_LIMITS.price) return null;
  const cost = kwh * price;
  if (kwh > 0 && price > 0 && cost === 0) return null;
  return Number.isFinite(cost) && cost <= CHARGE_PLANNER_LIMITS.amount ? {energyKwh: kwh, unitPrice: price, cost} : null;
}

export function calculateMixedCharge(input = {}) {
  const {monthlyKm, efficiency, slowPrice, fastPrice, fastShare} = input ?? {};
  const [distance, kmPerKwh, share] = [monthlyKm, efficiency, fastShare].map(chargeNumber);
  if ([distance, kmPerKwh, share].some(value => value === null)) return null;
  const price = value => {const parsed = chargeNumber(value); return parsed !== null && parsed <= CHARGE_PLANNER_LIMITS.price ? parsed : null;};
  const slow = price(slowPrice), fast = price(fastPrice);
  // Only tariffs with a nonzero energy share participate. Never substitute a
  // missing active tariff with zero, and never multiply an invalid unused one.
  if (kmPerKwh <= 0 || kmPerKwh > CHARGE_PLANNER_LIMITS.efficiency || share > 100
    || distance > CHARGE_PLANNER_LIMITS.distance || share < 100 && slow === null || share > 0 && fast === null) return null;
  const ratio = share / 100;
  const weightedPrice = share === 0 ? slow : share === 100 ? fast : slow * (1 - ratio) + fast * ratio;
  const monthlyKwh = distance / kmPerKwh;
  const monthlyCost = monthlyKwh * weightedPrice;
  const annualCost = monthlyCost * 12;
  if (![weightedPrice, monthlyKwh, monthlyCost, annualCost].every(Number.isFinite)
    || monthlyKwh > CHARGE_PLANNER_LIMITS.energy || monthlyCost > CHARGE_PLANNER_LIMITS.amount || annualCost > CHARGE_PLANNER_LIMITS.amount
    || distance > 0 && monthlyKwh === 0 || monthlyKwh > 0 && weightedPrice > 0 && monthlyCost === 0
    || weightedPrice === 0 && (slow > 0 && ratio < 1 || fast > 0 && ratio > 0)) return null;
  return {monthlyKm: distance, efficiency: kmPerKwh, slowPrice: slow, fastPrice: fast,
    fastShare: share, weightedPrice, monthlyKwh, monthlyCost, annualCost};
}

function queryValue(value, field) {
  const number = chargeNumber(value);
  if (number === null || (field.positive && number <= 0) || (field.max !== undefined && number > field.max)) return '';
  return String(number);
}

export function readChargePlannerQuery(search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(Object.entries(CHARGE_PLANNER_FIELDS).map(([key, field]) =>
    [key, params.has(field.query) ? queryValue(params.get(field.query), field) : '']));
}

export function chargePlannerUrl(currentUrl, values) {
  const url = new URL(currentUrl);
  for (const [key, field] of Object.entries(CHARGE_PLANNER_FIELDS)) {
    const value = queryValue(values?.[key], field);
    if (value === '') url.searchParams.delete(field.query);
    else url.searchParams.set(field.query, value);
  }
  return url.href;
}

export function initEvChargePlanner(documentRoot = globalThis.document, browserWindow = globalThis.window) {
  const root = documentRoot?.querySelector?.('[data-ev-charge-planner]');
  if (!root || !browserWindow || root.dataset.chargePlannerReady === 'true') return null;
  const field = id => root.querySelector('#' + id);
  const controls = Object.fromEntries(Object.entries(CHARGE_PLANNER_FIELDS).map(([key, definition]) => [key, field(definition.id)]));
  const ids = ['charge_session_form', 'charge_mixed_form', 'charge_session_result', 'charge_mixed_result',
    'charge_session_cost', 'charge_session_breakdown', 'charge_weighted_price', 'charge_monthly_cost', 'charge_annual_cost',
    'charge_mixed_breakdown', 'charge_session_status', 'charge_mixed_status', 'charge_copy_link', 'charge_share_status'];
  const ui = Object.fromEntries(ids.map(id => [id, field(id)]));
  if ([...Object.values(controls), ...Object.values(ui)].some(element => !element)) return null;
  root.dataset.chargePlannerReady = 'true';
  const restored = readChargePlannerQuery(new URL(browserWindow.location.href).search);
  for (const [key, control] of Object.entries(controls)) control.value = restored[key];
  const number = value => value.toLocaleString('ko-KR', {maximumSignificantDigits: 6, ...(value > 0 && value < 0.000001 ? {notation: 'scientific'} : {})});
  const money = value => value > 0 && value < 1 ? '1원 미만' : Math.round(value).toLocaleString('ko-KR') + '원';
  const values = () => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
  // Each result has one polite status. Leave unchanged text alone so editing
  // another calculator or receiving both input/change does not repeat it.
  const status = (element, message, valid = false) => {
    element.classList.toggle('charge-result-ready', Boolean(valid));
    if (element.textContent !== message) element.textContent = message;
  };
  let validResult = false;

  function render(syncUrl = true) {
    const inputs = values();
    const share = chargeNumber(inputs.fastShare);
    controls.slowPrice.disabled = share === 100;
    controls.fastPrice.disabled = share === 0;
    controls.slowPrice.required = !controls.slowPrice.disabled;
    controls.fastPrice.required = !controls.fastPrice.disabled;
    const session = calculateChargeSession({energyKwh: inputs.sessionKwh, unitPrice: inputs.sessionPrice});
    const mixed = calculateMixedCharge(inputs);
    validResult = Boolean(session || mixed);
    ui.charge_session_result.hidden = !session;
    ui.charge_mixed_result.hidden = !mixed;
    ui.charge_copy_link.disabled = !validResult;
    ui.charge_share_status.textContent = '';
    ui.charge_session_cost.textContent = session ? money(session.cost) : '';
    ui.charge_session_breakdown.textContent = session ? `${number(session.energyKwh)} kWh × ${number(session.unitPrice)}원/kWh` : '';
    status(ui.charge_session_status, session
      ? `${number(session.energyKwh)}kWh × ${number(session.unitPrice)}원/kWh 기준, 1회 충전비 ${money(session.cost)}입니다.`
      : '계산 결과가 없습니다. 충전량과 단가를 입력 범위 안의 숫자로 입력하세요. 무료 충전은 단가에 0을 직접 입력하세요.', session);
    ui.charge_weighted_price.textContent = mixed ? `${number(mixed.weightedPrice)}원/kWh` : '';
    ui.charge_monthly_cost.textContent = mixed ? money(mixed.monthlyCost) : '';
    ui.charge_annual_cost.textContent = mixed ? money(mixed.annualCost) : '';
    ui.charge_mixed_breakdown.textContent = mixed
      ? `월 ${number(mixed.monthlyKm)}km ÷ 전비 ${number(mixed.efficiency)}km/kWh = ${number(mixed.monthlyKwh)}kWh. 충전 전력량 중 급속 ${number(mixed.fastShare)}%, 완속 ${number(100 - mixed.fastShare)}%를 적용했습니다.` : '';
    status(ui.charge_mixed_status, mixed
      ? `월 ${number(mixed.monthlyKm)}km · 전비 ${number(mixed.efficiency)}km/kWh · 급속 ${number(mixed.fastShare)}% · 평균 ${number(mixed.weightedPrice)}원/kWh 기준, 월 ${money(mixed.monthlyCost)}, 연 ${money(mixed.annualCost)}입니다.`
      : '계산 결과가 없습니다. 주행거리·전비·급속 비중과 사용하는 충전 방식의 단가를 입력하세요. 전비는 0보다 커야 하며 계산상 월 전력량은 100만kWh 이하여야 합니다.', mixed);
    if (syncUrl) {
      try {
        const url = chargePlannerUrl(browserWindow.location.href, inputs);
        if (url !== browserWindow.location.href) browserWindow.history.replaceState(browserWindow.history.state, '', url);
      } catch (_) { /* A restricted history API must not prevent local calculation. */ }
    }
    return {session, mixed};
  }
  for (const id of ['charge_session_form', 'charge_mixed_form']) {
    ui[id].addEventListener('input', () => render());
    ui[id].addEventListener('change', () => render());
    ui[id].addEventListener('submit', event => {event.preventDefault(); render();});
  }
  ui.charge_copy_link.addEventListener('click', async () => {
    if (!validResult) return;
    try {
      await browserWindow.navigator.clipboard.writeText(chargePlannerUrl(browserWindow.location.href, values()));
      ui.charge_share_status.textContent = '현재 입력 조건의 링크를 복사했습니다.';
    } catch (_) {
      ui.charge_share_status.textContent = '링크를 복사하지 못했습니다. 주소창의 주소를 복사해 주세요.';
    }
  });
  render(false);
  return {render};
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initEvChargePlanner(), {once: true});
  else initEvChargePlanner();
}

export const MEASURED_LIMITS = Object.freeze({distance: 1000000, quantity: 100000, price: 1000000});
const FUELS = ['gasoline', 'diesel', 'lpg'];
const MODES = {
  fuel: {quantityUnit: 'L', efficiencyUnit: 'km/L', priceUnit: '원/L'},
  electric: {quantityUnit: 'kWh', efficiencyUnit: 'km/kWh', priceUnit: '원/kWh'}
};
const PARAMS = {mode: 'measured_mode', fuel: 'measured_fuel', distance: 'measured_distance', quantity: 'measured_quantity', unitPrice: 'measured_price'};
const empty = value => value === undefined || value === null || typeof value === 'string' && value.trim() === '';

function positive(value, maximum, allowZero = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  // A written zero is free; an underflowed positive mantissa is invalid.
  const explicitZero = number === 0 && !/[1-9]/.test(text.split(/[eE]/)[0]);
  return Number.isFinite(number) && number <= maximum && (number >= 0.000001 || allowZero && explicitZero) ? number : null;
}

export function calculateMeasuredEfficiency(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const {mode = 'fuel', fuel = 'gasoline', distance, quantity, unitPrice} = input;
  if (!Object.hasOwn(MODES, mode) || mode === 'fuel' && !FUELS.includes(fuel)) return null;
  const km = positive(distance, MEASURED_LIMITS.distance), amount = positive(quantity, MEASURED_LIMITS.quantity);
  const price = empty(unitPrice) ? null : positive(unitPrice, MEASURED_LIMITS.price, true);
  if (km === null || amount === null || !empty(unitPrice) && price === null) return null;
  const efficiency = km / amount, per100 = amount / km * 100;
  const costPer100 = price === null ? null : per100 * price, recordCost = price === null ? null : amount * price;
  if (![efficiency, per100].every(value => Number.isFinite(value) && value > 0)
    || price !== null && ![costPer100, recordCost].every(value => Number.isFinite(value) && (price === 0 ? value === 0 : value > 0))) return null;
  return {mode, fuel: mode === 'fuel' ? fuel : null, distance: km, quantity: amount, unitPrice: price,
    efficiency, per100, costPer100, recordCost, ...MODES[mode]};
}

export function parseMeasuredEfficiencyParams(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const requestedMode = params.get(PARAMS.mode) || 'fuel';
  const requestedFuel = params.get(PARAMS.fuel) || 'gasoline';
  const invalidFields = [];
  const mode = Object.hasOwn(MODES, requestedMode) ? requestedMode : 'fuel';
  const fuel = FUELS.includes(requestedFuel) ? requestedFuel : 'gasoline';
  if (mode !== requestedMode) invalidFields.push('mode');
  if (mode === 'fuel' && fuel !== requestedFuel) invalidFields.push('fuel');
  const state = {mode, fuel, distance: '', quantity: '', unitPrice: '', invalidFields};
  for (const [field, limit] of [['distance', MEASURED_LIMITS.distance], ['quantity', MEASURED_LIMITS.quantity], ['unitPrice', MEASURED_LIMITS.price]]) {
    const value = params.get(PARAMS[field]);
    if (empty(value)) continue;
    const number = positive(value, limit, field === 'unitPrice');
    if (number === null) invalidFields.push(field); else state[field] = String(number);
  }
  // An unknown mode must never reinterpret supplied kWh as litres or vice versa.
  if (invalidFields.includes('mode') || invalidFields.includes('fuel')) state.quantity = state.unitPrice = '';
  return state;
}

export function measuredCostHref(input) {
  const result = calculateMeasuredEfficiency(input);
  // Keep the transfer within the existing cost tools' accepted efficiency range.
  // The measured record itself may remain useful outside that range.
  if (!result || result.efficiency < 0.000001 || result.efficiency > 10000) return null;
  const params = new URLSearchParams({efficiency: String(result.efficiency), distance: String(result.distance)});
  if (result.unitPrice !== null) params.set('unitPrice', String(result.unitPrice));
  if (result.mode === 'fuel') params.set('fuel', result.fuel);
  return `../${result.mode === 'electric' ? 'ev-charge-cost' : 'fuel-cost'}/?${params}`;
}

export function initMeasuredEfficiency(documentRoot = globalThis.document) {
  const form = documentRoot?.querySelector?.('#measuredEfficiencyForm');
  if (!form || form.dataset.measuredReady === 'true') return null;
  const field = id => documentRoot.getElementById(id);
  const elements = Object.fromEntries(['Mode', 'Fuel', 'FuelField', 'Distance', 'Quantity', 'Price', 'QuantityLabel', 'PriceLabel', 'RecordHint', 'ResultHeading', 'EfficiencyValue', 'Breakdown', 'Status', 'CostRows', 'CostPer100', 'RecordCost', 'CostLink'].map(name => [name, field('measured' + name)]));
  if (Object.values(elements).some(element => !element)) return null;
  form.dataset.measuredReady = 'true';
  const restored = parseMeasuredEfficiencyParams(globalThis.location?.search || '');
  let restoredInvalid = restored.invalidFields.length > 0;
  elements.Mode.value = restored.mode; elements.Fuel.value = restored.fuel;
  elements.Distance.value = restored.distance; elements.Quantity.value = restored.quantity; elements.Price.value = restored.unitPrice;
  const format = value => value.toLocaleString('ko-KR', {maximumSignificantDigits: 6});
  const won = value => value > 0 && value < 1 ? '1원 미만' : Math.round(value).toLocaleString('ko-KR') + '원';
  const input = () => ({mode: elements.Mode.value, fuel: elements.Fuel.value, distance: elements.Distance.value, quantity: elements.Quantity.value, unitPrice: elements.Price.value});
  function labels() {
    const electric = elements.Mode.value === 'electric';
    elements.FuelField.hidden = electric;
    elements.QuantityLabel.textContent = electric ? '같은 구간의 충전량 (kWh)' : '같은 구간의 주유량 (L)';
    elements.PriceLabel.textContent = electric ? '실제 충전단가 (원/kWh, 선택)' : '실제 주유단가 (원/L, 선택)';
    elements.RecordHint.textContent = electric
      ? '주행거리와 사용 전력량의 기록 구간을 맞추세요. 결제한 충전량을 쓰면 충전 손실이 포함될 수 있습니다.'
      : '가득 주유 후 다음 가득 주유까지의 거리와, 두 번째 주유량을 입력하세요.';
    elements.ResultHeading.textContent = electric ? '내 기록의 실전비' : '내 기록의 실연비';
  }
  function clear() {
    elements.EfficiencyValue.textContent = '—';
    elements.Breakdown.textContent = '거리와 사용량을 입력하면 결과가 표시됩니다.';
    elements.CostRows.hidden = true; elements.CostPer100.textContent = '—'; elements.RecordCost.textContent = '—';
    elements.CostLink.hidden = true; elements.CostLink.removeAttribute('href');
  }
  function syncUrl() {
    if (!globalThis.location || !globalThis.history?.replaceState) return;
    const url = new URL(globalThis.location.href), state = input();
    for (const key of Object.values(PARAMS)) url.searchParams.delete(key);
    url.searchParams.set(PARAMS.mode, state.mode);
    if (state.mode === 'fuel') url.searchParams.set(PARAMS.fuel, state.fuel);
    for (const [key, max] of [['distance', MEASURED_LIMITS.distance], ['quantity', MEASURED_LIMITS.quantity], ['unitPrice', MEASURED_LIMITS.price]]) {
      const value = positive(state[key], max, key === 'unitPrice');
      if (value !== null) url.searchParams.set(PARAMS[key], String(value));
    }
    try {globalThis.history.replaceState(globalThis.history.state, '', url);} catch { /* A restricted history API must not prevent calculation. */ }
  }
  function render(updateUrl = false) {
    labels(); clear();
    const result = restoredInvalid ? null : calculateMeasuredEfficiency(input());
    if (!result) {
      const pristine = empty(elements.Distance.value) && empty(elements.Quantity.value) && empty(elements.Price.value);
      elements.Status.textContent = restoredInvalid ? '주소의 계산 조건을 확인하고 다시 입력하세요.'
        : pristine ? '같은 구간의 주행거리와 사용량을 입력하세요.' : '거리·사용량은 0보다 큰 숫자, 단가는 0 이상인지 확인하세요. 각 입력란의 최대 범위 이내여야 합니다.';
    } else {
      elements.EfficiencyValue.textContent = `${format(result.efficiency)} ${result.efficiencyUnit}`;
      elements.Breakdown.textContent = `${format(result.distance)}km ÷ ${format(result.quantity)}${result.quantityUnit}`;
      elements.Status.textContent = result.unitPrice === null ? '직접 측정한 기록입니다. 단가를 입력하면 100km당 비용도 계산합니다.' : '직접 입력한 기록과 단가로 계산했습니다.';
      if (result.unitPrice !== null) {
        elements.CostRows.hidden = false;
        elements.CostPer100.textContent = won(result.costPer100); elements.RecordCost.textContent = won(result.recordCost);
      }
      const costHref = measuredCostHref(input());
      if (costHref) {
        elements.CostLink.href = costHref; elements.CostLink.hidden = false;
        elements.CostLink.textContent = result.mode === 'electric' ? '이 전비로 충전비 계산' : '이 연비로 유류비 계산';
      } else {
        elements.Status.textContent += ' 비용 계산기로 전달할 수 있는 효율 범위를 벗어났습니다. 거리와 사용량을 확인하세요.';
      }
    }
    if (updateUrl) syncUrl();
  }
  elements.Mode.addEventListener('change', () => {
    elements.Quantity.value = ''; elements.Price.value = ''; restoredInvalid = false; render(true);
  });
  // Fuel-price units agree, but a previous fuel's unit price must not carry across.
  elements.Fuel.addEventListener('change', () => {elements.Price.value = ''; restoredInvalid = false; render(true);});
  form.addEventListener('input', event => {
    if (event.target === elements.Mode || event.target === elements.Fuel) return;
    restoredInvalid = false; render(true);
  });
  form.addEventListener('submit', event => {event.preventDefault(); restoredInvalid = false; render(true);});
  render();
  return {render, clear};
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMeasuredEfficiency(), {once: true});
  else initMeasuredEfficiency();
}

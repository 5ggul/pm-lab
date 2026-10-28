export const MILEAGE_FIELDS = Object.freeze({
  oneWayKm: {id: 'mileage_one_way', query: 'm_one_way', max: 10000, initial: ''},
  monthlyDays: {id: 'mileage_days', query: 'm_days', max: 31, initial: ''},
  weekendKm: {id: 'mileage_weekend', query: 'm_weekend', max: 100000, initial: '0'},
  extraAnnualKm: {id: 'mileage_extra', query: 'm_extra', max: 1000000, initial: '0'}
});
export const MILEAGE_ANNUAL_LIMIT = 1000000;
export const MILEAGE_HANDOFF_BOUNDS = Object.freeze({
  annual: {min: 1000, max: 100000},
  fuel: {min: 0, max: 10000000},
  electric: {min: 0, max: 10000000}
});

function mileageNumber(value, maximum) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  // A nonzero decimal too small for Number is invalid, not a deliberate zero.
  if (number === 0 && /[1-9]/.test(text.split(/[eE]/)[0])) return null;
  return Number.isFinite(number) && number >= 0 && number <= maximum ? (number === 0 ? 0 : number) : null;
}

export function calculateAnnualMileage(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const values = {...input};
  if (values.weekendKm === undefined) values.weekendKm = 0;
  if (values.extraAnnualKm === undefined) values.extraAnnualKm = 0;
  const parsed = Object.fromEntries(Object.entries(MILEAGE_FIELDS).map(([key, field]) => [key, mileageNumber(values[key], field.max)]));
  if (Object.values(parsed).some(value => value === null)) return null;
  const commuteAnnual = parsed.oneWayKm * 2 * parsed.monthlyDays * 12;
  const weekendAnnual = parsed.weekendKm * 52;
  const extraAnnual = parsed.extraAnnualKm;
  const annual = commuteAnnual + weekendAnnual + extraAnnual;
  const monthlyAverage = annual / 12;
  if (![commuteAnnual, weekendAnnual, annual, monthlyAverage].every(Number.isFinite)
    || annual > MILEAGE_ANNUAL_LIMIT
    || parsed.oneWayKm > 0 && parsed.monthlyDays > 0 && commuteAnnual === 0
    || annual > 0 && monthlyAverage === 0) return null;
  return {commuteAnnual, weekendAnnual, extraAnnual, annual, monthlyAverage, transferKm: Math.round(annual)};
}

export function readMileageQuery(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  return Object.fromEntries(Object.entries(MILEAGE_FIELDS).map(([key, field]) => {
    if (!params.has(field.query)) return [key, field.initial];
    const number = mileageNumber(params.get(field.query), field.max);
    return [key, number === null ? '' : String(number)];
  }));
}

export function mileageUrl(currentUrl, input = {}) {
  const url = new URL(currentUrl);
  const values = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  for (const [key, field] of Object.entries(MILEAGE_FIELDS)) {
    const value = Object.hasOwn(values, key) ? values[key] : field.initial;
    const number = mileageNumber(value, field.max);
    // Keep an explicitly cleared optional field empty on reload. Deleting this
    // key would incorrectly restore its pristine zero default.
    url.searchParams.set(field.query, number === null ? '' : String(number));
  }
  return url.href;
}

export function initAnnualMileage(documentRoot = globalThis.document, browserWindow = globalThis.window) {
  const root = documentRoot?.querySelector?.('[data-annual-mileage]');
  if (!root || !browserWindow || root.dataset.mileageReady === 'true') return null;
  const field = id => root.querySelector('#' + id);
  const controls = Object.fromEntries(Object.entries(MILEAGE_FIELDS).map(([key, definition]) => [key, field(definition.id)]));
  const ids = ['mileage_form', 'mileage_example', 'mileage_result', 'mileage_status', 'mileage_annual', 'mileage_monthly',
    'mileage_commute', 'mileage_weekend_total', 'mileage_extra_total', 'mileage_transfer_note', 'mileage_copy', 'mileage_share_status'];
  const ui = Object.fromEntries(ids.map(id => [id, field(id)]));
  const links = Array.from(root.querySelectorAll('[data-mileage-handoff]'));
  if ([...Object.values(controls), ...Object.values(ui)].some(element => !element) || links.length !== 3) return null;
  const handoffs = {annual: {path: '/tools/annual-cost/', query: 'km'}, fuel: {path: '/tools/fuel-cost/', query: 'distance'}, electric: {path: '/tools/ev-charge-cost/', query: 'distance'}};
  const originals = links.map(link => ({link, href: link.getAttribute('href'), kind: link.getAttribute('data-mileage-handoff'), tabIndex: link.getAttribute('tabindex')}));
  if (new Set(originals.map(item => item.kind)).size !== 3 || originals.some(item => !Object.hasOwn(handoffs, item.kind) || !item.href)) return null;
  root.dataset.mileageReady = 'true';
  const restored = readMileageQuery(new URL(browserWindow.location.href).search);
  for (const [key, control] of Object.entries(controls)) control.value = restored[key];
  const format = number => number.toLocaleString('ko-KR', number > 0 && number < 0.01
    ? {notation: 'scientific', maximumSignificantDigits: 6} : {maximumFractionDigits: 2}) + ' km';
  const integer = number => number.toLocaleString('ko-KR', {maximumFractionDigits: 0});
  const input = () => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
  const status = (message, valid) => {
    ui.mileage_status.classList.toggle('mileage-result-ready', valid);
    if (ui.mileage_status.textContent !== message) ui.mileage_status.textContent = message;
  };
  let currentResult = null, revision = 0;
  function render(sync = false) {
    revision++;
    const values = input();
    currentResult = calculateAnnualMileage(values);
    const valid = currentResult !== null;
    ui.mileage_result.hidden = !valid;
    ui.mileage_copy.disabled = !valid;
    ui.mileage_share_status.textContent = '';
    for (const [id, key] of [['mileage_annual', 'annual'], ['mileage_monthly', 'monthlyAverage'], ['mileage_commute', 'commuteAnnual'], ['mileage_weekend_total', 'weekendAnnual'], ['mileage_extra_total', 'extraAnnual']]) {
      ui[id].textContent = valid ? format(currentResult[key]) : '';
    }
    ui.mileage_transfer_note.textContent = !valid ? ''
      : `비용 계산에는 ${integer(currentResult.transferKm)} km를 전달합니다. 합계를 1 km 단위로 반올림한 값입니다. 자동차세 포함 계산은 1,000~100,000 km에서 사용할 수 있습니다.`;
    for (const {link, href, kind, tabIndex} of originals) {
      let destination = null;
      const bounds = MILEAGE_HANDOFF_BOUNDS[kind];
      if (valid && currentResult.transferKm >= bounds.min && currentResult.transferKm <= bounds.max) {
        try {
          const url = new URL(href, browserWindow.location.href), current = new URL(browserWindow.location.href);
          if (url.origin === current.origin && url.pathname.endsWith(handoffs[kind].path)) {
            url.searchParams.set(handoffs[kind].query, String(currentResult.transferKm));
            destination = url.href;
          }
        } catch { /* Invalid markup cannot create an unrelated handoff. */ }
      }
      if (destination) {
        link.setAttribute('href', destination); link.removeAttribute('aria-disabled');
        if (tabIndex === null) link.removeAttribute('tabindex'); else link.setAttribute('tabindex', tabIndex);
      } else {
        link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.setAttribute('tabindex', '-1');
      }
    }
    status(valid ? `연간 주행거리 ${format(currentResult.annual)}, 월평균 ${format(currentResult.monthlyAverage)}입니다.`
      : '편도 거리·월평균 출근일과 주말·추가 거리를 입력 범위 안의 0 이상 숫자로 입력하세요. 연간 합계는 100만 km 이하여야 합니다.', valid);
    if (sync) {
      try {
        const url = mileageUrl(browserWindow.location.href, values);
        if (url !== browserWindow.location.href) browserWindow.history.replaceState(browserWindow.history.state, '', url);
      } catch { /* Calculation remains usable when URL updates are unavailable. */ }
    }
    return currentResult;
  }
  ui.mileage_form.addEventListener('input', () => render(true));
  ui.mileage_form.addEventListener('change', () => render(true));
  ui.mileage_form.addEventListener('submit', event => {event.preventDefault(); render(true);});
  ui.mileage_example.addEventListener('click', () => {
    for (const [key, value] of Object.entries({oneWayKm: '20', monthlyDays: '21', weekendKm: '80', extraAnnualKm: '0'})) controls[key].value = value;
    render(true);
  });
  ui.mileage_copy.addEventListener('click', async () => {
    if (!currentResult) return;
    const savedRevision = revision, url = mileageUrl(browserWindow.location.href, input());
    try {
      await browserWindow.navigator.clipboard.writeText(url);
      if (savedRevision === revision) ui.mileage_share_status.textContent = '현재 계산 조건의 링크를 복사했습니다.';
    } catch {
      if (savedRevision === revision) ui.mileage_share_status.textContent = '링크를 복사하지 못했습니다. 주소창의 주소를 복사해 주세요.';
    }
  });
  render();
  return {render};
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAnnualMileage(), {once: true});
  else initAnnualMileage();
}

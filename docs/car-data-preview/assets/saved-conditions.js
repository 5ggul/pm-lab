export const STORAGE_KEY = 'peekmycar.saved-conditions.v1';
export const MAX_SAVED = 12;
const keys = new Set(('a av b bv fa fb ra rb mode car variant calc spec drive wheel km reg pair gap cprice_gasoline cprice_diesel cprice_lpg cprice_electric gas diesel lpg elec price id distance efficiency unitPrice fuel taxFuel cc registration measured_mode measured_distance measured_quantity measured_price measured_fuel loan_principal loan_rate loan_months loan_method charge_kwh charge_price charge_monthly_km charge_efficiency charge_slow_price charge_fast_price charge_fast_share').split(' '));
const allowedPath = relative => /^(?:compare\/(?:[a-z0-9-]+\/)?|tools\/(?:annual-cost|car-tax|fuel-cost|ev-charge-cost|hybrid-break-even|fuel-efficiency|car-installment)\/|cars\/(?:family\/|[a-z0-9-]+\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)*)?)$/.test(relative) && relative !== 'cars/';

export function conditionUrl(href, origin, basePath = '/') {
  try {
    if (typeof href !== 'string' || href.length > 12000 || /%2f|%5c|%2e/i.test(href.split(/[?#]/)[0])) return null;
    const base = new URL(basePath, origin);
    const url = new URL(href, base);
    if (url.origin !== base.origin || url.username || url.password || !url.pathname.startsWith(base.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) return null;
    const relative = url.pathname.slice(base.pathname.length);
    if (!allowedPath(relative)) return null;
    const clean = new URL(url.pathname, origin);
    for (const [key, value] of url.searchParams) {
      if (keys.has(key) && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value)) clean.searchParams.set(key, value);
    }
    return clean.pathname + clean.search;
  } catch { return null; }
}

export function readConditions(raw, origin, basePath = '/') {
  try {
    const parsed = JSON.parse(raw || 'null');
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return [];
    const seen = new Set();
    return parsed.items.slice(0, MAX_SAVED * 3).flatMap(item => {
      if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(item.id) || seen.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || typeof item.url !== 'string' || !item.url.startsWith('/')) return [];
      const url = conditionUrl(item.url, origin, basePath);
      if (!url) return [];
      seen.add(item.id);
      return [{id:item.id, label:item.label.trim().slice(0, 60), url, createdAt:Number.isFinite(item.createdAt) ? item.createdAt : 0}];
    }).slice(0, MAX_SAVED);
  } catch { return []; }
}

export function addCondition(items, item) {
  return [item, ...items.filter(entry => entry.url !== item.url)].slice(0, MAX_SAVED);
}

export function initSavedConditions(doc = globalThis.document, win = globalThis.window) {
  const widget = doc?.querySelector?.('[data-saved-conditions]');
  if (!widget || !win || widget.dataset.ready) return;
  widget.dataset.ready = 'true';
  const basePath = new URL('../', import.meta.url).pathname;
  const list = widget.querySelector('[data-saved-list]');
  const status = widget.querySelector('[data-saved-status]');
  const button = widget.querySelector('[data-save-condition]');
  const name = widget.querySelector('[data-saved-name]');
  if (!list || !status) return;
  const load = () => readConditions(win.localStorage.getItem(STORAGE_KEY), win.location.origin, basePath);
  function paint(items) {
    list.replaceChildren();
    if (!items.length) {
      const empty = doc.createElement('li'); empty.className = 'saved-conditions-empty'; empty.textContent = '저장한 조건이 없습니다.'; list.append(empty); return;
    }
    for (const item of items) {
      const li = doc.createElement('li');
      const link = doc.createElement('a'); link.href = item.url; link.textContent = item.label;
      const remove = doc.createElement('button'); remove.type = 'button'; remove.textContent = '삭제'; remove.setAttribute('aria-label', item.label + ' 저장 삭제');
      remove.addEventListener('click', () => {
        try { const next = load().filter(entry => entry.id !== item.id); win.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, items:next})); paint(next); status.textContent = '저장한 조건을 삭제했습니다.'; }
        catch { status.textContent = '이 브라우저에서 저장 공간을 사용할 수 없습니다.'; }
      });
      li.append(link, remove); list.append(li);
    }
  }
  try { paint(load()); } catch { paint([]); status.textContent = '이 브라우저에서 저장 공간을 사용할 수 없습니다.'; }
  button?.addEventListener('click', () => {
    const loanForm = doc.querySelector('#carInstallmentForm');
    if (loanForm && !loanForm.checkValidity()) { status.textContent = '원금·금리·기간을 올바르게 입력한 뒤 저장하세요.'; return; }
    // Other input listeners synchronously write their own validated URL state first.
    win.queueMicrotask(() => {
      const url = conditionUrl(win.location.href, win.location.origin, basePath);
      if (!url) { status.textContent = '이 페이지의 조건은 저장할 수 없습니다.'; return; }
      const label = name?.value.trim().slice(0, 60) || doc.querySelector('h1')?.textContent.trim().slice(0, 60) || '계산 조건';
      const item = {id:win.crypto?.randomUUID?.() || Date.now().toString(36), label, url, createdAt:Date.now()};
      try { const next = addCondition(load(), item); win.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,items:next})); paint(next); status.textContent = '이 기기에 조건을 저장했습니다.'; }
      catch { status.textContent = '조건을 저장하지 못했습니다. 브라우저의 저장 공간 설정을 확인하세요.'; }
    });
  });
  win.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) { try { paint(load()); } catch { /* Local calculation remains available. */ } } });
}

if (typeof document !== 'undefined') initSavedConditions();

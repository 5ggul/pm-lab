(() => {
  const host = document.querySelector('#vehicle-issues .vehicle-official-issues-content');
  const configNode = document.getElementById('official-issues-config');
  if (!host || !configNode) return;
  let config;
  try { config = JSON.parse(configNode.textContent); } catch { return; }
  const script = document.currentScript || [...document.scripts].find(item => /\/vehicle-official-issues\.js(?:\?|$)/.test(item.src));
  if (!script) return;
  const base = new URL('../', script.src);
  let index = null;
  let selection = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0,10) : null;
  const familyById = id => index?.families?.find(family => family.family_id === id);

  function link(tab, family) {
    const url = new URL('recalls/', base);
    url.searchParams.set('tab', tab);
    if (family) url.searchParams.set('family', family);
    return url.href;
  }
  function summary(family, source) {
    if (!source?.available) return '공개 신고 자료를 불러오지 못했습니다.';
    if (!family || family.match_status !== 'verified') return '공개 신고 자료의 차종명 연결을 검토 중입니다.';
    if (!Number.isInteger(family.report_count) || family.report_count < 0) return '공개 신고 건수를 확인하지 못했습니다.';
    return `공개자료에 연결된 신고 ${family.report_count.toLocaleString('ko-KR')}건 · 차종 전체 기준`;
  }
  function metadata(source) {
    const from = date(source?.period?.from), to = date(source?.period?.to);
    const period = from && to ? `신고 접수 기간 ${from}~${to}` : '신고 접수 기간 미확인';
    const updated = date(source?.provider_updated_at), checked = date(source?.checked_at);
    return [period, updated ? `원천 수정 ${updated}` : '', checked ? `자료 확인 ${checked}` : ''].filter(Boolean).join(' · ');
  }
  function render() {
    if (!index) return;
    if (!selection?.length) {
      host.innerHTML = '<p>차종을 선택하면 공식 신고 기록과 리콜 정보를 연결합니다.</p>';
      return;
    }
    const source = index.sources?.reports;
    host.innerHTML = selection.map((selected, side) => {
      const family = familyById(selected.family_id);
      const name = family?.name || selected.name;
      if (!family || !name) return '';
      const label = config.kind === 'pair' || config.kind === 'custom' ? `${side ? 'B' : 'A'} ${name}` : name;
      return `<div class="vehicle-official-issues-row"><h3>${escape(label)}</h3><p>${escape(summary(family, source))}</p><nav class="vehicle-official-issues-links" aria-label="${escape(label)} 공식 정보"><a href="${escape(link('reports', family.family_id))}">공식 신고 현황</a><a href="${escape(link('recalls', family.family_id))}">리콜</a><a href="${escape(link('free-repairs', family.family_id))}">무상수리</a></nav></div>`;
    }).join('') + `<p class="vehicle-official-issues-source">한국교통안전공단 · ${escape(metadata(source))}</p>`;
  }
  function currentCustomSelection() {
    if (!document.querySelector('#compareTable .variant-row')) return null;
    const params = new URLSearchParams(location.search);
    const reviewedVisible = document.getElementById('reviewedSelectors') && !document.getElementById('reviewedSelectors').classList.contains('hidden');
    if (reviewedVisible) {
      const ids = ['carA','carB'].map(id => document.getElementById(id)?.value);
      const families = ids.map(id => {
        const car = window.CAR_CATALOG?.byId?.[id];
        const normalized = String(car?.path || '').replace(/^\.\//, '').replace(/^\/+/, '');
        return config.reviewed_paths?.[normalized];
      });
      return families.every(id => familyById(id)) ? families.map(family_id => ({family_id})) : null;
    }
    const ids = [params.get('fa'), params.get('fb')];
    return ids.every(id => familyById(id)) ? ids.map(family_id => ({family_id})) : null;
  }
  function syncFamily() {
    const id = window.__carFamilyId;
    selection = id && familyById(id) ? [{family_id:id}] : null;
    render();
  }
  if (config.kind === 'custom') {
    window.addEventListener('car:comparison', event => {
      // An explicit null event denotes a loading/invalid selection. Never retain the previous cars.
      selection = event.detail ? currentCustomSelection() : null;
      render();
    });
  }
  if (config.kind === 'family') {
    window.addEventListener('car-family-data-ready', () => queueMicrotask(syncFamily));
  }
  fetch(new URL('data/generated/official-issues-index.json', base), {cache:'no-store'})
    .then(response => { if (!response.ok) throw new Error('official-issues-index'); return response.json(); })
    .then(data => {
      if (data.schema_version !== 1 || !Array.isArray(data.families)) throw new Error('official-issues-schema');
      index = data;
      if (config.kind === 'family') syncFamily();
      else if (config.kind === 'custom') { selection = currentCustomSelection(); render(); }
      else { selection = config.families; render(); }
    })
    .catch(() => {
      // Keep the server-rendered links usable when the optional statistics request fails.
      if (config.kind === 'family' || config.kind === 'custom') host.innerHTML = `<p>공식 자료를 불러오지 못했습니다.</p><nav class="vehicle-official-issues-links"><a href="${escape(link('reports'))}">공식 신고 현황</a><a href="${escape(link('recalls'))}">리콜</a><a href="${escape(link('free-repairs'))}">무상수리</a></nav>`;
    });
})();

(() => {
  const host = document.getElementById('compareDashboard');
  if (!host) return;
  const money = value => Math.round(value).toLocaleString('ko-KR') + '원';
  const tenThousand = value => (value / 10000).toLocaleString('ko-KR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '만';
  const text = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const side = index => index ? 'B' : 'A';

  function markDifferentCells() {
    document.querySelectorAll('#compareTable .variant-row:not(.head)').forEach(row => {
      const cells = [...row.children];
      if (cells.length < 3) return;
      const different = cells[1].textContent.trim() !== cells[2].textContent.trim();
      cells[1].classList.toggle('is-different', different);
      cells[2].classList.toggle('is-different', different);
    });
  }

  function stacked(data) {
    const max = Math.max(...data.totals, 1);
    return `<section class="compare-graphic compare-total" aria-label="연간 총비용 비교"><h3>연간 총비용 <small>에너지비 + 자동차세</small></h3><div class="compare-legend"><span><i class="chart-key-a"></i>A ${text(data.names[0])}</span><span><i class="chart-key-b"></i>B ${text(data.names[1])}</span></div><div class="compare-zero">0</div>${data.totals.map((total, index) => {
      const energy = data.energy[index], tax = data.tax[index];
      return `<div class="compare-total-row side-${index}"><span class="compare-side">${side(index)}</span><div class="compare-total-track" role="img" aria-label="${side(index)} 에너지비 ${money(energy)}, 자동차세 ${money(tax)}, 합계 ${money(total)}"><div class="compare-total-fill" style="width:${total / max * 100}%"><span class="energy-part" style="width:${energy / total * 100}%"></span><span class="tax-part" style="width:${tax / total * 100}%"></span></div></div><strong>${tenThousand(total)} <small>${money(total)}</small></strong></div>`;
    }).join('')}${Math.round(data.totals[0]) === Math.round(data.totals[1]) ? '<p class="compare-equal">차이 0원</p>' : ''}<p class="compare-chart-note">막대 안 진한 부분은 에너지비, 옅은 부분은 자동차세입니다.</p></section>`;
  }

  function components(data) {
    const items = [{title:'에너지비', values:data.energy}, {title:'자동차세', values:data.tax}];
    const max = Math.max(...data.energy, ...data.tax, 1);
    const groups = items.map(item => `<div class="compare-component-group"><h4>${item.title}</h4>${item.values.map((value,index) => `<div class="compare-component-row"><span>${side(index)}</span><div class="compare-component-track"><span class="compare-component-fill side-${index}" style="width:${value / max * 100}%"></span></div><strong>${money(value)}</strong></div>`).join('')}</div>`).join('');
    const prices = data.prices.map((price,index) => `${side(index)} ${text(data.fuel[index])} ${Number(price).toLocaleString('ko-KR',{maximumFractionDigits:2})}${text(data.units[index])}`).join(' · ');
    return `<section class="compare-graphic compare-components" aria-label="비용 구성 비교"><h3>비용 구성</h3>${groups}<p class="compare-chart-note">${prices}</p></section>`;
  }

  function distanceChart(data) {
    const distances = [...new Set([10000,20000,30000,50000,data.km])].sort((a,b) => a-b);
    const points = distances.map(km => ({km, values:data.at.map((at,index) => data.tax[index] + at(km))}));
    if (points.some(point => point.values.some(value => !Number.isFinite(value)))) return '';
    const max = Math.max(...points.flatMap(point => point.values), 1) * 1.08;
    const x = index => 48 + index * (548 / Math.max(points.length-1,1));
    const y = value => 168 - value / max * 142;
    const grids = [0,0.5,1].map(fraction => `<line x1="48" y1="${y(max*fraction)}" x2="596" y2="${y(max*fraction)}" class="chart-grid"/><text x="42" y="${y(max*fraction)+4}" text-anchor="end" class="chart-axis">${tenThousand(max*fraction)}</text>`).join('');
    const paths = [0,1].map(index => `<path class="chart-line side-${index}" d="${points.map((point,i) => `${i?'L':'M'}${x(i)},${y(point.values[index])}`).join(' ')}"/>`).join('');
    const dots = [0,1].map(index => points.map((point,i) => `<circle class="chart-dot side-${index}${point.km===data.km?' selected':''}" cx="${x(i)}" cy="${y(point.values[index])}" r="${point.km===data.km?5:3}"/>`).join('')).join('');
    const ticks = points.map((point,i) => `<text x="${x(i)}" y="194" text-anchor="middle" class="chart-axis${point.km===data.km?' selected':''}">${Math.round(point.km/1000)}천</text>`).join('');
    const start = points[0], end = points.at(-1), startDiff = start.values[0]-start.values[1], endDiff=end.values[0]-end.values[1];
    const cross = startDiff*endDiff<0 ? Math.round((start.km+(end.km-start.km)*Math.abs(startDiff)/(Math.abs(startDiff)+Math.abs(endDiff)))/100)*100 : null;
    const exact = points.map(point => `<div class="compare-distance-values${point.km===data.km?' selected':''}"><span>${point.km.toLocaleString('ko-KR')} km</span><span>A ${tenThousand(point.values[0])}</span><span>B ${tenThousand(point.values[1])}</span></div>`).join('');
    return `<section class="compare-graphic compare-distance" aria-label="주행거리별 총비용 비교"><h3>주행거리별 총비용</h3><svg viewBox="0 0 640 216" role="img" aria-label="연간 주행거리별 자동차세와 에너지비 합계. 검정 A, 파랑 B.">${grids}${paths}${dots}${ticks}</svg><div class="compare-distance-data">${exact}</div>${cross ? `<p class="compare-chart-note">약 ${cross.toLocaleString('ko-KR')} km에서 두 비용이 교차합니다.</p>` : ''}</section>`;
  }

  function render(data) {
    markDifferentCells();
    if (!data) {host.replaceChildren(); return;}
    if ([...data.energy,...data.tax,...data.totals].some(value => !Number.isFinite(value))) {
      host.innerHTML = '<p class="compare-empty">두 사양의 에너지비와 자동차세가 모두 계산될 때 비용 차트를 표시합니다.</p>';
      return;
    }
    const difference = Math.round(data.totals[1]-data.totals[0]);
    const result = difference===0 ? '동일' : `B가 ${money(Math.abs(difference))} ${difference>0?'높음':'낮음'}`;
    host.innerHTML = `<p class="compare-summary">연 ${data.km.toLocaleString('ko-KR')} km · A 대비 B 자동차세+에너지비: <strong>${result}</strong></p><div class="compare-chart-grid">${stacked(data)}${components(data)}</div>${distanceChart(data)}`;
  }
  window.addEventListener('car:comparison', event => render(event.detail));
})();

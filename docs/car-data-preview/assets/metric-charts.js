(function(root){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>v.toLocaleString('ko-KR',{maximumFractionDigits:2});
 function bars({title,rows,unit='원',note='',stacked=false}){
  if(rows.length!==2||rows.some(r=>!r.values.length||r.values.some(v=>!Number.isFinite(v)||v<0)))return '';
  const totals=rows.map(r=>r.values.reduce((a,b)=>a+b,0)),max=Math.max(...totals,1),cost=unit==='원';
  const gap=Math.abs(totals[0]-totals[1]),same=cost?Math.round(gap)===0:gap<.00001,winner=cost?(totals[0]<totals[1]?0:1):(totals[0]>totals[1]?0:1);
  const money=v=>'약 '+Math.round(v).toLocaleString('ko-KR')+'원';
  const display=v=>cost?money(v):n(v)+' '+unit;
  const compact=v=>cost?(v<10000?Math.round(v).toLocaleString('ko-KR')+'<small>원</small>':n(Math.round(v/1000)/10)+'<small>만원</small>'):n(v)+'<small>'+esc(unit)+'</small>';
  const label=r=>esc(r.label.replace(/^[AB]\s*/,''));
  return '<figure class="metric-chart metric-redesign" data-metric-unit="'+esc(unit)+'" data-metric-max="'+max+'"><figcaption><span class="metric-eyebrow">'+esc(title)+'</span><div class="metric-verdict">'+(same?'<strong>'+(cost?'연간 비용':'복합 효율')+'이 같습니다</strong>':'<span class="metric-winner">'+(winner?'B':'A')+'의 '+(cost?'연간 비용이':'복합 효율이')+'</span><strong>'+(cost?'<small class="metric-about">약</small> ':'')+compact(gap)+' <em>'+(cost?'적습니다':'높습니다')+'</em></strong>')+'</div></figcaption><div class="metric-rows">'+rows.map((r,i)=>'<div class="metric-row" data-metric-total="'+totals[i]+'"><div class="metric-label"><span class="metric-letter">'+(i?'B':'A')+'</span><span>'+label(r)+'</span></div><div class="metric-total" aria-label="'+esc(display(totals[i]))+'">'+compact(totals[i])+'</div><div class="metric-track" aria-hidden="true">'+r.values.map((v,j)=>'<span class="metric-fill metric-part-'+j+'" data-value="'+v+'" style="height:'+v/max*100+'%;--metric-ratio:'+v/max*100+'%"></span>').join('')+'</div></div>').join('')+'</div><div class="metric-baseline" aria-hidden="true"><span>0</span><span>'+(cost?'연간 비용 · 만원':esc(unit))+'</span></div>'+(stacked?'<div class="metric-legend"><span><i></i>연료·충전비</span><span><i></i>자동차세</span></div>':'')+'<details class="metric-detail"><summary>'+(cost?'금액·계산 기준':'수치·비교 기준')+'</summary><div class="metric-detail-values">'+rows.map((r,i)=>'<p><b>'+(i?'B':'A')+'</b> '+display(totals[i])+(stacked?'<span>연료·충전비 '+money(r.values[0])+' / 자동차세 '+Math.round(r.values[1]).toLocaleString('ko-KR')+'원</span>':'')+'</p>').join('')+'</div><p>'+esc(note)+'</p></details></figure>';
 }
 root.CAR_METRIC_CHARTS={bars};
})(globalThis);

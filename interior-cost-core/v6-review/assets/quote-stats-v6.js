(()=>{
  const scriptUrl=document.currentScript?.src||location.href;
  const root=new URL('../',scriptUrl);
  const $=(s,r=document)=>r.querySelector(s);
  const money=n=>Number(n||0).toLocaleString('ko-KR');
  let dataset={segments:[],minimum_public_sample:80,status:'no_public_segment'};

  if(!document.querySelector('link[data-v6-quote-stats]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=new URL('quote-stats-v6.css',scriptUrl).href;link.dataset.v6QuoteStats='';document.head.append(link);
  }

  const pyeongBand=v=>({"24평":"20-24평","30평":"30-34평","32평":"30-34평","34평":"30-34평","40평":"40-49평"})[v]||v;
  const scope=v=>String(v||'').startsWith('전체')?'전체':'부분';
  const windows=v=>v==='포함'?'included':'excluded';
  const condition=v=>v==='포함'?'included':v==='별도'?'separate':'unknown';
  const bathrooms=v=>String(v||'2').replace('개','').replace(' 이상','+').replace('3+','3+');

  function selected(){
    return {
      region_level1:$('#region')?.value||'',
      pyeong_band:pyeongBand($('#size')?.value||''),
      scope:scope($('#scope')?.value||''),
      bathroom_count:bathrooms($('#bathrooms')?.value||'2'),
      window_status:windows($('#window')?.value||'제외'),
      vat_status:condition($('#vat-condition')?.value||'미확인'),
      waste_status:condition($('#waste-condition')?.value||'미확인')
    };
  }
  function same(a,b){return Object.entries(a).every(([k,v])=>String(b?.[k]??'')===String(v))}
  function findSegment(){const wanted=selected();return (dataset.segments||[]).find(s=>same(wanted,s.dimensions))||null}
  function chips(){
    const host=$('[data-market-conditions]');if(!host)return;
    const x=selected();
    const labels=[`지역 ${x.region_level1}`,`평수 ${x.pyeong_band}`,`범위 ${x.scope}`,`욕실 ${x.bathroom_count}`,`샷시 ${$('#window')?.value||'제외'}`,`VAT ${$('#vat-condition')?.value||'미확인'}`,`폐기물 ${$('#waste-condition')?.value||'미확인'}`];
    host.innerHTML=labels.map(v=>`<span>${v}</span>`).join('');
  }
  function scenarioTitle(){
    const el=$('#scenario-title');if(!el)return;
    el.textContent=[
      $('#size')?.value,$('#region')?.value,$('#scope')?.value?.replace(' 인테리어',''),`욕실 ${$('#bathrooms')?.value||'2개'}`,`샷시 ${$('#window')?.value||'제외'}`,`VAT ${$('#vat-condition')?.value||'미확인'}`,`폐기물 ${$('#waste-condition')?.value||'미확인'}`
    ].filter(Boolean).join(' · ');
  }
  function svg(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e}
  function drawRange(seg){
    const chart=$('[data-market-range]');if(!chart)return;
    const stats=seg.total_amount_manwon||{},input=Number($('#quote-total')?.value||0);
    const vals=[stats.p25,stats.median,stats.p75,input||null].filter(v=>Number.isFinite(Number(v))).map(Number);
    if(vals.length<3){chart.hidden=true;return}
    const rawMin=Math.min(...vals),rawMax=Math.max(...vals),pad=Math.max(250,(rawMax-rawMin)*.18),min=Math.max(0,rawMin-pad),max=rawMax+pad;
    const x=v=>48+(Number(v)-min)/(max-min)*704;
    chart.innerHTML='';chart.hidden=false;chart.setAttribute('viewBox','0 0 800 110');chart.classList.add('market-range-svg');
    chart.append(svg('line',{x1:48,y1:56,x2:752,y2:56,stroke:'#c9c2b7','stroke-width':2}));
    chart.append(svg('rect',{x:x(stats.p25),y:43,width:Math.max(2,x(stats.p75)-x(stats.p25)),height:26,fill:'#e6ded0'}));
    chart.append(svg('line',{x1:x(stats.median),y1:34,x2:x(stats.median),y2:78,stroke:'#171816','stroke-width':2}));
    for(const [label,val] of [['P25',stats.p25],['중앙값',stats.median],['P75',stats.p75]]){
      const t=svg('text',{x:x(val),y:22,'text-anchor':'middle',fill:'#625e57','font-size':11});t.textContent=label;chart.append(t)
    }
    if(input){chart.append(svg('circle',{cx:x(input),cy:56,r:7,fill:'#a52b20',stroke:'#fcfbf7','stroke-width':2}));const t=svg('text',{x:x(input),y:101,'text-anchor':'middle',fill:'#a52b20','font-size':11,'font-weight':700});t.textContent='내 견적';chart.append(t)}
  }
  function render(){
    chips();scenarioTitle();
    const seg=findSegment(),metric=$('[data-quote-stat-metric]'),status=$('[data-quote-stat-status]'),small=$('[data-quote-stat-small]'),panel=$('[data-market-panel]'),marketStatus=$('[data-market-status]'),placeholder=$('[data-market-placeholder]'),wrap=$('[data-market-range-wrap]'),note=$('[data-market-note]'),labels=$('[data-market-labels]');
    if(!panel)return;
    if(!seg){
      if(metric)metric.dataset.quoteStatState='locked';if(status)status.textContent='공개 기준 미충족';if(small)small.textContent='선택 조건 공개 세그먼트 없음';if(marketStatus)marketStatus.textContent='비교 데이터 공개 기준 미충족';if(placeholder)placeholder.hidden=false;if(wrap)wrap.hidden=true;if(labels)labels.innerHTML='';if(note)note.textContent=`같은 조건의 검수 승인 유효표본이 ${dataset.minimum_public_sample||80}건 이상일 때만 P25·중앙값·P75를 표시합니다.`;return;
    }
    if(metric)metric.dataset.quoteStatState='ready';if(status)status.textContent=`${money(seg.sample_count)}건`;if(small)small.textContent=`${seg.period?.from||'—'} ~ ${seg.period?.to||'—'} · 이상치 ${money(seg.excluded_outlier_count||0)}건 분리`;if(marketStatus)marketStatus.textContent=`공개 표본 ${money(seg.sample_count)}건`;if(placeholder)placeholder.hidden=true;if(wrap)wrap.hidden=false;
    const s=seg.total_amount_manwon||{},input=Number($('#quote-total')?.value||0);
    if(labels)labels.innerHTML=[['P25',s.p25],['중앙값',s.median],['P75',s.p75],['내 견적',input||null]].map(([k,v])=>`<div><span>${k}</span><strong>${v==null?'미입력':money(v)+'만원'}</strong></div>`).join('');
    if(note)note.textContent=`${seg.period?.from||'—'}~${seg.period?.to||'—'} 익명 견적 중 같은 조건의 검수 승인 표본만 집계했습니다. 이 범위는 적정가 판정이 아닙니다.`;
    drawRange(seg);
  }
  async function load(){
    try{const r=await fetch(new URL('data/quote-public-segments.json',root),{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d?.segments))dataset=d}}catch{}
    render();
  }
  document.addEventListener('change',e=>{if(e.target.closest('.filter-row'))render()});
  $('#quote-total')?.addEventListener('input',render);
  load();
})();

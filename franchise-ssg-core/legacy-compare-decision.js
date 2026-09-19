(()=>{
  const fmtNumber=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
  const parseNumber=text=>{
    const raw=String(text||'').trim();
    if(!raw||/정보 없음|공개값 없음/.test(raw))return null;
    const match=raw.replaceAll(',','').match(/[+-]?\d+(?:\.\d+)?/);
    if(!match)return null;
    const value=Number(match[0]);
    return Number.isFinite(value)?value:null;
  };
  const init=()=>{
    const main=document.querySelector('main[data-v10-compare="1"]');
    if(!main||document.querySelector('[data-v34-workspace]')||document.querySelector('section[data-v52-legacy-compare-decision="1"]'))return;
    const article=main.querySelector('article'),head=article?.querySelector('.compare-head'),table=article?.querySelector('.compare-table');
    if(!article||!head||!table)return;
    const brands=[...head.querySelectorAll('.compare-brand strong')].map(el=>el.textContent.trim()).filter(Boolean);
    if(brands.length!==2)return;
    const rows=new Map();
    for(const row of table.querySelectorAll('tbody tr')){
      const cells=[...row.children],label=cells[0]?.textContent.trim();
      if(label&&cells.length>=3)rows.set(label,cells);
    }
    const metrics=[
      ['공개 창업비용 합계','공개 창업비용','만원','만원'],
      ['가맹점 수','가맹점','개','개'],
      ['평균매출 공개지표','평균매출 공개값','만원','만원'],
      ['이전 기준 증감률','점포 증감','%','%p']
    ];
    if(metrics.some(([source])=>!rows.has(source)))return;
    document.body.classList.add('v52-legacy-compare');
    main.dataset.v52LegacyCompare='1';
    head.dataset.v52LegacyHead='1';
    head.querySelector('.answer-box')?.setAttribute('data-v52-legacy-answer','1');

    const decision=document.createElement('section');
    decision.className='v52-legacy-decision';
    decision.dataset.v52LegacyCompareDecision='1';
    decision.setAttribute('aria-label','기존 비교 페이지 핵심 공개값 요약');
    decision.innerHTML='<div class="v52-legacy-decision-head"><div><span>공개값 비교</span><strong>핵심 차이만 먼저 확인</strong></div><p>한쪽 공개값이 없는 지표는 0으로 바꾸지 않고 그대로 표시합니다. 공개비용·매출·가맹점 수는 수익성을 뜻하지 않습니다.</p></div><div class="v52-legacy-decision-grid" data-v52-legacy-decision-grid></div>';
    const grid=decision.querySelector('[data-v52-legacy-decision-grid]');
    for(const[source,label,unit,diffUnit]of metrics){
      const cells=rows.get(source),texts=[cells[1].textContent.trim(),cells[2].textContent.trim()],values=texts.map(parseNumber);
      const card=document.createElement('article');
      card.className='v52-legacy-decision-card';
      card.dataset.v52LegacyMetric=source;
      const title=document.createElement('h3');title.textContent=label;card.append(title);
      const list=document.createElement('div');list.className='v52-legacy-decision-values';
      brands.forEach((name,index)=>{const row=document.createElement('div'),brand=document.createElement('span'),value=document.createElement('strong');brand.textContent=name;value.textContent=texts[index]||'공개값 없음';row.append(brand,value);list.append(row)});
      card.append(list);
      const note=document.createElement('p');note.className='v52-legacy-decision-diff';
      if(values.every(v=>v!==null))note.textContent='두 값 차이 '+fmtNumber(Math.abs(values[0]-values[1]))+diffUnit;
      else{note.textContent='공개값이 한쪽에만 있어 차이를 계산하지 않습니다.';card.dataset.v52LegacyMissing='1'}
      card.append(note);grid.append(card);
    }
    head.after(decision);

    const blocks=[...article.querySelectorAll(':scope > section.block')];
    const blockStarts=text=>blocks.find(section=>section.querySelector(':scope > h2')?.textContent.trim().startsWith(text));
    const cost=blockStarts('공개 창업비용'),trend=blockStarts('가맹점 흐름'),warning=blockStarts('이 비교가 틀릴 수'),source=blockStarts('출처');
    const wrapChart=(section,label,kind)=>{
      const svg=section?.querySelector('svg.chart-svg');
      if(!svg||svg.closest('[data-v52-legacy-chart-scroll]'))return;
      const wrap=document.createElement('div');wrap.className='v52-legacy-chart-scroll';wrap.dataset.v52LegacyChartScroll=kind;wrap.tabIndex=0;wrap.setAttribute('aria-label',label);svg.before(wrap);wrap.append(svg);
    };
    if(cost){cost.dataset.v52LegacyCost='1';wrapChart(cost,'공개 창업비용 비교 차트, 좌우로 스크롤 가능','cost');const scroll=cost.querySelector('.compare-table-desktop .table-scroll');if(scroll){scroll.dataset.v52LegacyTableScroll='1';scroll.setAttribute('aria-label','공개 창업비용과 핵심 지표 비교표, 좌우로 스크롤 가능')}const mobile=cost.querySelector('.mobile-compare');if(mobile){mobile.dataset.v52LegacyMobileCards='1';mobile.setAttribute('aria-label','모바일 비교 카드')}}
    if(trend){trend.dataset.v52LegacyTrend='1';wrapChart(trend,'연도별 가맹점 추이, 좌우로 스크롤 가능','trend')}
    if(warning)warning.dataset.v52LegacyWarning='1';
    if(source)source.dataset.v52LegacySource='1';
    const actions=article.querySelector('.actions');if(actions){actions.dataset.v52LegacyActions='1';actions.setAttribute('aria-label','비교 후 다음 단계')}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

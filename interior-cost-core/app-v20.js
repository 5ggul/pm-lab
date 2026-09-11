(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:0});
  function initCalculator(){
    const root=$('[data-v20-calculator]');if(!root)return;
    const select=$('[data-v20-group]',root),qty=$('[data-v20-qty]',root),unit=$('[data-v20-unit]',root),note=$('[data-v20-calc-note]',root);
    let groups=[];try{groups=JSON.parse($('[data-v20-stats]',root)?.textContent||'[]')}catch{}
    const byKey=new Map(groups.map(x=>[`${x.term}|${x.normalized_unit}`,x]));
    const set=(sel,val)=>{const el=$(sel,root);if(el)el.textContent=val};
    const update=()=>{
      const g=byKey.get(select?.value||'');const q=Number(qty?.value||0);
      if(unit)unit.textContent=g?.normalized_unit||'-';
      if(!g||!Number.isFinite(q)||q<=0){set('[data-v20-p25]','0원');set('[data-v20-median]','0원');set('[data-v20-p75]','0원');if(note)note.textContent='자재·단위와 수량을 입력하면 조달청 공개 레코드 분포를 단순 곱셈합니다.';return;}
      set('[data-v20-p25]',`${fmt(g.p25_price_krw*q)}원`);set('[data-v20-median]',`${fmt(g.median_price_krw*q)}원`);set('[data-v20-p75]',`${fmt(g.p75_price_krw*q)}원`);
      if(note)note.textContent=`${g.term} · ${g.normalized_unit} · N=${g.record_count}. 자재 공개가격×수량 계산이며 시공비·폐기물·마진·민간 시장가격을 추정하지 않습니다.`;
    };
    select?.addEventListener('change',update);qty?.addEventListener('input',update);update();
  }
  function markReady(){if(document.body)document.body.dataset.v20Ready='1'}
  function init(){initCalculator();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

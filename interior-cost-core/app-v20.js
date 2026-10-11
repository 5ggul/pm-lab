(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:0});
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const money=v=>finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})}원`:'-';
  const html=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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

  function initQuoteCompare(){
    const root=$('[data-v20-quote-compare]');if(!root)return;
    const unit=$('[data-v20-compare-unit]',root),userPrice=$('[data-v20-user-price]',root),qty=$('[data-v20-compare-qty]',root),selectedUnit=$('[data-v20-selected-unit]',root),out=$('[data-v20-compare-output]',root),bars=$('[data-v20-compare-bars]',root),note=$('[data-v20-compare-note]',root);
    const selects={material:$('[data-v20-ref-material]',root),market:$('[data-v20-ref-market]',root),standard:$('[data-v20-ref-standard]',root)};
    let data={references:[]};try{data=JSON.parse($('[data-v20-compare-data]',root)?.textContent||'{}')}catch{}
    const refs=Array.isArray(data.references)?data.references:[];
    const byId=new Map(refs.map(x=>[x.id,x]));
    const sourceLabel={material:'시설공통자재',market:'건축 시장시공가격',standard:'건축공사 표준시장단가'};
    const optionLabel=r=>[r.label,r.detail,`N=${r.record_count}`].filter(Boolean).join(' · ');
    const fillOptions=()=>{
      const key=unit?.value||'';
      if(selectedUnit)selectedUnit.textContent=key||'-';
      for(const [source,select] of Object.entries(selects)){
        if(!select)continue;
        const previous=select.value;
        select.replaceChildren(new Option('선택 안 함',''));
        refs.filter(r=>r.source===source&&r.unit_key===key).forEach(r=>select.add(new Option(optionLabel(r),r.id)));
        if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
      }
      render();
    };
    const deltaText=(refTotal,userTotal)=>{
      if(!finite(refTotal)||!finite(userTotal)||Number(userTotal)<=0)return '-';
      const d=Number(refTotal)-Number(userTotal),pct=d/Number(userTotal)*100,sign=d>0?'+':'';
      return `${sign}${Number(d).toLocaleString('ko-KR',{maximumFractionDigits:0})}원 (${sign}${pct.toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`;
    };
    const render=()=>{
      const unitKey=unit?.value||'',price=Number(userPrice?.value||0),q=Number(qty?.value||0),validPrice=Number.isFinite(price)&&price>0,validQty=Number.isFinite(q)&&q>0;
      const userTotal=validPrice&&validQty?price*q:null;
      const rows=[];
      if(validPrice){rows.push({kind:'user',name:'내 견적',label:'사용자 입력',unit:unitKey,median:price,range:'입력값',total:userTotal,delta:'기준'});}
      for(const [source,select] of Object.entries(selects)){
        const r=byId.get(select?.value||'');if(!r)continue;
        const total=finite(r.median_krw)&&validQty?Number(r.median_krw)*q:null;
        const range=finite(r.low_krw)&&finite(r.high_krw)?`${money(r.low_krw)} – ${money(r.high_krw)} (${r.range_label})`:'-';
        rows.push({kind:source,name:sourceLabel[source],label:[r.label,r.detail].filter(Boolean).join(' · '),unit:r.unit_key,median:r.median_krw,range,total,delta:deltaText(total,userTotal),record_count:r.record_count});
      }
      if(out){
        out.innerHTML=rows.length?rows.map(r=>`<tr data-v20-compare-row="${html(r.kind)}"><th scope="row">${html(r.name)}</th><td>${html(r.label)}${r.record_count?`<small>N=${Number(r.record_count).toLocaleString('ko-KR')}</small>`:''}</td><td>${html(r.unit||'-')}</td><td><b>${money(r.median)}</b></td><td>${html(r.range)}</td><td><b>${money(r.total)}</b></td><td>${html(r.delta)}</td></tr>`).join(''):'<tr><td colspan="7">내 견적 단가 또는 공식 참고 항목을 선택하세요.</td></tr>';
      }
      if(bars){
        const graphRows=rows.filter(r=>finite(r.total)&&Number(r.total)>0),max=Math.max(1,...graphRows.map(r=>Number(r.total)));
        bars.innerHTML=graphRows.map(r=>{const width=Math.max(2,Math.round(Number(r.total)/max*100));return `<div class="v20-compare-bar-row is-${html(r.kind)}"><span>${html(r.name)}</span><div class="v20-compare-bar-track"><i style="width:${width}%"></i></div><strong>${money(r.total)}</strong></div>`}).join('');
      }
      if(note){
        const counts=Object.fromEntries(Object.entries(selects).map(([s,select])=>[s,select?[...select.options].filter(o=>o.value).length:0]));
        note.textContent=unitKey?`같은 ${unitKey} 후보만 표시합니다. 자재 ${counts.material} · 시공 ${counts.market} · 표준 ${counts.standard}. 차이는 ‘공식 참고합계 − 내 견적 합계’이며 가격 적정성 판정이 아닙니다.`:'비교 단위를 선택하세요.';
      }
    };
    unit?.addEventListener('change',fillOptions);userPrice?.addEventListener('input',render);qty?.addEventListener('input',render);Object.values(selects).forEach(select=>select?.addEventListener('change',render));
    fillOptions();
  }

  function markReady(){if(document.body)document.body.dataset.v20Ready='1'}
  function init(){initCalculator();initQuoteCompare();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

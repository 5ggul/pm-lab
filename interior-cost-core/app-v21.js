(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:0});
  const parseJson=(sel,root=document)=>{try{return JSON.parse($(sel,root)?.textContent||'null')}catch{return null}};
  const money=n=>Number.isFinite(Number(n))?`${fmt(n)}원`:'-';

  function initReferenceLayers(){
    const root=$('[data-v21-layer-tool]');if(!root)return;
    const config=parseJson('[data-v21-layer-config]',root)||{};
    const trade=$('[data-v21-trade]',root),qty=$('[data-v21-qty]',root),quote=$('[data-v21-quote-rate]',root),refSel=$('[data-v21-reference]',root);
    const sameUnit=$('[data-v21-same-unit]',root),sameScope=$('[data-v21-same-scope]',root),sameMaterial=$('[data-v21-same-material]',root);
    const publicHost=$('[data-v21-public-list]',root),materialHost=$('[data-v21-material-list]',root),diff=$('[data-v21-diff]',root);
    const tradeMap=new Map((config.trades||[]).map(x=>[x.id,x]));
    const publicByCode=new Map();
    for(const t of config.trades||[])for(const r of t.public_refs||[])publicByCode.set(r.code,r);
    const rowHtml=(r,q)=>`<div class="v21-ref-row"><div><strong>${r.name}</strong><small>${r.spec||''}${r.exclude?` · ${r.exclude}`:''}</small></div><span>${r.unit}</span><b>${money(r.price)}</b><b>${q>0?money(r.price*q):'수량 입력'}</b></div>`;
    const materialHtml=(m,q)=>`<section class="v21-layer"><div class="v21-layer__head"><h3>${m.label} · ${m.unit}</h3><p>N=${m.record_count} · ${m.latest_notice_at||'-'}</p></div><div class="v21-material-grid"><div><span>P25${q>0?' × 수량':''}</span><strong>${money(q>0?m.p25*q:m.p25)}</strong></div><div><span>중앙값${q>0?' × 수량':''}</span><strong>${money(q>0?m.median*q:m.median)}</strong></div><div><span>P75${q>0?' × 수량':''}</span><strong>${money(q>0?m.p75*q:m.p75)}</strong></div></div><p>조달청 자재 공개가격 분포이며 시공비나 민간 적정가격이 아닙니다.</p></section>`;
    function populateReference(t){
      if(!refSel)return;
      refSel.innerHTML='<option value="">표준시장단가 항목 선택</option>'+((t?.public_refs||[]).map(r=>`<option value="${r.code}">${r.name} · ${money(r.price)}/${r.unit}</option>`).join(''));
    }
    function update(){
      const t=tradeMap.get(trade?.value||'')||null,q=Number(qty?.value||0),qr=Number(quote?.value||0);
      if(publicHost)publicHost.innerHTML=t?.public_refs?.length?(t.public_refs.map(r=>rowHtml(r,q)).join('')):'<p>연결된 표준시장단가 항목이 없습니다.</p>';
      if(materialHost)materialHost.innerHTML=t?.materials?.length?(t.materials.map(m=>materialHtml(m,q)).join('')):'<p>현재 조달청 자재 레이어가 없습니다. 다른 자재 값을 대신 넣지 않습니다.</p>';
      const selected=publicByCode.get(refSel?.value||'');
      const gate=Boolean(selected&&qr>0&&sameUnit?.checked&&sameScope?.checked&&sameMaterial?.checked);
      if(diff){
        diff.dataset.state=gate?'ready':'blocked';
        if(!selected)diff.innerHTML='<strong>비교할 표준시장단가를 선택하세요.</strong><p>차이는 자동 표시하지 않습니다.</p>';
        else if(!gate)diff.innerHTML='<strong>차이 계산 잠금</strong><p>같은 단위, 유사 작업범위, 재료 포함조건을 모두 확인한 뒤에만 입력 견적과 표준시장단가의 차이를 표시합니다.</p>';
        else{
          const d=qr-selected.price,p=selected.price?d/selected.price*100:0;
          diff.innerHTML=`<strong>${d>=0?'+':''}${fmt(d)}원/${selected.unit} · ${p>=0?'+':''}${p.toFixed(1)}%</strong><p>사용자 입력 견적 단가 − 선택한 공공 시공 참고단가입니다. 적정/부적정 판정이 아니라 조건을 맞춘 산술 차이입니다.</p>`;
        }
      }
    }
    trade?.addEventListener('change',()=>{populateReference(tradeMap.get(trade.value));update()});
    qty?.addEventListener('input',update);quote?.addEventListener('input',update);refSel?.addEventListener('change',update);
    for(const el of [sameUnit,sameScope,sameMaterial])el?.addEventListener('change',update);
    populateReference(tradeMap.get(trade?.value||''));update();
  }

  function initRouteCalculators(){
    $$('[data-v21-route-calc]').forEach(root=>{
      const config=parseJson('[data-v21-route-config]',root)||{};
      const qty=$('[data-v21-route-qty]',root),host=$('[data-v21-route-results]',root),note=$('[data-v21-route-note]',root);
      const update=()=>{
        const q=Number(qty?.value||0);
        const rows=[];
        for(const r of config.public_refs||[])rows.push(`<div class="v21-route-result"><span>REFERENCE · ${r.name} · ${r.unit}</span><strong>${q>0?money(r.price*q):money(r.price)+' / '+r.unit}</strong></div>`);
        for(const m of config.materials||[])rows.push(`<div class="v21-route-result"><span>OFFICIAL MATERIAL · ${m.label} · ${m.unit} · N=${m.record_count}</span><strong>${q>0?`${money(m.p25*q)} · ${money(m.median*q)} · ${money(m.p75*q)}`:`P25 ${money(m.p25)} · 중앙 ${money(m.median)} · P75 ${money(m.p75)}`}</strong></div>`);
        if(host)host.innerHTML=rows.join('')||'<p>현재 연결 가능한 공식/공공 참고 레이어가 없습니다.</p>';
        if(note)note.textContent=q>0?`입력 수량 ${q.toLocaleString('ko-KR')}㎡에 각 레이어를 따로 곱했습니다. 서로 다른 레이어를 자동 합산하지 않습니다.`:'실제 작업면적 또는 수량을 입력하세요. 평수 표시는 공급면적 단순 환산일 뿐 작업면적을 자동 추정하지 않습니다.';
      };
      qty?.addEventListener('input',update);update();
    });
  }

  function initMatrixFilter(){
    const root=$('[data-v21-matrix-filter]');if(!root)return;
    const p=$('[data-v21-filter-pyeong]',root),t=$('[data-v21-filter-trade]',root),rows=$$('[data-v21-matrix-row]',root);
    const update=()=>{for(const row of rows){const okP=!p?.value||row.dataset.pyeong===p.value,okT=!t?.value||row.dataset.trade===t.value;row.hidden=!(okP&&okT)}};
    p?.addEventListener('change',update);t?.addEventListener('change',update);update();
  }

  function markReady(){if(document.body)document.body.dataset.v21Ready='1'}
  function init(){initReferenceLayers();initRouteCalculators();initMatrixFilter();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

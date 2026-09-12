(()=>{
'use strict';
const BASE='/pm-lab/interior-cost-stratton-v33-preview';
const won=n=>Number.isFinite(n)?`${Math.round(n).toLocaleString('ko-KR')}만원`:'—';
const num=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const qs=(r,s)=>r.querySelector(s),qsa=(r,s)=>[...r.querySelectorAll(s)];

function quoteValue(card){
  const amount=num(qs(card,'[data-v8-total]')?.value);
  const vat=qs(card,'[data-v8-vat]')?.value||'unknown',vatAmount=num(qs(card,'[data-v8-vat-amount]')?.value);
  const waste=qs(card,'[data-v8-waste]')?.value||'unknown',wasteAmount=num(qs(card,'[data-v8-waste-amount]')?.value);
  const windowState=qs(card,'[data-v8-window]')?.value||'unknown',windowAmount=num(qs(card,'[data-v8-window-amount]')?.value);
  let normalized=amount,missing=[];
  if(amount==null||amount<=0)missing.push('총액');
  if(vat==='separate'){if(vatAmount!=null)normalized=(normalized??0)+vatAmount;else missing.push('VAT 별도금액')}
  else if(vat==='unknown')missing.push('VAT 조건');
  if(waste==='separate'){if(wasteAmount!=null)normalized=(normalized??0)+wasteAmount;else missing.push('폐기물 별도금액')}
  else if(waste==='unknown')missing.push('폐기물 조건');
  if(windowState==='excluded'){if(windowAmount!=null)normalized=(normalized??0)+windowAmount;else missing.push('창호 추가금액')}
  else if(windowState==='unknown')missing.push('창호 조건');
  return {amount,normalized:missing.length?null:normalized,missing,vat,waste,windowState,vatAmount,wasteAmount,windowAmount};
}
function stateLabel(type,v){
  const map={vat:{included:'포함',separate:'별도',unknown:'미기재'},waste:{included:'포함',separate:'별도',unknown:'미기재'},window:{included:'포함',excluded:'제외',none:'해당없음',unknown:'미기재'}};return map[type]?.[v]||v;
}
function toggleAddons(card){
  const vat=qs(card,'[data-v8-vat]')?.value,waste=qs(card,'[data-v8-waste]')?.value,windowState=qs(card,'[data-v8-window]')?.value;
  qs(card,'[data-v8-vat-addon]')?.classList.toggle('is-on',vat==='separate');
  qs(card,'[data-v8-waste-addon]')?.classList.toggle('is-on',waste==='separate');
  qs(card,'[data-v8-window-addon]')?.classList.toggle('is-on',windowState==='excluded');
}
function initTriple(root){
  const cards=qsa(root,'[data-v8-quote]'),storageKey='interior-v8-triple-quote';
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved))cards.forEach((card,i)=>{const row=saved[i]||{};qsa(card,'[data-v8-field]').forEach(el=>{if(row[el.dataset.v8Field]!=null)el.value=row[el.dataset.v8Field]})})}catch{}
  const render=()=>{
    const vals=cards.map(card=>{toggleAddons(card);return quoteValue(card)}),complete=vals.filter(v=>v.normalized!=null),numbers=complete.map(v=>v.normalized),min=numbers.length?Math.min(...numbers):0,max=numbers.length?Math.max(...numbers):0;
    cards.forEach((card,i)=>{const v=vals[i],out=qs(card,'[data-v8-result]'),note=qs(card,'[data-v8-result-note]');if(out)out.textContent=v.normalized==null?'조건 미완성':won(v.normalized);if(note)note.textContent=v.missing.length?`확인: ${v.missing.join(' · ')}`:'비교조건 반영 완료'});
    const range=qs(root,'[data-v8-range]');if(range){range.innerHTML=vals.map((v,i)=>{const label=String.fromCharCode(65+i);if(v.normalized==null)return `<div class="v8-range-row"><span>견적 ${label}</span><div class="v8-track"></div><strong>보류</strong></div>`;const x=max===min?50:((v.normalized-min)/(max-min))*100;return `<div class="v8-range-row"><span>견적 ${label}</span><div class="v8-track"><i class="v8-dot" style="--x:${x.toFixed(1)}%"></i></div><strong>${won(v.normalized)}</strong></div>`}).join('')}
    const body=qs(root,'[data-v8-condition-body]');if(body){const row=(name,type,key)=>`<tr><th>${name}</th>${vals.map(v=>`<td>${esc(stateLabel(type,v[key]))}</td>`).join('')}</tr>`;body.innerHTML=row('VAT','vat','vat')+row('폐기물','waste','waste')+row('창호','window','windowState')}
    const status=qs(root,'[data-v8-compare-status]');if(status){if(complete.length<2)status.textContent='비교 가능한 견적이 2개 이상 필요';else{const spread=max-min;status.textContent=`조건 맞춘 총액 범위 ${won(min)} ~ ${won(max)} · 차이 ${won(spread)}`}}
    const save=cards.map(card=>Object.fromEntries(qsa(card,'[data-v8-field]').map(el=>[el.dataset.v8Field,el.value])));try{localStorage.setItem(storageKey,JSON.stringify(save))}catch{}
  };
  qsa(root,'input,select').forEach(el=>el.addEventListener('input',render));
  qs(root,'[data-v8-reset]')?.addEventListener('click',()=>{cards.forEach(card=>qsa(card,'input').forEach(x=>x.value=''));cards.forEach(card=>qsa(card,'select').forEach(x=>x.selectedIndex=0));try{localStorage.removeItem(storageKey)}catch{}render()});
  qs(root,'[data-v8-copy]')?.addEventListener('click',async()=>{const vals=cards.map(quoteValue);const lines=vals.map((v,i)=>`견적 ${String.fromCharCode(65+i)}: 입력 ${v.amount??'—'}만원 / 조건반영 ${v.normalized??'보류'}${v.missing.length?` / 미확인 ${v.missing.join(', ')}`:''}`);const text=['인테리어 3견적 비교',...lines,'※ 조건반영 총액은 입력한 별도금액만 더한 단순 비교값이며 적정가격 판정이 아닙니다.'].join('\n');try{await navigator.clipboard.writeText(text);const b=qs(root,'[data-v8-copy]');if(b){const old=b.textContent;b.textContent='복사됨';setTimeout(()=>b.textContent=old,1200)}}catch{}});
  render();
}

function initUnitExplorer(root){
  const rows=qsa(root,'[data-v8-unit-row]'),search=qs(root,'[data-v8-unit-search]'),group=qs(root,'[data-v8-unit-group]'),unit=qs(root,'[data-v8-unit-unit]'),count=qs(root,'[data-v8-unit-count]'),compare=qs(root,'[data-v8-unit-compare]');
  const filter=()=>{const q=(search?.value||'').trim().toLowerCase(),g=group?.value||'',u=unit?.value||'';let n=0;rows.forEach(r=>{const text=(r.dataset.search||r.textContent).toLowerCase(),show=(!q||text.includes(q))&&(!g||r.dataset.group===g)&&(!u||r.dataset.unit===u);r.hidden=!show;if(show)n++});if(count)count.textContent=`${n}개 표시`;renderCompare()};
  const renderCompare=()=>{if(!compare)return;const picked=rows.filter(r=>qs(r,'[data-v8-unit-pick]')?.checked);if(!picked.length){compare.innerHTML='<p class="v8-footnote">비교할 항목을 선택하세요. 같은 단위끼리만 막대가 표시됩니다.</p>';return}const units=[...new Set(picked.map(r=>r.dataset.unit))];if(units.length>1){compare.innerHTML='<p class="v8-footnote">㎡, m, ㎥ 등 단위가 다른 공종은 막대로 직접 비교하지 않습니다.</p>';return}const values=picked.map(r=>num(r.dataset.price)||0),max=Math.max(...values,1);compare.innerHTML=picked.map((r,i)=>`<div class="v8-unit-bar"><span><code>${esc(r.dataset.code)}</code> ${esc(r.dataset.name)}</span><div class="v8-unit-bar-track"><div class="v8-unit-bar-fill" style="--w:${(values[i]/max*100).toFixed(1)}%"></div></div><strong>${Math.round(values[i]).toLocaleString('ko-KR')}원/${esc(r.dataset.unit)}</strong></div>`).join('')+'<p class="v8-footnote">막대는 선택한 동일 단위 항목 사이의 금액 크기만 표시합니다. 공종 정의·포함재료가 달라 적정가격 순위가 아닙니다.</p>'};
  [search,group,unit].filter(Boolean).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',filter));qsa(root,'[data-v8-unit-pick]').forEach(el=>el.addEventListener('change',renderCompare));filter();
}

document.querySelectorAll('[data-v8-triple]').forEach(initTriple);
document.querySelectorAll('[data-v8-unit-explorer]').forEach(initUnitExplorer);
})();

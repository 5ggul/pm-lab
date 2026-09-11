(() => {
  const BASE='/pm-lab/interior-cost-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const won=n=>`${Math.round(Number(n||0)).toLocaleString('ko-KR')}원`;
  const pct=n=>`${n>=0?'+':''}${Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
  let data=null;

  function item(root){const code=$('[data-v65-item]',root)?.value;return data?.items?.find(x=>x.code===code)||null}
  function calc(root){
    const row=item(root),amountMan=Number($('[data-v65-amount]',root)?.value||0),qty=Number($('[data-v65-qty]',root)?.value||0);
    const userUnit=qty>0?amountMan*10000/qty:0,ref=row?.price||0;
    const userEl=$('[data-v65-user-unit]',root),refEl=$('[data-v65-ref-unit]',root),delta=$('[data-v65-delta]',root),deltaNote=$('[data-v65-delta-note]',root),itemNote=$('[data-v65-item-note]',root);
    if(userEl)userEl.textContent=userUnit?`${won(userUnit)}/${row?.unit||''}`:'금액·수량 입력';
    if(refEl)refEl.textContent=row?`${won(ref)}/${row.unit}`:'—';
    if(itemNote&&row)itemNote.textContent=`${row.code} · ${row.spec} · ${row.exclude}`;
    const scopeOk=!!$('[data-v65-scope-match]',root)?.checked,excludeOk=!!$('[data-v65-exclude-match]',root)?.checked;
    if(!delta)return;
    if(!userUnit||!ref){delta.dataset.state='blocked';delta.textContent='입력 필요';if(deltaNote)deltaNote.textContent='견적금액과 수량을 입력하세요.';return}
    if(!scopeOk||!excludeOk){delta.dataset.state='blocked';delta.textContent='조건 미확인';if(deltaNote)deltaNote.textContent='공정범위와 제외조건을 모두 확인해야 차이율을 표시합니다.';return}
    const d=(userUnit/ref-1)*100;delta.dataset.state='ready';delta.textContent=pct(d);if(deltaNote)deltaNote.textContent=`공공 참고단가 대비 단순 차이율 · 비율 ${(userUnit/ref).toFixed(2)}× · 적정가 판정 아님`;
  }
  function initRoot(root){
    const select=$('[data-v65-item]',root);if(!select||!data)return;
    select.innerHTML='';data.items.forEach(x=>{const o=document.createElement('option');o.value=x.code;o.textContent=`${x.group} · ${x.name} · ${won(x.price)}/${x.unit}`;select.append(o)});
    const ref=new URLSearchParams(location.search).get('ref');if(ref&&data.items.some(x=>x.code===ref))select.value=ref;
    $$('select,input',root).forEach(el=>{el.addEventListener('input',()=>calc(root));el.addEventListener('change',()=>calc(root))});calc(root);
  }
  async function init(){const roots=$$('[data-v65-normalizer]');if(!roots.length)return;try{data=await fetch(`${BASE}/data/public-unit-cost-2026-h2.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()})}catch{return}roots.forEach(initRoot)}
  init();
})();

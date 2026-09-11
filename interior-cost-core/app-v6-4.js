(() => {
  const BASE='/pm-lab/interior-cost-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const won=n=>`${Math.round(Number(n||0)).toLocaleString('ko-KR')}원`;
  const manwon=n=>`${(Number(n||0)/10000).toLocaleString('ko-KR',{maximumFractionDigits:2})}만원`;
  const STORE='interior-public-reference-v64';
  let payload=null;

  const readSaved=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}};
  const writeSaved=v=>{try{localStorage.setItem(STORE,JSON.stringify(v))}catch{}};
  const escapeText=v=>String(v??'');

  function currentItem(root){
    const code=$('[data-v64-item]',root)?.value;
    return payload?.items?.find(x=>x.code===code)||null;
  }
  function calculate(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));
    const unitPrice=$('[data-v64-unit-price]',root),unit=$('[data-v64-unit]',root),result=$('[data-v64-result]',root),resultWon=$('[data-v64-result-won]',root);
    const code=$('[data-v64-code]',root),spec=$('[data-v64-spec]',root),scope=$('[data-v64-scope]',root),exclude=$('[data-v64-exclude]',root),labor=$('[data-v64-labor]',root),source=$('[data-v64-source]',root);
    if(!item)return;
    if(unitPrice)unitPrice.value=won(item.price);
    if(unit)unit.textContent=item.unit;
    if(code)code.textContent=item.code;
    if(spec)spec.textContent=item.spec;
    if(scope)scope.textContent=item.scope;
    if(exclude)exclude.textContent=item.exclude;
    if(labor)labor.textContent=`${item.labor}%`;
    if(source)source.href=item.detail;
    const total=item.price*qty;
    if(result)result.textContent=qty?manwon(total):'수량 입력';
    if(resultWon)resultWon.textContent=qty?won(total):'공공 기준 단가 × 수량';
    root.dataset.currentTotal=String(total);
  }
  function renderSaved(root){
    const host=$('[data-v64-saved-list]',root),totalEl=$('[data-v64-saved-total]',root);
    if(!host||!totalEl)return;
    const rows=readSaved(),total=rows.reduce((a,x)=>a+Number(x.total||0),0);
    host.innerHTML='';
    if(!rows.length){const p=document.createElement('p');p.className='v64-ref-inline';p.textContent='저장한 참고 계산이 없습니다. 참고합계는 위 예산 합계와 자동으로 섞이지 않습니다.';host.append(p)}
    rows.forEach((row,i)=>{
      const el=document.createElement('div');el.className='v64-ref-saved-row';
      const label=document.createElement('div');const strong=document.createElement('strong');strong.textContent=row.name;const meta=document.createElement('div');meta.className='v64-ref-code';meta.textContent=`${row.code} · ${row.qty}${row.unit}`;label.append(strong,meta);
      const amount=document.createElement('span');amount.textContent=manwon(row.total);
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.addEventListener('click',()=>{const next=readSaved();next.splice(i,1);writeSaved(next);$$('[data-v64-unit-ref]').forEach(renderSaved)});
      el.append(label,amount,remove);host.append(el);
    });
    totalEl.textContent=manwon(total);
  }
  function addSaved(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));if(!item||!qty)return;
    const rows=readSaved();rows.push({code:item.code,name:item.name,qty,unit:item.unit,price:item.price,total:item.price*qty,exclude:item.exclude});writeSaved(rows);$$('[data-v64-unit-ref]').forEach(renderSaved);
  }
  async function copyCurrent(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));if(!item||!qty)return;
    const total=item.price*qty;
    const text=[`[공공 공종 참고계산] ${item.name}`,`코드 ${item.code} / ${item.spec}`,`기준단가 ${won(item.price)}/${item.unit} × ${qty}${item.unit} = ${won(total)} (${manwon(total)})`,`조건: ${item.exclude}`,'주의: 공공 건설 예정가격 참고단가이며 민간 인테리어 시장평균이 아님.'].join('\n');
    try{await navigator.clipboard.writeText(text);const btn=$('[data-v64-copy]',root);if(btn){const before=btn.textContent;btn.textContent='복사됨';setTimeout(()=>btn.textContent=before,1000)}}catch{}
  }
  function initRoot(root){
    const select=$('[data-v64-item]',root);if(!select||!payload)return;
    select.innerHTML='';payload.items.forEach(item=>{const o=document.createElement('option');o.value=item.code;o.textContent=`${item.group} · ${item.name} · ${won(item.price)}/${item.unit}`;select.append(o)});
    const qp=new URLSearchParams(location.search).get('ref');if(qp&&payload.items.some(x=>x.code===qp))select.value=qp;
    select.addEventListener('change',()=>calculate(root));$('[data-v64-qty]',root)?.addEventListener('input',()=>calculate(root));
    $('[data-v64-add]',root)?.addEventListener('click',()=>addSaved(root));$('[data-v64-copy]',root)?.addEventListener('click',()=>copyCurrent(root));
    calculate(root);renderSaved(root);
  }
  async function init(){
    const roots=$$('[data-v64-unit-ref]');if(!roots.length)return;
    try{payload=await fetch(`${BASE}/data/public-unit-cost-2026-h2.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()})}catch{return}
    roots.forEach(initRoot);
  }
  init();
})();

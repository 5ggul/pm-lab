const money=v=>Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('ko-KR')+'원':'—';
const text=v=>String(v??'').trim();
const norm=v=>text(v).toLowerCase().replace(/\s+/g,'');
export function filterRows(rows,term,limit=100,filters={}){
  const q=norm(term),division=text(filters.division),priceType=text(filters.priceType);
  return rows.filter(r=>{
    const hay=norm([r.name,r.spec,r.work_code,r.application_condition,r.unit].join(' ')),condition=text(r.application_condition);
    if(q&&!hay.includes(q))return false;
    if(division&&division!=='전체'&&!condition.includes(division))return false;
    if(priceType&&priceType!=='전체'&&!condition.includes(priceType))return false;
    return true;
  }).slice(0,limit);
}
export function referenceDelta(reference,my){
  if(my===null||my===undefined||String(my).trim()==='')return null;
  const a=Number(reference),b=Number(my);if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<0)return null;return b-a;
}
export function calculatedAmount(unit,qty){
  if(qty===null||qty===undefined||String(qty).trim()==='')return null;
  const a=Number(unit),b=Number(qty);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0)return null;return a*b;
}

if(typeof document!=='undefined'){
  const $=(s,r=document)=>r.querySelector(s),root=new URL('../',import.meta.url);let dataset={rows:[],status:'source_not_collected'},selected=null;
  const set=(s,v)=>{const e=$(s);if(e)e.textContent=v};
  function td(value){const e=document.createElement('td');e.textContent=value;return e}
  function detail(row){
    selected=row;$('[data-reference-detail]').hidden=false;set('[data-detail-name]',row.name||'—');set('[data-detail-code]',row.work_code||'—');set('[data-detail-spec]',row.spec||'—');set('[data-detail-unit]',row.unit||'—');set('[data-detail-date]',row.published_date||'—');set('[data-detail-material]',money(row.material_cost_won));set('[data-detail-labor]',money(row.labor_cost_won));set('[data-detail-expense]',money(row.expense_cost_won));set('[data-detail-total]',money(row.total_cost_won));set('[data-detail-condition]',row.application_condition||'적용조건 미기재');calc();$('[data-reference-detail]').scrollIntoView({block:'start'});
  }
  function renderRows(rows){
    const body=$('[data-reference-table]');if(!body)return;body.replaceChildren();
    if(!rows.length){const tr=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=9;cell.className='reference-no-result';cell.textContent='현재 조건과 일치하는 공공 참고단가가 없습니다.';tr.append(cell);body.append(tr)}
    for(const row of rows){const tr=document.createElement('tr');tr.append(td(row.published_date||'—'),td(row.work_code||'—'));const n=td(row.name||'—');if(row.spec){const sp=document.createElement('span');sp.textContent=row.spec;n.append(sp)}tr.append(n,td(row.unit||'—'),td(money(row.material_cost_won)),td(money(row.labor_cost_won)),td(money(row.expense_cost_won)),td(money(row.total_cost_won)));const action=document.createElement('td'),btn=document.createElement('button');btn.type='button';btn.textContent='선택';btn.addEventListener('click',()=>detail(row));action.append(btn);tr.append(action);body.append(tr)}
    set('[data-reference-match-count]',rows.length.toLocaleString('ko-KR'));
  }
  function readFilters(){const division=$('[data-reference-division]')?.value||'전체',priceType=$('[data-reference-type]')?.value||'전체';return{division:division==='전체'?'':division,priceType:priceType==='전체'?'':priceType}}
  function search(){
    const q=$('[data-reference-query]')?.value||'',filters=readFilters(),rows=filterRows(dataset.rows||[],q,100,filters);renderRows(rows);
    const u=new URL(location.href);q?u.searchParams.set('q',q):u.searchParams.delete('q');filters.division?u.searchParams.set('division',filters.division):u.searchParams.delete('division');filters.priceType?u.searchParams.set('type',filters.priceType):u.searchParams.delete('type');history.replaceState(null,'',u);
    const parts=[q?`검색 ${q}`:'전체 품명',filters.division||'전체 공사',filters.priceType||'전체 단가'].filter(Boolean);set('[data-reference-filter-summary]',parts.join(' · '));
  }
  function calc(){
    if(!selected)return;const qty=$('[data-reference-qty]')?.value,my=$('[data-reference-my-unit]')?.value,total=calculatedAmount(selected.total_cost_won,qty),delta=referenceDelta(selected.total_cost_won,my);set('[data-reference-calc-total]',total===null?'—':money(total));set('[data-reference-delta]',delta===null?'—':`${delta>=0?'+':''}${Math.round(delta).toLocaleString('ko-KR')}원`)
  }
  function restoreSearchParams(){const u=new URL(location.href),q=u.searchParams.get('q')||'',division=u.searchParams.get('division')||'',priceType=u.searchParams.get('type')||'';if(q&&$('[data-reference-query]'))$('[data-reference-query]').value=q;const d=$('[data-reference-division]'),t=$('[data-reference-type]');if(d&&[...d.options].some(o=>o.value===division))d.value=division;if(t&&[...t.options].some(o=>o.value===priceType))t.value=priceType}
  async function load(){
    try{const r=await fetch(new URL('data/public-unit-prices.json',root),{cache:'no-store'});if(r.ok)dataset=await r.json()}catch{}
    const ready=dataset.status==='ready'&&Array.isArray(dataset.rows)&&dataset.rows.length>0,sourceCount=Number(dataset.source?.source_row_count);$('[data-reference-empty]').hidden=ready;$('[data-reference-content]').hidden=!ready;set('[data-reference-state]',ready?'수집 완료':'수집 전');set('[data-reference-count]',ready?dataset.rows.length.toLocaleString('ko-KR'):'0');set('[data-reference-source-count]',Number.isFinite(sourceCount)&&sourceCount>0?sourceCount.toLocaleString('ko-KR'):'—');set('[data-reference-date]',dataset.source?.latest_published_date||'—');restoreSearchParams();if(ready)search()
  }
  $('[data-reference-search]')?.addEventListener('click',search);$('[data-reference-query]')?.addEventListener('keydown',e=>{if(e.key==='Enter')search()});$('[data-reference-division]')?.addEventListener('change',search);$('[data-reference-type]')?.addEventListener('change',search);document.querySelectorAll('[data-reference-term]').forEach(b=>b.addEventListener('click',()=>{const q=b.dataset.referenceTerm;$('[data-reference-query]').value=q;search()}));$('[data-reference-qty]')?.addEventListener('input',calc);$('[data-reference-my-unit]')?.addEventListener('input',calc);load();
}

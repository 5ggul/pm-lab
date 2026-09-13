(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const batchKey='interior-v11-intake-batch';
  const fields=['sample_id','quote_month','region_level1','supply_pyeong','exclusive_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon'];
  const numeric=new Set(['supply_pyeong','exclusive_pyeong','bathroom_count','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon']);
  const required=new Set(['sample_id','quote_month','region_level1','supply_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon']);
  const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
  const loadBatch=()=>{try{return JSON.parse(localStorage.getItem(batchKey)||'[]')}catch{return []}};
  const saveBatch=rows=>localStorage.setItem(batchKey,JSON.stringify(rows));
  const id=()=>`Q${new Date().toISOString().slice(2,10).replaceAll('-','')}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  function collect(root){
    const row={},errors=[];
    for(const f of fields){const el=$(`[data-v11-field="${CSS.escape(f)}"]`,root);if(!el)continue;let v=String(el.value??'').trim();if(v===''&&!required.has(f)){row[f]='';continue}if(v===''&&required.has(f)){errors.push(`${f}: 필수`);continue}if(numeric.has(f)){const n=Number(v);if(!Number.isFinite(n)){errors.push(`${f}: 숫자`);continue}v=n}row[f]=v}
    if(row.sample_id&&!/^[A-Za-z0-9_-]{3,40}$/.test(row.sample_id))errors.push('sample_id: 영문·숫자·_·- 3~40자');
    if(row.quote_month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.quote_month))errors.push('quote_month: YYYY-MM');
    if(Number(row.supply_pyeong)<5||Number(row.supply_pyeong)>100)errors.push('supply_pyeong: 5~100');
    if(Number(row.total_amount_manwon)<=0)errors.push('total_amount_manwon: 0보다 커야 함');
    if(Number(row.bathroom_count)<0||Number(row.bathroom_count)>5||!Number.isInteger(Number(row.bathroom_count)))errors.push('bathroom_count: 0~5 정수');
    return {row,errors};
  }
  function renderBatch(root){
    const rows=loadBatch(),box=$('[data-v11-batch-list]',root),count=$('[data-v11-batch-count]',root);if(count)count.textContent=`${rows.length}건`;
    if(box)box.innerHTML=rows.length?rows.map((r,i)=>`<div class="v11-batch-row"><div><strong>${esc(r.sample_id)} · ${esc(r.region_level1)} · ${esc(r.supply_pyeong)}평</strong><span>${esc(r.quote_month)} · ${esc(r.scope)} · ${Number(r.total_amount_manwon).toLocaleString('ko-KR')}만원</span></div><button type="button" data-v11-remove="${i}">삭제</button></div>`).join(''):'<p>브라우저에 저장된 익명 견적 행이 없습니다.</p>';
    $$('[data-v11-remove]',box||root).forEach(btn=>btn.addEventListener('click',()=>{const a=loadBatch();a.splice(Number(btn.dataset.v11Remove),1);saveBatch(a);renderBatch(root)}));
    const exp=$('[data-v11-export-csv]',root),clear=$('[data-v11-clear-batch]',root);if(exp)exp.disabled=!rows.length;if(clear)clear.disabled=!rows.length;
  }
  function exportCsv(root){const rows=loadBatch();if(!rows.length)return;const text=[fields.join(','),...rows.map(r=>fields.map(f=>csvCell(r[f]??'')).join(','))].join('\n');const blob=new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='anonymous-interior-quotes.csv';a.click();URL.revokeObjectURL(a.href)}
  function initIntake(){
    $$('[data-v11-intake]').forEach(root=>{
      const sample=$('[data-v11-field="sample_id"]',root),month=$('[data-v11-field="quote_month"]',root),msg=$('[data-v11-message]',root);if(sample&&!sample.value)sample.value=id();if(month&&!month.value)month.value=new Date().toISOString().slice(0,7);
      $('[data-v11-new-id]',root)?.addEventListener('click',()=>{if(sample)sample.value=id()});
      $('[data-v11-add-row]',root)?.addEventListener('click',()=>{const {row,errors}=collect(root);if(errors.length){if(msg){msg.className='v11-message error';msg.textContent=errors.join(' · ')}return}const rows=loadBatch();if(rows.some(x=>x.sample_id===row.sample_id)){if(msg){msg.className='v11-message error';msg.textContent='같은 sample_id가 이미 있습니다.'}return}rows.push(row);saveBatch(rows);if(msg){msg.className='v11-message ok';msg.textContent='익명 견적 1건을 이 브라우저에 저장했습니다.'}if(sample)sample.value=id();renderBatch(root)});
      $('[data-v11-export-csv]',root)?.addEventListener('click',()=>exportCsv(root));
      $('[data-v11-clear-batch]',root)?.addEventListener('click',()=>{if(confirm('브라우저에 저장한 익명 견적 행을 모두 지울까요?')){saveBatch([]);renderBatch(root)}});
      $('[data-v11-load-example]',root)?.addEventListener('click',()=>{const vals={region_level1:'서울',supply_pyeong:'32',exclusive_pyeong:'25.7',building_type:'아파트',scope:'올수리',bathroom_count:'2',window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:'4500',demolition_manwon:'350',waste_manwon:'80',bathroom_manwon:'850',kitchen_manwon:'700',wallpaper_manwon:'300',flooring_manwon:'400',electrical_manwon:'180'};for(const [k,v] of Object.entries(vals)){const el=$(`[data-v11-field="${CSS.escape(k)}"]`,root);if(el)el.value=v}});
      renderBatch(root);
    });
  }
  function initCoverage(){
    $$('[data-v11-coverage]').forEach(root=>{const sel=$('[data-v11-region-filter]',root);sel?.addEventListener('change',()=>{const v=sel.value;$$('[data-v11-coverage-row]',root).forEach(row=>row.hidden=!!v&&row.dataset.region!==v)})});
  }
  function initCopy(){
    $$('[data-v11-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const text=btn.dataset.v11Copy||'';try{await navigator.clipboard.writeText(text);const old=btn.textContent;btn.textContent='복사됨';setTimeout(()=>btn.textContent=old,1200)}catch{}}));
  }
  document.addEventListener('DOMContentLoaded',()=>{initIntake();initCoverage();initCopy()});
})();

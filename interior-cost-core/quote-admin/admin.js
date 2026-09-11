(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const state={base:'',token:'',items:[],selected:null,nextBefore:null};
  const money=n=>Number(n||0).toLocaleString('ko-KR')+'만원';
  const statusLabel={pending:'대기',approved:'승인',rejected:'제외',duplicate:'중복',outlier_hold:'이상치 보류'};
  const itemStatus={included:'포함',separate:'별도',missing:'미기재',unknown:'미확인'};
  const detailLabel={detailed:'상세',one_set:'1식',unknown:'미확인'};

  function el(tag,text='',className=''){
    const node=document.createElement(tag);
    if(text!==undefined&&text!==null)node.textContent=String(text);
    if(className)node.className=className;
    return node;
  }
  function setStatus(text,bad=false){const n=$('[data-connect-status]');if(n){n.textContent=text;n.style.color=bad?'#a52b20':''}}
  function normalizeBase(raw){const u=new URL(raw);if(u.protocol!=='https:')throw new Error('Worker URL은 https만 허용합니다.');return u.href.replace(/\/$/,'')}
  async function api(path,options={}){
    if(!state.base||!state.token)throw new Error('먼저 연결하세요.');
    const headers=new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+state.token);
    if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
    const response=await fetch(state.base+path,{...options,headers,cache:'no-store',credentials:'omit'});
    let body={};try{body=await response.json()}catch{}
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  async function connect(){
    try{
      state.base=normalizeBase($('[data-api-base]').value.trim());
      state.token=$('[data-admin-token]').value;
      if(state.token.length<16)throw new Error('관리자 토큰을 입력하세요.');
      setStatus('연결 확인 중');
      await refreshAll();
      $('[data-admin-token]').value='';
      setStatus('연결됨 · 토큰은 현재 탭 메모리에만 유지');
    }catch(err){state.token='';setStatus(err.message||'연결 실패',true)}
  }
  async function refreshAll(){await Promise.all([loadSummary(),loadQueue(true)])}
  async function loadSummary(){
    const data=await api('/admin/v1/summary');
    const counts=Object.fromEntries((data.counts||[]).map(x=>[x.reviewer_status,Number(x.count||0)]));
    $$('[data-count]').forEach(n=>n.textContent=(counts[n.dataset.count]||0).toLocaleString('ko-KR'));
    renderSegments(data.segments||[],Number(data.minimum_public_sample||80));
  }
  async function loadQueue(reset=false){
    const status=$('[data-status-filter]').value;
    const query=new URLSearchParams({status,limit:'50'});
    if(!reset&&state.nextBefore)query.set('before',state.nextBefore);
    const data=await api('/admin/v1/quotes?'+query.toString());
    state.items=reset?(data.items||[]):state.items.concat(data.items||[]);
    state.nextBefore=data.next_before||null;
    renderQueue();
    $('[data-more]').hidden=!state.nextBefore||!(data.items||[]).length;
  }
  function renderQueue(){
    const host=$('[data-queue-list]');host.replaceChildren();
    if(!state.items.length){host.append(el('p','표본이 없습니다.','empty'));return}
    for(const row of state.items){
      const btn=el('button','', 'queue-item'+(state.selected?.submission_id===row.submission_id?' active':''));
      btn.type='button';
      const top=el('div','', 'queue-item-top');top.append(el('strong',row.submission_id),el('em',row.quality_grade||'—'));
      btn.append(top,el('p',`${row.region_level1} · ${row.pyeong_band} · ${row.scope} · ${money(row.total_amount_manwon)}`),el('p',`${statusLabel[row.reviewer_status]||row.reviewer_status} · ${row.received_at||'—'}`));
      btn.addEventListener('click',()=>selectRow(row));host.append(btn);
    }
  }
  function fact(dt,dd){const wrap=el('div');wrap.append(el('dt',dt),el('dd',dd));return wrap}
  function selectRow(row){
    state.selected=row;renderQueue();$('[data-detail-empty]').hidden=true;$('[data-detail]').hidden=false;
    $('[data-detail-id]').textContent=row.submission_id;$('[data-detail-grade]').textContent='GRADE '+(row.quality_grade||'—');
    const facts=$('[data-facts]');facts.replaceChildren(
      fact('견적월',row.quote_month),fact('지역',row.region_level1),fact('평수',row.pyeong_band),fact('연식',row.building_age_band),
      fact('범위',row.scope),fact('욕실',row.bathroom_count),fact('샷시',row.window_status),fact('총액',money(row.total_amount_manwon)),
      fact('VAT',row.vat_status),fact('폐기물',row.waste_status),fact('수집일',row.received_at),fact('현재 상태',statusLabel[row.reviewer_status]||row.reviewer_status)
    );
    const flags=$('[data-quality-flags]');flags.replaceChildren();const all=[...(row.quality_flags||[]),...(row.review_flags||[])];
    if(!all.length)flags.append(el('span','없음','flag'));else all.forEach(x=>flags.append(el('span',x,'flag')));
    const body=$('[data-work-items]');body.replaceChildren();
    for(const [name,item] of Object.entries(row.work_items||{})){
      const tr=el('tr');tr.append(el('th',name),el('td',itemStatus[item.status]||item.status),el('td',item.amount_manwon==null?'—':money(item.amount_manwon)),el('td',detailLabel[item.detail_level]||item.detail_level));body.append(tr);
    }
    $('[data-review-status]').value=row.reviewer_status==='pending'?'approved':row.reviewer_status;
    $('[data-review-reason]').value=row.reviewer_note_code||'ok';
    $('[data-duplicate-of]').value=row.duplicate_of||'';
    toggleDuplicate();$('[data-review-status-text]').textContent=row.reviewed_at?`마지막 처리 ${row.reviewed_at}`:'';
  }
  function toggleDuplicate(){const duplicate=$('[data-review-status]').value==='duplicate';$('[data-duplicate-wrap]').hidden=!duplicate;if(!duplicate)$('[data-duplicate-of]').value=''}
  async function saveReview(){
    if(!state.selected)return;
    const button=$('[data-save-review]');button.disabled=true;$('[data-review-status-text]').textContent='저장 중';
    try{
      const status=$('[data-review-status]').value,reason_code=$('[data-review-reason]').value,duplicate_of=status==='duplicate'?$('[data-duplicate-of]').value.trim():null;
      const data=await api(`/admin/v1/quotes/${encodeURIComponent(state.selected.submission_id)}/review`,{method:'POST',body:JSON.stringify({status,reason_code,duplicate_of})});
      $('[data-review-status-text]').textContent=`저장됨 · ${statusLabel[data.reviewer_status]||data.reviewer_status}`;
      state.selected=null;await refreshAll();$('[data-detail]').hidden=true;$('[data-detail-empty]').hidden=false;
    }catch(err){$('[data-review-status-text]').textContent=err.message||'저장 실패'}finally{button.disabled=false}
  }
  function renderSegments(rows,threshold){
    const body=$('[data-segments]');body.replaceChildren();
    if(!rows.length){const tr=el('tr');const td=el('td','승인 후보 세그먼트 없음');td.colSpan=8;tr.append(td);body.append(tr);return}
    for(const r of rows){const tr=el('tr');const count=Number(r.approved_count||0);const c=el('td',count.toLocaleString('ko-KR'),count>=threshold?'segment-ready':'segment-wait');tr.append(el('td',r.region_level1),el('td',r.pyeong_band),el('td',r.scope),el('td',r.bathroom_count),el('td',r.window_status),el('td',r.vat_status),el('td',r.waste_status),c);body.append(tr)}
  }
  $('[data-connect-btn]').addEventListener('click',connect);
  $('[data-refresh]').addEventListener('click',()=>refreshAll().catch(e=>setStatus(e.message,true)));
  $('[data-status-filter]').addEventListener('change',()=>{state.selected=null;loadQueue(true).catch(e=>setStatus(e.message,true))});
  $('[data-more]').addEventListener('click',()=>loadQueue(false).catch(e=>setStatus(e.message,true)));
  $('[data-review-status]').addEventListener('change',toggleDuplicate);
  $('[data-save-review]').addEventListener('click',saveReview);
  window.addEventListener('beforeunload',()=>{state.token='';state.items=[];state.selected=null});
})();

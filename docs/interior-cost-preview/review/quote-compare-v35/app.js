(() => {
  'use strict';
  const ITEMS=[['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']];
  const LABELS={missing:'미확인',included:'본견적 기재',separate:'별도 금액',bundled:'다른 항목에 포함',excluded:'공사·금액 없음'};
  const HINTS=['철거 범위 · 바탕 보수','반출 · 처리 · 양중','욕실에 포함된 방수 금액은 중복 입력하지 않습니다.','개수 · 타일 · 도기 · 수전','가구 길이 · 상판 · 설비 이동','벽·천장 면적 · 벽지 · 바탕','시공 면적 · 자재 · 철거','가벽 · 천장 · 몰딩 · 문틀','회로 · 콘센트 · 조명','창 개수 · 규격 · 유리 · 양중','보양 · 운반 · 관리 범위','공종별 금액에 이미 포함됐다면 ‘다른 항목에 포함’을 선택합니다.'];
  document.getElementById('trade-rows').innerHTML=ITEMS.map(([k,n],i)=>`<section class="trade-row" data-row="${k}" aria-labelledby="label-${k}"><div class="trade-label"><h3 id="label-${k}">${n}</h3><p>${HINTS[i]}</p><span class="row-flag" data-flag="${k}"></span></div>${['a','b','c'].map(v=>`<fieldset class="vendor-cell" data-vendor="${v}"><legend>${v.toUpperCase()} 업체 · ${n}</legend><label for="${k}-${v}-state" class="sr-only">${v.toUpperCase()} ${n} 포함조건</label><select id="${k}-${v}-state" data-item="${k}" data-vendor="${v}" data-field="state">${Object.entries(LABELS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select><label for="${k}-${v}-amount" class="sr-only">${v.toUpperCase()} ${n} 금액, 만원</label><div class="money-input"><input id="${k}-${v}-amount" data-item="${k}" data-vendor="${v}" data-field="amount" type="text" inputmode="decimal" maxlength="16" autocomplete="off" placeholder="금액 미입력" aria-describedby="${k}-${v}-note"><span>만원</span></div><small id="${k}-${v}-note" data-note="${k}-${v}"></small></fieldset>`).join('')}</section>`).join('');
  const KEY='interior-compare-v35';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const fmtWon=w=>(w/10000).toLocaleString('ko-KR',{maximumFractionDigits:4});
  function parseAmount(value){
    const raw=String(value??'').trim();
    if(raw==='')return {kind:'blank',won:null};
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?$/.test(raw))return {kind:'invalid',won:null};
    const [whole,fraction='']=raw.replaceAll(',','').split('.');
    const won=Number(whole)*10000+Number(fraction.padEnd(4,'0'));
    return Number.isSafeInteger(won)&&won>=0&&won<=99999999999?{kind:'valid',won}:{kind:'invalid',won:null};
  }
  function emptyState(){return {version:35,count:2,mobile:'a',sameScope:false,items:Object.fromEntries(ITEMS.map(([k])=>[k,Object.fromEntries(['a','b','c'].map(v=>[v,{state:'missing',amount:''}]))]))};}
  function normalize(raw){
    if(!raw||raw.version!==35||!raw.items||typeof raw.items!=='object')throw new Error('지원하지 않는 저장 형식');
    const d=emptyState();d.count=raw.count===3?3:2;d.mobile=['a','b','c'].includes(raw.mobile)?raw.mobile:'a';if(d.count===2&&d.mobile==='c')d.mobile='a';
    // A reload never silently confirms scope on behalf of the user.
    for(const [k]of ITEMS)for(const v of ['a','b','c']){const x=raw.items[k]?.[v];if(x){d.items[k][v]={state:Object.hasOwn(LABELS,x.state)?x.state:'missing',amount:typeof x.amount==='string'?x.amount.slice(0,16):''};}}
    return d;
  }
  function calculate(d){
    const vendors=['a','b','c'].slice(0,d.count),totals={},rowStatus={},questions=[];
    for(const v of vendors){
      const t={base:0,extra:0,total:0,known:0,pending:0,invalid:0,unclassified:0,touched:false};
      for(const [k,label]of ITEMS){
        const x=d.items[k][v],p=parseAmount(x.amount),counted=['included','separate'].includes(x.state),ignored=['bundled','excluded'].includes(x.state);
        t.touched ||= x.state!=='missing'||x.amount.trim()!=='';
        if(counted&&p.kind==='valid'){t[x.state==='included'?'base':'extra']+=p.won;t.known++;}
        if(x.state==='missing'){t.pending++;if(p.kind==='valid')t.unclassified+=p.won;questions.push([v,`${label}: 포함 여부와 기재 금액을 확인해 주세요.`]);}
        else if(counted&&p.kind!=='valid'){t.pending++;questions.push([v,`${label}: ${p.kind==='invalid'?'금액 표기를 수정':'금액을 확인'}해 주세요. 빈칸은 0원이 아닙니다.`]);}
        if(!ignored&&p.kind==='invalid')t.invalid++;
      }
      t.total=t.base+t.extra;totals[v]=t;
    }
    for(const [k,label]of ITEMS){
      const xs=vendors.map(v=>d.items[k][v]);const different=new Set(xs.map(x=>x.state)).size>1;
      const unresolved=xs.some(x=>x.state==='missing'||(['included','separate'].includes(x.state)&&parseAmount(x.amount).kind!=='valid'));
      rowStatus[k]={different,unresolved,entered:xs.some(x=>x.amount.trim()!=='')};
      if(different)questions.push(['all',`${label}: 업체별 포함조건이 다릅니다. 공사 범위와 별도 금액을 같은 기준으로 맞춰 주세요.`]);
    }
    const pending=vendors.reduce((n,v)=>n+totals[v].pending,0),different=Object.values(rowStatus).filter(x=>x.different).length;
    const ready=!pending&&!different&&vendors.every(v=>totals[v].known>0)&&d.sameScope;
    return {vendors,totals,rowStatus,questions,pending,different,ready};
  }
  // Small, deterministic API for regression tests; no network or personal information.
  window.QuoteCompare35={parseAmount,emptyState,normalize,calculate};
  let state=emptyState(),lastSaved=null,storageAvailable=true,storageConflict=false,filter='all',toastTimer;
  function message(text){const el=$('#toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,3000);}
  function warn(text){$('#error-note').textContent=text;$('#error-note').hidden=false;}
  function readSaved(){
    try{const raw=localStorage.getItem(KEY);if(raw){const payload=JSON.parse(raw);state=normalize(payload.data);lastSaved=payload.savedAt||null;}}
    catch(e){storageAvailable=false;warn('저장값을 읽지 못했습니다. 기존 저장값은 변경하지 않았습니다. 이번 입력은 CSV로 보관해 주세요.');}
  }
  function syncInputs(){
    for(const el of $$('[data-field]'))el.value=state.items[el.dataset.item][el.dataset.vendor][el.dataset.field];
    $('#same-scope').checked=state.sameScope;
  }
  function setViewport(){
    document.body.dataset.count=String(state.count);document.body.dataset.mobile=state.mobile;
    document.documentElement.style.setProperty('--vendors',state.count);
    for(const b of $$('button[data-count]'))b.setAttribute('aria-pressed',String(Number(b.dataset.count)===state.count));
    for(const b of $$('button[data-mobile]'))b.setAttribute('aria-pressed',String(b.dataset.mobile===state.mobile));
  }
  function summarize(m){
    $('#summary').innerHTML=m.vendors.map(v=>{const t=m.totals[v];return `<article class="summary-item"><div class="summary-label"><b>${v.toUpperCase()} 업체</b><span>확인된 입력합계${t.pending?' · 부분':''}</span></div><strong class="total">${t.known?`${fmtWon(t.total)}<small>만원</small>`:(t.touched?'확인 필요':'입력 전')}</strong><div class="breakdown"><span>본견적 ${t.known?fmtWon(t.base)+'만원':'—'}</span><span>별도 ${t.known?fmtWon(t.extra)+'만원':'—'}</span></div><p class="pending">${t.pending?`확인 필요 ${t.pending}개`:'항목 확인 완료'}${t.unclassified?` · 미확인 금액 ${fmtWon(t.unclassified)}만원 제외`:''}</p></article>`;}).join('');
    const box=$('#comparison');box.dataset.ready=String(m.ready);
    if(m.ready){const a=m.totals.a.total;box.innerHTML='<strong>같은 조건의 입력 금액 차이</strong>'+m.vendors.slice(1).map(v=>{const d=m.totals[v].total-a,p=a>0?` (${d>=0?'+':''}${(d/a*100).toFixed(1)}%)`:'';return `<span class="delta">${v.toUpperCase()} − A &nbsp; ${d>0?'+':''}${fmtWon(d)}만원${p}</span>`;}).join('')+'<p>입력값의 산술 차이입니다. 업체 순위나 적정가격 판정이 아닙니다.</p>';}
    else {const reasons=[];if(m.pending)reasons.push(`미확인 항목·금액 ${m.pending}개`);if(m.different)reasons.push(`조건 차이 ${m.different}개`);if(!m.vendors.every(v=>m.totals[v].known>0))reasons.push('업체별 금액 입력 필요');if(!state.sameScope)reasons.push('공사 범위·수량·사양 확인 필요');box.innerHTML='<strong>업체 간 금액 차이 확인 전</strong><p>'+reasons.join(' · ')+'</p>';}
  }
  function renderRows(m){
    let visible=0;
    for(const [k]of ITEMS){const s=m.rowStatus[k],show=filter==='all'||(filter==='unresolved'&&s.unresolved)||(filter==='different'&&s.different)||(filter==='entered'&&s.entered);$(`[data-row="${k}"]`).hidden=!show;visible+=Number(show);$(`[data-flag="${k}"]`).textContent=s.different?'조건 차이':(s.unresolved?'확인 필요':'');
      for(const v of ['a','b','c']){const x=state.items[k][v],p=parseAmount(x.amount),el=$(`#${k}-${v}-amount`),note=$(`[data-note="${k}-${v}"]`),ignored=['bundled','excluded'].includes(x.state);el.disabled=ignored;const invalid=p.kind==='invalid'&&!ignored;el.setAttribute('aria-invalid',String(invalid));note.classList.toggle('error',invalid);note.textContent=ignored?'합계 제외 · 기입한 금액은 기록만 보관':invalid?'0 이상 숫자, 쉼표 구분, 소수점 4자리까지':x.state==='missing'?'조건 확인 전 · 금액을 합산하지 않습니다.':p.kind==='blank'?'금액 미확인 · 빈칸은 0원이 아닙니다.':p.won===0?'0원으로 확인한 항목':x.state==='separate'?'별도 기재 금액으로 합산':'본견적 기재 금액으로 합산';}
    }
    $('#filter-empty').hidden=visible>0;
  }
  function renderBars(m){
    const max=Math.max(...m.vendors.map(v=>m.totals[v].total),1);
    $('#bars').innerHTML=m.vendors.map(v=>{const t=m.totals[v],label=t.known?`${fmtWon(t.total)}만원${t.pending?' · 부분합계':''}`:'확인된 금액 없음';return `<div class="bar-row"><span class="bar-label">${v.toUpperCase()}</span><div class="track" role="img" aria-label="${v.toUpperCase()} 업체 본견적 ${fmtWon(t.base)}만원, 별도 ${fmtWon(t.extra)}만원, 미확인 ${t.pending}개"><span class="base" style="width:${t.base/max*100}%"></span><span class="extra" style="width:${t.extra/max*100}%"></span></div><span class="bar-value">${label}</span></div>`;}).join('');
  }
  function renderQuestions(m){
    $('#question-count').textContent=`${m.questions.length}개`;
    // Text nodes, not user-controlled HTML.
    const host=$('#questions');host.replaceChildren();
    if(!m.questions.length){const p=document.createElement('p');p.textContent='미확인 항목과 포함조건 차이가 없습니다. 계약 전 최종 견적서와 현장 조건을 확인하세요.';host.append(p);}
    for(const [v,text]of m.questions){const p=document.createElement('p');p.className='question-line';const b=document.createElement('b');b.textContent=v==='all'?'공통':`${v.toUpperCase()} 업체`;const span=document.createElement('span');span.textContent=text;p.append(b,span);host.append(p);}
  }
  function render(){setViewport();const m=calculate(state);summarize(m);renderRows(m);renderBars(m);renderQuestions(m);return m;}
  function dirty(){state.sameScope=false;$('#same-scope').checked=false;$('#storage-note').textContent='변경사항 저장 전 · 저장 버튼을 누르거나 CSV로 보관하세요.';}
  function itemText(x){const p=parseAmount(x.amount),ignored=['bundled','excluded'].includes(x.state);return `${LABELS[x.state]} / ${ignored?'합계 제외':p.kind==='valid'?fmtWon(p.won)+'만원':p.kind==='blank'?'금액 미입력':'금액 오류'}`;}
  function report(questionsOnly=false){const m=calculate(state),lines=questionsOnly?[]:['업체 견적 비교 · 단위: 만원',...m.vendors.map(v=>`${v.toUpperCase()} 업체: ${m.totals[v].known?fmtWon(m.totals[v].total)+'만원':'확인된 금액 없음'} / 미확인 ${m.totals[v].pending}개`),$('#comparison').innerText,'',...ITEMS.map(([k,n])=>n+' | '+m.vendors.map(v=>`${v.toUpperCase()}: ${itemText(state.items[k][v])}`).join(' | ')),'','확인 질문'];lines.push(...m.questions.map(([v,q])=>`${v==='all'?'공통':v.toUpperCase()+' 업체'}: ${q}`));if(!questionsOnly)lines.push('','확인된 입력합계 = 본견적 기재 + 별도 금액. 미확인·중복 포함 금액은 제외. 최종 지급액이나 시장평균이 아닙니다.');return lines.join('\n');}
  async function copyText(text){try{if(!navigator.clipboard?.writeText)throw new Error('unavailable');await navigator.clipboard.writeText(text);message('복사했습니다.');}catch{$('#copy-fallback').value=text;$('#copy-dialog').showModal();$('#copy-fallback').focus();$('#copy-fallback').select();}}
  function csvCell(x){let s=String(x??'');if(/^(?:\s*[=+\-@]|[\t\r])/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
  function exportCSV(){const m=calculate(state),rows=[['업체','공종','포함조건','기록한 금액(만원)','합산 금액(만원)','확인 상태']];for(const v of m.vendors)for(const [k,n]of ITEMS){const x=state.items[k][v],p=parseAmount(x.amount),counted=['included','separate'].includes(x.state)&&p.kind==='valid';rows.push([v.toUpperCase(),n,LABELS[x.state],x.amount,counted?String(p.won/10000):'',counted?'합산':x.state==='bundled'||x.state==='excluded'?'합계 제외':'확인 필요']);}const content='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='interior-quote-compare.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('현재 비교 중인 업체의 CSV를 만들었습니다.');}
  function save(){
    if(!storageAvailable){warn('저장 기능을 사용할 수 없습니다. 기존 저장값을 보호하기 위해 덮어쓰지 않습니다. CSV로 보관해 주세요.');return;}
    if(storageConflict){warn('다른 탭에서 저장값이 변경되었습니다. 덮어쓰지 않았습니다. CSV로 현재 입력을 보관한 뒤 새로고침해 주세요.');return;}
    try{const savedAt=new Date().toISOString();const payload={savedAt,data:state};localStorage.setItem(KEY,JSON.stringify(payload));lastSaved=savedAt;$('#storage-note').textContent='이 브라우저에 저장됨 · 다시 열 때 공사 범위 확인은 다시 체크해 주세요.';message('이 브라우저에 저장했습니다.');}catch{warn('브라우저 저장에 실패했습니다. 입력값은 화면에 남아 있습니다. CSV로 보관해 주세요.');}
  }
  function preparePrint(){let table=$('.print-ledger');if(!table){table=document.createElement('table');table.className='print-ledger';$('.charts').before(table);}const m=calculate(state);table.replaceChildren();const caption=document.createElement('caption');caption.textContent='공종별 입력 내역 · 단위: 만원';table.append(caption);const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['공종',...m.vendors.map(v=>v.toUpperCase()+' 업체')]){const th=document.createElement('th');th.scope='col';th.textContent=text;hr.append(th);}head.append(hr);table.append(head);const body=document.createElement('tbody');for(const [k,n]of ITEMS){const tr=document.createElement('tr');for(const text of [n,...m.vendors.map(v=>itemText(state.items[k][v]))]){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}table.append(body);}
  readSaved();syncInputs();render();if(lastSaved)$('#storage-note').textContent='이 브라우저의 저장값 복원됨 · 범위·수량·사양 확인은 다시 체크해 주세요.';
  for(const el of $$('[data-field]'))el.addEventListener(el.dataset.field==='state'?'change':'input',()=>{state.items[el.dataset.item][el.dataset.vendor][el.dataset.field]=el.value;dirty();render();});
  for(const b of $$('button[data-count]'))b.addEventListener('click',()=>{if(state.count===Number(b.dataset.count))return;state.count=Number(b.dataset.count);if(state.count===2&&state.mobile==='c')state.mobile='a';dirty();render();message(state.count===2?'C 업체 입력값은 지우지 않고 비교에서 제외했습니다.':'C 업체를 비교에 추가했습니다.');});
  for(const b of $$('button[data-mobile]'))b.addEventListener('click',()=>{state.mobile=b.dataset.mobile;setViewport();});
  $('#same-scope').addEventListener('change',e=>{state.sameScope=e.target.checked;render();});
  $('#filter').addEventListener('change',e=>{filter=e.target.value;render();});
  $('#save').addEventListener('click',save);$('#copy').addEventListener('click',()=>copyText(report()));$('#copy-questions').addEventListener('click',()=>copyText(report(true)));$('#csv').addEventListener('click',exportCSV);
  $('#print').addEventListener('click',()=>{preparePrint();window.print();});window.addEventListener('beforeprint',preparePrint);
  $('#reset').addEventListener('click',()=>$('#reset-dialog').showModal());$('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
  $('#confirm-reset').addEventListener('click',()=>{try{if(storageConflict)throw new Error('conflict');localStorage.removeItem(KEY);}catch{warn('저장값을 삭제하지 못했습니다. 다른 탭 변경 또는 브라우저 설정을 확인하세요. 입력값을 유지했습니다.');$('#reset-dialog').close();return;}state=emptyState();lastSaved=null;storageAvailable=true;filter='all';$('#filter').value='all';syncInputs();render();$('#reset-dialog').close();$('#storage-note').textContent='초기화됨 · 이전 버전 저장값은 유지됩니다.';$('#error-note').hidden=true;message('현재 비교표를 초기화했습니다.');});
  $('#close-copy').addEventListener('click',()=>$('#copy-dialog').close());
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){storageConflict=true;warn('다른 탭에서 저장값이 바뀌었습니다. 현재 입력은 유지합니다. 저장 대신 CSV로 보관해 주세요.');}});
})();

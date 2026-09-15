(() => {
  'use strict';

  const SOURCES=[
    ['interior-quote-v5','견적 입력'],
    ['interior-compare-v5','업체 비교(v5)'],
    ['interior-compare-v6','업체 비교(v6)'],
    ['interior-review-progress-v46','업체 답변 진행'],
    ['interior-contract-reflection-v48','계약서 반영 기록'],
    ['interior-review-baseline-v49','검수 기준'],
    ['interior-review-revalidation-v50','재검수 기록']
  ];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let staged=null;

  function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
  function writeRaw(key,value){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}
  function byteSize(text){try{return new TextEncoder().encode(text||'').length}catch{return (text||'').length}}
  function stateFor(current,backup){
    if(current===backup)return current===null?'empty':'same';
    if(current===null&&backup!==null)return 'backup-only';
    if(current!==null&&backup===null)return 'current-only';
    return 'different';
  }
  function diffBackup(backup){
    const api=window.InteriorQuoteReview52;if(!api?.validateBackup)throw new Error('v52 백업 기능을 불러오지 못했습니다.');
    const safe=api.validateBackup(backup);
    return SOURCES.map(([key,label])=>{const current=readRaw(key);const incoming=safe.values[key];return {key,label,current,incoming,state:stateFor(current,incoming),currentBytes:byteSize(current),incomingBytes:byteSize(incoming)}});
  }
  function selectedKeys(section){return $$('[data-v53-key]:checked',section).map(input=>input.value)}
  function applySelected(backup,keys){
    const api=window.InteriorQuoteReview52;if(!api?.validateBackup)throw new Error('v52 백업 기능을 불러오지 못했습니다.');
    const safe=api.validateBackup(backup);const allowed=new Set(api.KEYS||[]);const unique=[...new Set(keys)];
    if(!unique.length)throw new Error('복원할 항목을 하나 이상 선택하세요.');
    if(unique.some(key=>!allowed.has(key)))throw new Error('허용되지 않은 복원 항목입니다.');
    const before=Object.fromEntries(unique.map(key=>[key,readRaw(key)]));
    try{for(const key of unique)writeRaw(key,safe.values[key]);return true}catch(error){try{for(const key of unique)writeRaw(key,before[key])}catch{}throw error}
  }

  function ensureStyle(){
    if($('#v53-selective-style'))return;
    const style=document.createElement('style');style.id='v53-selective-style';style.textContent=`
      .v53-panel{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v53-panel p{margin:0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v53-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v53-actions button,.v53-actions label{min-height:40px;display:inline-flex;align-items:center;justify-content:center;flex:1 1 170px}.v53-file{border:1px solid var(--line,#c9c4b8);background:#fff;font-weight:700;cursor:pointer;padding:0 12px}.v53-file input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}.v53-preview{margin-top:12px}.v53-preview[hidden]{display:none}.v53-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.v53-toolbar strong{font-size:14px}.v53-mini{display:flex;gap:6px;flex-wrap:wrap}.v53-mini button{min-height:34px}.v53-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.v53-row{border:1px solid var(--line,#c9c4b8);background:#fff;padding:10px}.v53-row label{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:flex-start;cursor:pointer}.v53-row input{width:18px;height:18px;margin:1px 0 0}.v53-row strong{display:block;font-size:13px}.v53-row span{display:block;margin-top:3px;color:var(--muted,#777168);font-size:11px;line-height:1.45}.v53-row.is-same{opacity:.72}.v53-message{margin-top:10px;font-size:12px;line-height:1.5}.v53-message.is-error{font-weight:700}.v53-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:760px){.v53-grid{grid-template-columns:1fr}}@media print{[data-v53-selective-section]{display:none!important}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v53-selective-section]');if(section)return section;
    const anchor=$('[data-v52-backup-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v53SelectiveSection='';section.innerHTML=`
      <div class="v10-section-head"><div><h2>백업 차이·선택 복원</h2><p>현재 브라우저와 백업 파일을 영역별로 비교한 뒤 필요한 기록만 선택해서 복원합니다.</p></div></div>
      <div class="v53-panel">
        <p>선택하지 않은 저장 영역은 그대로 유지됩니다. 파일을 고른 단계에서는 현재 기록을 변경하지 않습니다.</p>
        <div class="v53-actions"><label class="v53-file">백업 파일 비교<input type="file" accept="application/json,.json" data-v53-file></label></div>
        <div class="v53-message" data-v53-message aria-live="polite"></div>
        <div class="v53-preview" data-v53-preview hidden>
          <div class="v53-toolbar"><strong data-v53-summary>차이 미리보기</strong><div class="v53-mini"><button type="button" data-v53-changed>달라진 항목 선택</button><button type="button" data-v53-all>전체 선택</button><button type="button" data-v53-none>선택 해제</button></div></div>
          <div class="v53-grid" data-v53-grid></div>
          <div class="v53-actions"><button type="button" data-v53-apply disabled>선택 항목만 복원</button><button type="button" data-v53-cancel>비교 취소</button></div>
        </div>
      </div>
      <p class="v53-note">복원 중 오류가 나면 선택한 항목만 시작 전 값으로 롤백합니다. v52 백업 포맷과 동일한 파일만 사용할 수 있습니다.</p>`;
    anchor.after(section);return section;
  }

  function clearPreview(section,message=''){
    staged=null;const preview=$('[data-v53-preview]',section);if(preview)preview.hidden=true;const input=$('[data-v53-file]',section);if(input)input.value='';const msg=$('[data-v53-message]',section);if(msg){msg.textContent=message;msg.classList.remove('is-error')}
  }

  function statusText(row){
    if(row.state==='same')return `동일 · 현재 ${row.currentBytes.toLocaleString('ko-KR')} bytes`;
    if(row.state==='empty')return '둘 다 저장값 없음';
    if(row.state==='backup-only')return `백업에만 있음 · ${row.incomingBytes.toLocaleString('ko-KR')} bytes`;
    if(row.state==='current-only')return `현재에만 있음 · 복원 시 삭제`;
    return `내용 다름 · 현재 ${row.currentBytes.toLocaleString('ko-KR')} / 백업 ${row.incomingBytes.toLocaleString('ko-KR')} bytes`;
  }

  function renderDiff(section,backup){
    staged=backup;const rows=diffBackup(backup);const grid=$('[data-v53-grid]',section);grid.replaceChildren();const changed=rows.filter(row=>!['same','empty'].includes(row.state));
    $('[data-v53-summary]',section).textContent=`달라진 영역 ${changed.length} / ${rows.length}`;
    for(const row of rows){const item=document.createElement('div');item.className=`v53-row${['same','empty'].includes(row.state)?' is-same':''}`;const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=row.key;input.dataset.v53Key='';input.checked=!['same','empty'].includes(row.state);const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=row.label;const span=document.createElement('span');span.textContent=statusText(row);text.append(strong,span);label.append(input,text);item.append(label);grid.append(item)}
    $('[data-v53-preview]',section).hidden=false;updateApply(section);const msg=$('[data-v53-message]',section);msg.textContent='현재 값과 백업 파일을 비교했습니다. 복원할 영역만 체크하세요.';msg.classList.remove('is-error');
  }

  function updateApply(section){const button=$('[data-v53-apply]',section);if(button)button.disabled=!staged||selectedKeys(section).length===0}
  function setSelection(section,mode){$$('[data-v53-key]',section).forEach(input=>{if(mode==='all')input.checked=true;else if(mode==='none')input.checked=false;else{const row=input.closest('.v53-row');input.checked=!row.classList.contains('is-same')}});updateApply(section)}
  function render(){ensureStyle();return ensureSection()}

  function init(){
    const section=render();if(!section)return;
    $('[data-v53-file]',section)?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;const msg=$('[data-v53-message]',section);try{const api=window.InteriorQuoteReview52;if(!api?.parseBackupText)throw new Error('v52 백업 기능을 불러오지 못했습니다.');if(file.size>api.MAX_FILE_BYTES)throw new Error('백업 파일이 2MB를 초과합니다.');renderDiff(section,api.parseBackupText(await file.text()))}catch(error){clearPreview(section);msg.textContent=error.message||'백업 파일을 비교할 수 없습니다.';msg.classList.add('is-error')}});
    $('[data-v53-grid]',section)?.addEventListener('change',event=>{if(event.target.matches('[data-v53-key]'))updateApply(section)});
    $('[data-v53-changed]',section)?.addEventListener('click',()=>setSelection(section,'changed'));
    $('[data-v53-all]',section)?.addEventListener('click',()=>setSelection(section,'all'));
    $('[data-v53-none]',section)?.addEventListener('click',()=>setSelection(section,'none'));
    $('[data-v53-cancel]',section)?.addEventListener('click',()=>clearPreview(section,'백업 비교를 취소했습니다.'));
    $('[data-v53-apply]',section)?.addEventListener('click',()=>{if(!staged)return;const keys=selectedKeys(section);if(!keys.length)return;if(!confirm(`선택한 ${keys.length}개 영역만 백업 파일 상태로 복원할까요?`))return;try{applySelected(staged,keys);location.reload()}catch{const msg=$('[data-v53-message]',section);msg.textContent='선택 복원 중 오류가 발생해 선택 항목을 시작 전 값으로 되돌렸습니다.';msg.classList.add('is-error')}});
  }

  window.InteriorQuoteReview53={SOURCES,diffBackup,applySelected,stateFor,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

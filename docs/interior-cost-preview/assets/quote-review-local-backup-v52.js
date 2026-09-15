(() => {
  'use strict';

  const FORMAT='interior-review-backup';
  const VERSION=1;
  const MAX_FILE_BYTES=2*1024*1024;
  const SOURCES=[
    ['interior-quote-v5','견적 입력'],
    ['interior-compare-v5','업체 비교(v5)'],
    ['interior-compare-v6','업체 비교(v6)'],
    ['interior-review-progress-v46','업체 답변 진행'],
    ['interior-contract-reflection-v48','계약서 반영 기록'],
    ['interior-review-baseline-v49','검수 기준'],
    ['interior-review-revalidation-v50','재검수 기록']
  ];
  const KEYS=SOURCES.map(([key])=>key);
  const $=(s,r=document)=>r.querySelector(s);
  let staged=null;

  function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
  function writeRaw(key,value){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}
  function byteSize(text){try{return new TextEncoder().encode(text||'').length}catch{return (text||'').length}}
  function currentValues(){return Object.fromEntries(KEYS.map(key=>[key,readRaw(key)]))}

  function buildBackup(){
    return {format:FORMAT,version:VERSION,createdAt:new Date().toISOString(),values:currentValues()};
  }

  function validateBackup(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('백업 파일 형식이 올바르지 않습니다.');
    if(value.format!==FORMAT||value.version!==VERSION)throw new Error('지원하지 않는 백업 파일입니다.');
    if(!value.values||typeof value.values!=='object'||Array.isArray(value.values))throw new Error('백업 데이터가 없습니다.');
    const keys=Object.keys(value.values).sort();const allowed=[...KEYS].sort();
    if(keys.length!==allowed.length||keys.some((key,i)=>key!==allowed[i]))throw new Error('허용되지 않은 저장 항목이 포함됐거나 필요한 항목이 빠졌습니다.');
    for(const key of KEYS){const raw=value.values[key];if(raw!==null&&typeof raw!=='string')throw new Error(`${key} 값 형식이 올바르지 않습니다.`)}
    if(value.createdAt!=null&&Number.isNaN(Date.parse(value.createdAt)))throw new Error('백업 생성 시각 형식이 올바르지 않습니다.');
    return {format:FORMAT,version:VERSION,createdAt:value.createdAt||null,values:Object.fromEntries(KEYS.map(key=>[key,value.values[key]]))};
  }

  function parseBackupText(text){
    if(byteSize(text)>MAX_FILE_BYTES)throw new Error('백업 파일이 2MB를 초과합니다.');
    let parsed;try{parsed=JSON.parse(text)}catch{throw new Error('JSON 백업 파일을 읽을 수 없습니다.')}
    return validateBackup(parsed);
  }

  function applyBackup(backup){
    const safe=validateBackup(backup);const before=currentValues();
    try{for(const key of KEYS)writeRaw(key,safe.values[key]);return true}catch(error){try{for(const key of KEYS)writeRaw(key,before[key])}catch{}throw error}
  }

  function downloadBackup(){
    const backup=buildBackup();const body=JSON.stringify(backup,null,2);const blob=new Blob([body],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const stamp=backup.createdAt.slice(0,10).replaceAll('-','');a.href=url;a.download=`interior-review-backup-${stamp}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);return backup;
  }

  function ensureStyle(){
    if($('#v52-backup-style'))return;
    const style=document.createElement('style');style.id='v52-backup-style';style.textContent=`
      .v52-wrap{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v52-panel{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v52-panel h3{margin:0 0 7px;font-size:16px}.v52-panel p{margin:0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v52-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v52-actions button,.v52-actions label{min-height:40px;display:inline-flex;align-items:center;justify-content:center;flex:1 1 160px}.v52-file-label{border:1px solid var(--line,#c9c4b8);background:#fff;font-weight:700;cursor:pointer;padding:0 12px}.v52-file-label input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}.v52-preview{margin-top:12px;border-top:1px solid var(--line,#c9c4b8);padding-top:12px}.v52-preview[hidden]{display:none}.v52-preview-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v52-preview-head strong{font-size:14px}.v52-preview-head span{font-size:11px;color:var(--muted,#777168)}.v52-list{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.v52-item{border:1px solid var(--line,#c9c4b8);background:#fff;padding:8px}.v52-item span{display:block;color:var(--muted,#777168);font-size:11px}.v52-item strong{display:block;margin-top:3px;font-size:12px}.v52-message{margin-top:10px;font-size:12px;line-height:1.5}.v52-message.is-error{font-weight:700}.v52-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:760px){.v52-wrap,.v52-list{grid-template-columns:1fr}}@media print{[data-v52-backup-section]{display:none!important}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v52-backup-section]');if(section)return section;
    const anchor=$('[data-v51-status-section]')||$('.tool-page.site-shell > .tool-stage');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v52BackupSection='';section.innerHTML=`
      <div class="v10-section-head"><div><h2>로컬 백업·복원</h2><p>이 브라우저에 저장된 검수 기록을 JSON 파일로 보관하고 다른 브라우저에서 복원할 수 있습니다. 서버로 전송하지 않습니다.</p></div></div>
      <div class="v52-wrap">
        <div class="v52-panel"><h3>현재 기록 백업</h3><p>견적·비교·업체답변·서면반영·검수기준·재검수 기록 7개 영역을 그대로 파일에 담습니다.</p><div class="v52-actions"><button type="button" data-v52-export>백업 파일 저장</button></div></div>
        <div class="v52-panel"><h3>백업 파일 복원</h3><p>파일을 선택해 먼저 항목 수와 데이터 유무만 확인합니다. 미리보기 전에는 현재 기록을 바꾸지 않습니다.</p><div class="v52-actions"><label class="v52-file-label">백업 파일 선택<input type="file" accept="application/json,.json" data-v52-file></label></div><div class="v52-message" data-v52-message aria-live="polite"></div></div>
      </div>
      <div class="v52-preview" data-v52-preview hidden><div class="v52-preview-head"><div><strong>복원 미리보기</strong><span data-v52-created></span></div><span data-v52-count></span></div><div class="v52-list" data-v52-list></div><div class="v52-actions"><button type="button" data-v52-apply disabled>이 백업으로 복원</button><button type="button" data-v52-cancel>미리보기 취소</button></div></div>
      <p class="v52-note">복원은 위 7개 허용 키만 파일 상태로 교체합니다. 그 외 localStorage는 유지됩니다. 복원 적용 전 현재 상태가 필요하면 먼저 백업 파일을 저장하세요.</p>`;
    anchor.after(section);return section;
  }

  function clearPreview(section,message=''){
    staged=null;const preview=$('[data-v52-preview]',section);if(preview)preview.hidden=true;const input=$('[data-v52-file]',section);if(input)input.value='';const msg=$('[data-v52-message]',section);if(msg){msg.textContent=message;msg.classList.remove('is-error')}
  }

  function renderPreview(section,backup){
    staged=backup;const preview=$('[data-v52-preview]',section);const list=$('[data-v52-list]',section);list.replaceChildren();
    const present=KEYS.filter(key=>backup.values[key]!==null).length;$('[data-v52-count]',section).textContent=`데이터 있음 ${present} / ${KEYS.length}`;$('[data-v52-created]',section).textContent=backup.createdAt?`생성 ${new Date(backup.createdAt).toLocaleString('ko-KR')}`:'생성 시각 없음';
    for(const [key,label] of SOURCES){const raw=backup.values[key];const item=document.createElement('div');item.className='v52-item';const span=document.createElement('span');span.textContent=label;const strong=document.createElement('strong');strong.textContent=raw===null?'저장값 없음':`저장값 있음 · ${byteSize(raw).toLocaleString('ko-KR')} bytes`;item.append(span,strong);list.append(item)}
    preview.hidden=false;$('[data-v52-apply]',section).disabled=false;const msg=$('[data-v52-message]',section);msg.textContent='파일 형식을 확인했습니다. 아래 미리보기를 확인한 뒤 복원을 적용하세요.';msg.classList.remove('is-error');
  }

  function render(){ensureStyle();return ensureSection()}

  function init(){
    const section=render();if(!section)return;
    $('[data-v52-export]',section)?.addEventListener('click',()=>downloadBackup());
    $('[data-v52-file]',section)?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;const msg=$('[data-v52-message]',section);
      try{if(file.size>MAX_FILE_BYTES)throw new Error('백업 파일이 2MB를 초과합니다.');const backup=parseBackupText(await file.text());renderPreview(section,backup)}catch(error){clearPreview(section);msg.textContent=error.message||'백업 파일을 확인할 수 없습니다.';msg.classList.add('is-error')}
    });
    $('[data-v52-cancel]',section)?.addEventListener('click',()=>clearPreview(section,'복원 미리보기를 취소했습니다.'));
    $('[data-v52-apply]',section)?.addEventListener('click',()=>{
      if(!staged)return;if(!confirm('현재 검수 기록 7개 영역을 선택한 백업 파일 상태로 교체할까요?'))return;
      try{applyBackup(staged);location.reload()}catch{const msg=$('[data-v52-message]',section);msg.textContent='복원 중 오류가 발생해 기존 상태로 되돌렸습니다.';msg.classList.add('is-error')}
    });
  }

  window.InteriorQuoteReview52={FORMAT,VERSION,MAX_FILE_BYTES,KEYS,buildBackup,validateBackup,parseBackupText,applyBackup,downloadBackup,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

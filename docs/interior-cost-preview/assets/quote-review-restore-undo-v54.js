(() => {
  'use strict';

  const CHECKPOINT_KEY='interior-review-restore-checkpoint-v54';
  const FALLBACK_KEYS=[
    'interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46',
    'interior-contract-reflection-v48','interior-review-baseline-v49','interior-review-revalidation-v50'
  ];
  const LABELS={
    'interior-quote-v5':'견적 입력','interior-compare-v5':'업체 비교(v5)','interior-compare-v6':'업체 비교(v6)',
    'interior-review-progress-v46':'업체 답변 진행','interior-contract-reflection-v48':'계약서 반영 기록',
    'interior-review-baseline-v49':'검수 기준','interior-review-revalidation-v50':'재검수 기록'
  };
  const $=(s,r=document)=>r.querySelector(s);

  function allowedKeys(){const keys=window.InteriorQuoteReview52?.KEYS;return Array.isArray(keys)&&keys.length?[...keys]:[...FALLBACK_KEYS]}
  function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
  function writeRaw(key,value){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}
  function writeCheckpointRaw(raw){if(raw===null)localStorage.removeItem(CHECKPOINT_KEY);else localStorage.setItem(CHECKPOINT_KEY,raw)}

  function validateCheckpoint(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)throw new Error('되돌리기 기록 형식이 올바르지 않습니다.');
    if(!['full','selective'].includes(value.mode))throw new Error('되돌리기 기록 유형이 올바르지 않습니다.');
    if(!Array.isArray(value.keys)||!value.keys.length)throw new Error('되돌릴 저장 영역이 없습니다.');
    const allowed=new Set(allowedKeys());const unique=[...new Set(value.keys)];
    if(unique.length!==value.keys.length||unique.some(key=>!allowed.has(key)))throw new Error('허용되지 않은 되돌리기 저장 영역입니다.');
    if(!value.values||typeof value.values!=='object'||Array.isArray(value.values))throw new Error('되돌리기 값이 없습니다.');
    const valueKeys=Object.keys(value.values).sort(), expected=[...unique].sort();
    if(valueKeys.length!==expected.length||valueKeys.some((key,i)=>key!==expected[i]))throw new Error('되돌리기 저장 영역과 값이 일치하지 않습니다.');
    for(const key of unique){const raw=value.values[key];if(raw!==null&&typeof raw!=='string')throw new Error(`${key} 되돌리기 값 형식이 올바르지 않습니다.`)}
    if(!value.createdAt||Number.isNaN(Date.parse(value.createdAt)))throw new Error('되돌리기 생성 시각이 올바르지 않습니다.');
    return {version:1,createdAt:value.createdAt,mode:value.mode,keys:unique,values:Object.fromEntries(unique.map(key=>[key,value.values[key]]))};
  }

  function loadCheckpoint(){
    try{const raw=readRaw(CHECKPOINT_KEY);if(!raw)return null;return validateCheckpoint(JSON.parse(raw))}catch{return null}
  }

  function prepareCheckpoint(mode,keys){
    const allowed=new Set(allowedKeys());const unique=[...new Set(keys||[])];
    if(!['full','selective'].includes(mode))throw new Error('복원 유형이 올바르지 않습니다.');
    if(!unique.length||unique.some(key=>!allowed.has(key)))throw new Error('복원 전 상태를 저장할 항목이 올바르지 않습니다.');
    const previousRaw=readRaw(CHECKPOINT_KEY);
    const checkpoint={version:1,createdAt:new Date().toISOString(),mode,keys:unique,values:Object.fromEntries(unique.map(key=>[key,readRaw(key)]))};
    localStorage.setItem(CHECKPOINT_KEY,JSON.stringify(checkpoint));
    return {previousRaw,checkpoint};
  }

  function restoreCheckpointSlot(transaction){
    if(!transaction||!Object.prototype.hasOwnProperty.call(transaction,'previousRaw'))return;
    writeCheckpointRaw(transaction.previousRaw);
  }

  function clearCheckpoint(){try{localStorage.removeItem(CHECKPOINT_KEY);return true}catch{return false}}

  function undoCheckpoint(){
    const checkpoint=loadCheckpoint();if(!checkpoint)throw new Error('되돌릴 최근 복원 기록이 없습니다.');
    const before=Object.fromEntries(checkpoint.keys.map(key=>[key,readRaw(key)]));
    try{
      for(const key of checkpoint.keys)writeRaw(key,checkpoint.values[key]);
      localStorage.removeItem(CHECKPOINT_KEY);
      return true;
    }catch(error){
      try{for(const key of checkpoint.keys)writeRaw(key,before[key])}catch{}
      throw error;
    }
  }

  function ensureStyle(){
    if($('#v54-undo-style'))return;
    const style=document.createElement('style');style.id='v54-undo-style';style.textContent=`
      .v54-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v54-card strong{display:block;font-size:16px}.v54-card p{margin:6px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v54-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.v54-chip{border:1px solid var(--line,#c9c4b8);background:#fff;padding:4px 7px;font-size:11px}.v54-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v54-actions button{min-height:40px;flex:1 1 180px}.v54-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media print{[data-v54-undo-section]{display:none!important}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v54-undo-section]');if(section)return section;
    const anchor=$('[data-v53-selective-section]')||$('[data-v52-backup-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v54UndoSection='';section.innerHTML=`
      <div class="v10-section-head"><div><h2>최근 복원 되돌리기</h2><p>전체 또는 선택 복원을 적용하기 직전 상태를 한 단계 보관합니다. 되돌리기는 실제 복원으로 바뀐 영역만 대상으로 합니다.</p></div></div>
      <div class="v54-card" data-v54-card></div>
      <p class="v54-note">체크포인트는 <code>${CHECKPOINT_KEY}</code>에만 저장되며 백업 JSON에는 포함되지 않습니다. 새 복원을 적용하면 이전 되돌리기 기록은 새 체크포인트로 교체됩니다.</p>`;
    anchor.after(section);return section;
  }

  function render(){
    ensureStyle();const section=ensureSection();if(!section)return null;const host=$('[data-v54-card]',section);const cp=loadCheckpoint();host.replaceChildren();
    const strong=document.createElement('strong');const p=document.createElement('p');host.append(strong,p);
    if(!cp){strong.textContent='되돌릴 최근 복원이 없습니다.';p.textContent='다음 전체/선택 복원을 적용하면 복원 직전 상태가 이 브라우저에 한 번 보관됩니다.';return null}
    strong.textContent=`${cp.mode==='full'?'전체':'선택'} 복원 전 상태 · ${cp.keys.length}개 영역`;
    p.textContent=`저장 시각 ${new Date(cp.createdAt).toLocaleString('ko-KR')} · 되돌리면 아래 영역만 복원 직전 값으로 돌아갑니다.`;
    const list=document.createElement('div');list.className='v54-list';for(const key of cp.keys){const chip=document.createElement('span');chip.className='v54-chip';chip.textContent=LABELS[key]||key;list.append(chip)}host.append(list);
    const actions=document.createElement('div');actions.className='v54-actions';const undo=document.createElement('button');undo.type='button';undo.dataset.v54Undo='';undo.textContent='복원 전 상태로 되돌리기';const clear=document.createElement('button');clear.type='button';clear.dataset.v54Clear='';clear.textContent='되돌리기 기록 삭제';actions.append(undo,clear);host.append(actions);
    undo.addEventListener('click',()=>{if(!confirm(`${cp.keys.length}개 영역을 최근 복원 직전 상태로 되돌릴까요?`))return;try{undoCheckpoint();location.reload()}catch{p.textContent='되돌리기 중 오류가 발생해 현재 상태를 유지했습니다.'}});
    clear.addEventListener('click',()=>{if(!confirm('최근 복원 되돌리기 기록만 삭제할까요?'))return;clearCheckpoint();render()});
    return cp;
  }

  function replaceRestoreButtons(){
    const full=$('[data-v52-apply]');
    if(full&&!full.dataset.v54Wrapped){
      const clone=full.cloneNode(true);clone.dataset.v54Wrapped='';full.replaceWith(clone);
      clone.addEventListener('click',async()=>{
        const input=$('[data-v52-file]');const file=input?.files?.[0];const msg=$('[data-v52-message]');if(!file){if(msg)msg.textContent='복원할 백업 파일을 다시 선택하세요.';return}
        try{
          const api=window.InteriorQuoteReview52;if(!api?.parseBackupText||!api?.applyBackup)throw new Error('v52 백업 기능을 불러오지 못했습니다.');
          const backup=api.parseBackupText(await file.text());if(!confirm('현재 검수 기록 7개 영역을 선택한 백업 파일 상태로 교체할까요?'))return;
          const tx=prepareCheckpoint('full',api.KEYS||allowedKeys());
          try{api.applyBackup(backup);location.reload()}catch(error){try{restoreCheckpointSlot(tx)}catch{}throw error}
        }catch(error){if(msg){msg.textContent=error.message||'복원 중 오류가 발생해 현재 상태를 유지했습니다.';msg.classList.add('is-error')}}
      });
    }
    const selective=$('[data-v53-apply]');
    if(selective&&!selective.dataset.v54Wrapped){
      const clone=selective.cloneNode(true);clone.dataset.v54Wrapped='';selective.replaceWith(clone);
      clone.addEventListener('click',async()=>{
        const input=$('[data-v53-file]');const file=input?.files?.[0];const msg=$('[data-v53-message]');const keys=[...document.querySelectorAll('[data-v53-key]:checked')].map(el=>el.value);if(!file||!keys.length){if(msg)msg.textContent='백업 파일과 복원할 영역을 확인하세요.';return}
        try{
          const api52=window.InteriorQuoteReview52,api53=window.InteriorQuoteReview53;if(!api52?.parseBackupText||!api53?.applySelected)throw new Error('선택 복원 기능을 불러오지 못했습니다.');
          const backup=api52.parseBackupText(await file.text());if(!confirm(`선택한 ${keys.length}개 영역만 백업 파일 상태로 복원할까요?`))return;
          const tx=prepareCheckpoint('selective',keys);
          try{api53.applySelected(backup,keys);location.reload()}catch(error){try{restoreCheckpointSlot(tx)}catch{}throw error}
        }catch(error){if(msg){msg.textContent=error.message||'선택 복원 중 오류가 발생해 현재 상태를 유지했습니다.';msg.classList.add('is-error')}}
      });
    }
  }

  function init(){render();replaceRestoreButtons()}

  window.InteriorQuoteReview54={CHECKPOINT_KEY,validateCheckpoint,loadCheckpoint,prepareCheckpoint,restoreCheckpointSlot,clearCheckpoint,undoCheckpoint,render,replaceRestoreButtons};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

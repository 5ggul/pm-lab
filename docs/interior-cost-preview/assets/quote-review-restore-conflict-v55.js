(() => {
  'use strict';

  const FALLBACK_KEYS=[
    'interior-quote-v5','interior-compare-v5','interior-compare-v6','interior-review-progress-v46',
    'interior-contract-reflection-v48','interior-review-baseline-v49','interior-review-revalidation-v50'
  ];
  const LABELS={
    'interior-quote-v5':'견적 입력','interior-compare-v5':'업체 비교(v5)','interior-compare-v6':'업체 비교(v6)',
    'interior-review-progress-v46':'업체 답변 진행','interior-contract-reflection-v48':'계약서 반영 기록',
    'interior-review-baseline-v49':'검수 기준','interior-review-revalidation-v50':'재검수 기록'
  };
  const staged={full:null,selective:null};
  let lastMode=null;
  const $=(s,r=document)=>r.querySelector(s);

  function allowedKeys(){const keys=window.InteriorQuoteReview52?.KEYS;return Array.isArray(keys)&&keys.length?[...keys]:[...FALLBACK_KEYS]}
  function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
  function currentValues(){return Object.fromEntries(allowedKeys().map(key=>[key,readRaw(key)]))}
  function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

  function ensureStyle(){
    if($('#v55-conflict-style'))return;
    const style=document.createElement('style');style.id='v55-conflict-style';style.textContent=`
      .v55-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v55-card strong{display:block;font-size:16px}.v55-card p{margin:6px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v55-card.is-conflict{border-width:2px}.v55-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.v55-chip{border:1px solid var(--line,#c9c4b8);background:#fff;padding:4px 7px;font-size:11px}.v55-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v55-actions button{min-height:40px;flex:1 1 190px}.v55-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media print{[data-v55-conflict-section]{display:none!important}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v55-conflict-section]');if(section)return section;
    const anchor=$('[data-v54-undo-section]')||$('[data-v53-selective-section]')||$('[data-v52-backup-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v55ConflictSection='';section.innerHTML=`
      <div class="v10-section-head"><div><h2>복원 적용 직전 재검증</h2><p>백업 파일을 비교한 뒤 현재 저장값이 다시 바뀌면 오래된 미리보기로 복원하지 않도록 적용 직전에 한 번 더 확인합니다.</p></div></div>
      <div class="v55-card" data-v55-card><strong data-v55-state>아직 복원 미리보기가 없습니다.</strong><p data-v55-detail>전체 또는 선택 복원용 백업 파일을 고르면 현재값 기준을 세션 메모리에만 보관합니다.</p><div class="v55-list" data-v55-list></div><div class="v55-actions"><button type="button" data-v55-refresh hidden>현재값으로 비교 다시 시작</button></div></div>
      <p class="v55-note">v55는 새 localStorage를 만들지 않습니다. 파일 선택 시점과 실제 적용 시점 사이의 변경만 검사하며, 충돌이 있으면 복원과 v54 체크포인트 생성을 모두 중단합니다.</p>`;
    anchor.after(section);return section;
  }

  function renderState(kind,detail='',keys=[]){
    ensureStyle();const section=ensureSection();if(!section)return;const card=$('[data-v55-card]',section),state=$('[data-v55-state]',section),p=$('[data-v55-detail]',section),list=$('[data-v55-list]',section),refresh=$('[data-v55-refresh]',section);list.replaceChildren();card.classList.toggle('is-conflict',kind==='conflict');
    if(kind==='staged')state.textContent='복원 미리보기 기준을 저장했습니다.';
    else if(kind==='pass')state.textContent='적용 직전 재검증을 통과했습니다.';
    else if(kind==='conflict')state.textContent='미리보기 이후 현재값이 바뀌어 복원을 중단했습니다.';
    else if(kind==='missing')state.textContent='복원 기준을 다시 확인해야 합니다.';
    else state.textContent='아직 복원 미리보기가 없습니다.';
    p.textContent=detail||'전체 또는 선택 복원용 백업 파일을 고르면 현재값 기준을 세션 메모리에만 보관합니다.';
    for(const key of keys){const chip=document.createElement('span');chip.className='v55-chip';chip.textContent=LABELS[key]||key;list.append(chip)}
    refresh.hidden=!['conflict','missing'].includes(kind)||!lastMode;
  }

  async function stage(mode,file){
    if(!['full','selective'].includes(mode)||!file){staged[mode]=null;return null}
    const api=window.InteriorQuoteReview52;if(!api?.parseBackupText)throw new Error('백업 기능을 불러오지 못했습니다.');
    const text=await file.text();api.parseBackupText(text);
    staged[mode]={fileHash:hashText(text),values:currentValues(),stagedAt:new Date().toISOString()};lastMode=mode;
    renderState('staged',`${mode==='full'?'전체':'선택'} 복원 미리보기 시점의 현재값을 기준으로 저장했습니다.`);
    return staged[mode];
  }

  function setPanelMessage(mode,text){
    const msg=$(mode==='full'?'[data-v52-message]':'[data-v53-message]');if(msg){msg.textContent=text;msg.classList.add('is-error')}
  }

  async function preflight(mode,file,keys){
    lastMode=mode;const record=staged[mode];const unique=[...new Set(keys||[])];
    if(!record||!file){const text='복원 미리보기 기준이 없어 적용을 중단했습니다. 백업 파일을 다시 비교하세요.';renderState('missing',text);setPanelMessage(mode,text);return {ok:false,reason:'missing',conflicts:[]}}
    let fileHash;try{fileHash=hashText(await file.text())}catch{fileHash=''}
    if(!fileHash||fileHash!==record.fileHash){const text='현재 선택한 백업 파일과 미리보기 파일이 일치하지 않아 적용을 중단했습니다.';renderState('missing',text);setPanelMessage(mode,text);return {ok:false,reason:'file-mismatch',conflicts:[]}}
    const allowed=new Set(allowedKeys());if(!unique.length||unique.some(key=>!allowed.has(key))){const text='복원할 저장 영역을 다시 확인하세요.';renderState('missing',text);setPanelMessage(mode,text);return {ok:false,reason:'keys',conflicts:[]}}
    const conflicts=unique.filter(key=>readRaw(key)!==record.values[key]);
    if(conflicts.length){const text=`미리보기 이후 ${conflicts.length}개 영역의 현재값이 바뀌었습니다. 현재값으로 다시 비교한 뒤 복원하세요.`;renderState('conflict',text,conflicts);setPanelMessage(mode,text);return {ok:false,reason:'changed',conflicts}}
    renderState('pass',`${unique.length}개 복원 대상의 현재값이 미리보기 시점과 같습니다.`);return {ok:true,reason:null,conflicts:[]};
  }

  function refreshCurrentPreview(){
    if(!lastMode)return false;const input=$(lastMode==='full'?'[data-v52-file]':'[data-v53-file]');if(!input?.files?.[0]){renderState('missing','백업 파일을 다시 선택하세요.');return false}input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }

  function bindInput(selector,mode){const input=$(selector);if(!input||input.dataset.v55Bound)return;input.dataset.v55Bound='';input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file){staged[mode]=null;return}try{await stage(mode,file)}catch{staged[mode]=null;renderState('missing','백업 파일을 확인할 수 없어 복원 기준을 만들지 못했습니다.')}})}
  function init(){ensureStyle();const section=ensureSection();if(!section)return;bindInput('[data-v52-file]','full');bindInput('[data-v53-file]','selective');$('[data-v55-refresh]',section)?.addEventListener('click',refreshCurrentPreview)}

  window.InteriorQuoteReview55={allowedKeys,currentValues,hashText,stage,preflight,refreshCurrentPreview,renderState};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

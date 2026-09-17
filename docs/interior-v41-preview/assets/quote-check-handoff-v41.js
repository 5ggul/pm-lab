(()=>{
  'use strict';
  const QUOTE_KEY='interior-quote-source-v41';
  const HANDOFF_KEY='interior-quote-compare-handoff-v41';
  const LOCK_NAME='interior-v41-handoff-write-v41';
  const HANDOFF_MAX_AGE_MS=30*60*1000;
  const ITEMS=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const safeText=v=>v==null?'':String(v);
  const compareUrl=()=>new URL('../quote-compare/',location.href).href;

  function readJSON(key,fallback=null){
    try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}
  }

  function readCurrentQuote(){
    const form=$('[data-quote-form]');
    if(!form) throw new Error('견적 입력 폼을 찾지 못했습니다.');
    const out={context:{},items:{}};
    $$('[data-context]',form).forEach(el=>out.context[el.dataset.context]=safeText(el.value));
    for(const id of ITEMS){
      const row=$(`[data-qrow="${id}"]`,form);
      if(!row) throw new Error(`${id} 항목을 찾지 못했습니다.`);
      out.items[id]={
        name:$('.qrow-title strong',row)?.textContent?.trim()||id,
        state:$(`[name="state-${id}"]:checked`,row)?.value||'missing',
        amount:safeText($('[data-q-amount]',row)?.value),
        qty:safeText($('[data-q-qty]',row)?.value),
        unit:safeText($('[data-q-unit]',row)?.value),
        spec:safeText($('[data-q-spec]',row)?.value),
        memo:safeText($('[data-q-memo]',row)?.value)
      };
    }
    return out;
  }

  function canStore(){
    try{const k='__interior_handoff_probe__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch{return false;}
  }

  function makeTransferId(){
    try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();}catch{}
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function sameSourceSnapshot(current,expected){
    if(!current||!expected||current.version!==expected.version||current.transferId!==expected.transferId||current.createdAt!==expected.createdAt) return false;
    try{return JSON.stringify(current.quote)===JSON.stringify(expected.quote);}catch{return false;}
  }
  function sameHandoffSnapshot(current,expected){
    return !!current&&!!expected&&current.version===expected.version&&current.target===expected.target&&current.transferId===expected.transferId&&current.createdAt===expected.createdAt;
  }
  function clearOwnedTransfer(expectedSource,expectedHandoff){
    const currentSource=readJSON(QUOTE_KEY,null);
    const currentHandoff=readJSON(HANDOFF_KEY,null);
    if(expectedHandoff&&sameHandoffSnapshot(currentHandoff,expectedHandoff)){
      try{localStorage.removeItem(HANDOFF_KEY);}catch{}
    }
    if(expectedSource&&sameSourceSnapshot(currentSource,expectedSource)){
      try{localStorage.removeItem(QUOTE_KEY);}catch{}
    }
  }
  function freshTimestamp(value){
    const t=Date.parse(value?.createdAt||'');
    return Number.isFinite(t)&&Date.now()-t>=0&&Date.now()-t<=HANDOFF_MAX_AGE_MS;
  }
  function isFreshSourceEnvelope(source){
    return !!source&&source.version===2&&typeof source.transferId==='string'&&!!source.transferId&&freshTimestamp(source);
  }
  function isFreshHandoffEnvelope(handoff){
    return !!handoff&&handoff.version===2&&['a','b','c'].includes(handoff.target)&&typeof handoff.transferId==='string'&&!!handoff.transferId&&freshTimestamp(handoff);
  }
  function isFreshPair(source,handoff){
    return isFreshSourceEnvelope(source)&&isFreshHandoffEnvelope(handoff)&&source.transferId===handoff.transferId&&source.createdAt===handoff.createdAt;
  }
  function currentPendingState(){
    const source=readJSON(QUOTE_KEY,null);
    const handoff=readJSON(HANDOFF_KEY,null);
    if(isFreshPair(source,handoff)) return {kind:'pair',source,handoff};
    const freshSource=isFreshSourceEnvelope(source)?source:null;
    const freshHandoff=isFreshHandoffEnvelope(handoff)?handoff:null;
    if(freshSource||freshHandoff) return {kind:'partial',source:freshSource,handoff:freshHandoff};
    return null;
  }
  function currentPendingPair(){
    const state=currentPendingState();
    return state?.kind==='pair'?{source:state.source,handoff:state.handoff}:null;
  }
  function samePendingState(current,expected){
    if(!current||!expected||current.kind!==expected.kind) return false;
    const sourceSame=current.source||expected.source?sameSourceSnapshot(current.source,expected.source):true;
    const handoffSame=current.handoff||expected.handoff?sameHandoffSnapshot(current.handoff,expected.handoff):true;
    return sourceSame&&handoffSame;
  }

  function isProductionShell(){
    try{return location.pathname.includes('/production-shell/quote-check/');}catch{return false;}
  }

  async function withTransferLock(fn){
    const locks=globalThis.navigator?.locks;
    if(locks?.request){
      return locks.request(LOCK_NAME,{mode:'exclusive'},fn);
    }
    if(isProductionShell()){
      throw new Error('이 브라우저에서는 다중 탭 전송 보호를 사용할 수 없습니다. 최신 브라우저에서 다시 시도해 주세요.');
    }
    return fn();
  }

  function writeTransfer(source,handoff){
    const pending=currentPendingState();
    if(pending){
      throw new Error(pending.kind==='pair'
        ? '이미 비교표 전송이 진행 중입니다. 기존 전송을 적용하거나 취소한 뒤 다시 시도해 주세요.'
        : '이전 전송 데이터가 정리 중이거나 불완전하게 남아 있습니다. 잠시 후 다시 시도하거나 복구 패널에서 정리해 주세요.');
    }
    try{
      localStorage.setItem(QUOTE_KEY,JSON.stringify(source));
      localStorage.setItem(HANDOFF_KEY,JSON.stringify(handoff));
      const persistedSource=readJSON(QUOTE_KEY,null);
      const persistedHandoff=readJSON(HANDOFF_KEY,null);
      if(!sameSourceSnapshot(persistedSource,source)||!sameHandoffSnapshot(persistedHandoff,handoff)){
        throw new Error('다른 탭의 동시 전송과 충돌했습니다. 다시 시도해 주세요.');
      }
    }catch(err){
      clearOwnedTransfer(source,handoff);
      if(err instanceof Error) throw err;
      throw new Error('검수용 견적 저장에 실패했습니다.');
    }
  }

  async function writeTransferExclusive(source,handoff){
    return withTransferLock(()=>writeTransfer(source,handoff));
  }

  async function cancelPendingTransfer(expected=currentPendingState()){
    if(!expected) return true;
    return withTransferLock(()=>{
      const current=currentPendingState();
      if(!current) return true;
      if(!samePendingState(current,expected)){
        throw new Error('대기 중 전송이 다른 탭에서 변경되었습니다. 현재 전송을 다시 확인해 주세요.');
      }
      clearOwnedTransfer(expected.source,expected.handoff);
      return !currentPendingState();
    });
  }

  async function saveAndRequest(target){
    if(!['a','b','c'].includes(target)) throw new Error('보낼 업체 칸을 선택해 주세요.');
    if(!canStore()) throw new Error('브라우저 저장소를 사용할 수 없습니다.');
    const quote=readCurrentQuote();
    const createdAt=new Date().toISOString();
    const transferId=makeTransferId();
    const source={version:2,transferId,createdAt,quote};
    const handoff={version:2,target,transferId,createdAt};
    await writeTransferExclusive(source,handoff);
    window.dispatchEvent(new CustomEvent('interior-handoff-pending',{detail:{transferId,target}}));
    const url=compareUrl();
    location.assign(url);
    return {transferId,url};
  }

  function guardProductionQuoteStorage(actions){
    if(!isProductionShell()||!actions) return;
    let status=$('[data-v41-quote-storage-guard]');
    if(!status){
      status=document.createElement('p');
      status.dataset.v41QuoteStorageGuard='';
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      status.style.cssText='width:100%;margin:6px 0 0;font-size:12px;color:var(--muted,#777168)';
      status.textContent='production-shell 검수에서는 운영 견적 저장키를 변경하지 않습니다.';
      actions.append(status);
    }
    for(const selector of ['[data-save-quote]','[data-reset-quote]']){
      const btn=$(selector,actions);
      if(!btn||btn.dataset.v41Guarded==='true') continue;
      btn.dataset.v41Guarded='true';
      btn.title='production-shell 검수에서는 비활성화됩니다.';
      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        status.textContent='검수 전용 화면에서는 브라우저 저장/초기화가 차단됩니다. 운영 견적 저장값은 변경하지 않았습니다.';
      },true);
    }
  }

  function injectPendingRecovery(actions){
    if(!actions) return null;
    let panel=$('[data-v41-pending-recovery]');
    if(!panel){
      panel=document.createElement('section');
      panel.dataset.v41PendingRecovery='';
      panel.className='notice';
      panel.hidden=true;
      panel.innerHTML='<strong data-v41-pending-title>비교표 전송 대기 중</strong><p data-v41-pending-text style="margin:6px 0 10px"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-v41-open-pending>대기 중 비교표 열기</button><button type="button" data-v41-cancel-pending>대기 전송 취소</button></div><p data-v41-pending-status role="status" aria-live="polite" style="margin:8px 0 0;font-size:12px"></p>';
      actions.before(panel);
    }
    const title=$('[data-v41-pending-title]',panel);
    const text=$('[data-v41-pending-text]',panel);
    const status=$('[data-v41-pending-status]',panel);
    const open=$('[data-v41-open-pending]',panel);
    const cancel=$('[data-v41-cancel-pending]',panel);
    let shown=null;
    const render=()=>{
      shown=currentPendingState();
      panel.hidden=!shown;
      if(!shown) return;
      if(shown.kind==='pair'){
        const target=shown.handoff.target.toUpperCase();
        const created=new Date(shown.handoff.createdAt).toLocaleString('ko-KR');
        title.textContent='비교표 전송 대기 중';
        text.textContent=`${target} 업체 칸으로 보낼 전송이 아직 처리되지 않았습니다. 생성: ${created}`;
        status.textContent='이전 이동이 중단됐다면 비교표를 다시 열거나 이 전송만 취소할 수 있습니다.';
        open.hidden=false;open.disabled=false;cancel.textContent='대기 전송 취소';
      }else{
        title.textContent='불완전한 전송 데이터 정리 필요';
        text.textContent='이전 전송 도중 브라우저 이동 또는 저장이 중단되어 source/handoff 중 일부만 남아 있습니다.';
        status.textContent='새 전송 전에 현재 남은 검수용 전송 데이터만 안전하게 정리하세요.';
        open.hidden=true;cancel.textContent='불완전 전송 정리';
      }
      cancel.disabled=false;
    };
    open.addEventListener('click',()=>location.assign(compareUrl()));
    cancel.addEventListener('click',async()=>{
      const expected=shown;
      if(!expected){render();return;}
      cancel.disabled=true;open.disabled=true;
      try{
        const cleared=await cancelPendingTransfer(expected);
        status.textContent=cleared?'대기 전송 데이터를 정리했습니다. 새 전송을 시작할 수 있습니다.':'대기 전송 데이터를 정리하지 못했습니다.';
      }catch(err){
        status.textContent=String(err?.message||err);
      }
      render();
    });
    window.addEventListener('storage',e=>{if([QUOTE_KEY,HANDOFF_KEY].includes(e.key))render();});
    window.addEventListener('interior-handoff-pending',render);
    render();
    return {panel,render};
  }

  function inject(){
    const actions=$('[data-quote-report] .tool-actions');
    if(!actions) return;
    guardProductionQuoteStorage(actions);
    injectPendingRecovery(actions);
    if($('[data-send-to-compare]',actions)) return;
    const wrap=document.createElement('div');wrap.className='v40-send-wrap';
    const btn=document.createElement('button');btn.type='button';btn.dataset.sendToCompare='';btn.textContent='비교표로 보내기';btn.className='v40-send-button';
    wrap.append(btn);actions.prepend(wrap);

    const style=document.createElement('style');style.textContent=`
      .v40-send-wrap{display:inline-flex;align-items:center}.v40-send-button{font-weight:750}
      .v40-handoff-dialog{max-width:min(520px,calc(100% - 32px));border:1px solid var(--ink,#171A18);padding:22px;background:var(--paper,#FCFBF7);color:var(--ink,#171A18)}
      .v40-handoff-dialog::backdrop{background:var(--ink,#171A18)66}.v40-handoff-dialog h2{margin:0 0 8px;font-size:20px}.v40-handoff-dialog p{margin:0 0 16px;color:var(--muted,#777168);font-size:13px}
      .v40-targets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border:0;padding:0;margin:0 0 18px}.v40-targets label{border:1px solid var(--line,#C9C4B8);padding:10px;text-align:center;cursor:pointer}.v40-targets input{margin-right:5px}.v40-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
      @media(max-width:560px){.v40-send-wrap{display:flex;width:100%}.v40-send-button{width:100%}.v40-handoff-dialog{padding:18px}.v40-targets label{padding:10px 4px}}
    `;document.head.append(style);

    const dialog=document.createElement('dialog');dialog.className='v40-handoff-dialog';dialog.setAttribute('aria-labelledby','v40-handoff-title');
    dialog.innerHTML='<h2 id="v40-handoff-title">어느 업체 칸으로 보낼까요?</h2><p>현재 견적을 검수용 브라우저 저장소에 저장한 뒤 비교표에서 미리보기로 확인합니다. URL에는 견적 내용이 포함되지 않습니다.</p><fieldset class="v40-targets"><legend class="sr-only">업체 선택</legend><label><input type="radio" name="v40-target" value="a" checked>A 업체</label><label><input type="radio" name="v40-target" value="b">B 업체</label><label><input type="radio" name="v40-target" value="c">C 업체</label></fieldset><div class="v40-dialog-actions"><button type="button" data-v40-cancel>취소</button><button type="button" data-v40-confirm>저장하고 비교표 열기</button></div>';
    document.body.append(dialog);
    btn.addEventListener('click',()=>dialog.showModal());
    $('[data-v40-cancel]',dialog).addEventListener('click',()=>dialog.close());
    const confirm=$('[data-v40-confirm]',dialog);
    confirm.addEventListener('click',async()=>{
      const target=$('input[name="v40-target"]:checked',dialog)?.value||'a';
      confirm.disabled=true;
      try{
        await saveAndRequest(target);
      }catch(e){
        confirm.disabled=false;
        dialog.close();
        window.dispatchEvent(new CustomEvent('interior-handoff-error',{detail:{message:e.message}}));
        alert('비교표로 보내지 못했습니다. '+e.message);
      }
    });
  }

  window.InteriorQuoteHandoff41={readCurrentQuote,saveAndRequest,writeTransferExclusive,withTransferLock,currentPendingState,currentPendingPair,cancelPendingTransfer,clearOwnedTransfer,inject,injectPendingRecovery,compareUrl,isProductionShell,guardProductionQuoteStorage,QUOTE_KEY,HANDOFF_KEY,LOCK_NAME};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
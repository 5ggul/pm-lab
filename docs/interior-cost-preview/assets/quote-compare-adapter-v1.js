(() => {
  'use strict';

  const SOURCE_KEY='interior-quote-handoff-source-v1';
  const HANDOFF_KEY='interior-quote-handoff-v1';
  const REVIEW_KEY='interior-compare-v7';
  const LOCK_NAME='interior-quote-handoff-write-v1';
  const REVIEW_LOCK_NAME='interior-compare-v7-write-v1';
  const HANDOFF_MAX_AGE_MS=30*60*1000;
  const MAX_SAFE_AMOUNT=Number.MAX_SAFE_INTEGER;
  const VENDORS=['a','b','c'];
  const ITEMS=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
  const VALID_STATES=new Set(['included','separate','missing']);
  const $=(s,r=document)=>r.querySelector(s);

  function readJSON(key,fallback=null){
    try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}
  }
  function writeJSON(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
  }
  function removeKey(key){try{localStorage.removeItem(key);}catch{}}

  function blankReview(){return {version:1,flat:{},vendors:{a:null,b:null,c:null},updatedAt:null};}
  function normalizeReview(value){
    const out=blankReview();
    if(!value||typeof value!=='object') return out;
    if(value.flat&&typeof value.flat==='object') out.flat={...value.flat};
    for(const vendor of VENDORS){
      const meta=value.vendors?.[vendor];
      if(meta&&typeof meta==='object') out.vendors[vendor]=meta;
    }
    out.updatedAt=value.updatedAt||null;
    return out;
  }
  function isValidQuote(quote){
    if(!quote||typeof quote!=='object'||!quote.items||typeof quote.items!=='object') return false;
    return ITEMS.every(id=>{
      const item=quote.items[id];
      return !!item&&typeof item==='object'&&VALID_STATES.has(item.state);
    });
  }
  function isFreshHandoff(handoff){
    if(!handoff||handoff.version!==2||!VENDORS.includes(handoff.target)||typeof handoff.transferId!=='string'||!handoff.transferId) return false;
    const t=Date.parse(handoff.createdAt||'');
    return Number.isFinite(t)&&Date.now()-t>=0&&Date.now()-t<=HANDOFF_MAX_AGE_MS;
  }
  function getMatchedQuote(source,handoff){
    if(!source||typeof source!=='object'||source.version!==2||!isFreshHandoff(handoff)) return null;
    if(typeof source.transferId!=='string'||source.transferId!==handoff.transferId) return null;
    if(source.createdAt!==handoff.createdAt) return null;
    return isValidQuote(source.quote)?source.quote:null;
  }
  function readTransfer(){
    const source=readJSON(SOURCE_KEY,null);
    const handoff=readJSON(HANDOFF_KEY,null);
    const quote=getMatchedQuote(source,handoff);
    return {source,handoff,quote};
  }
  function sameSourceSnapshot(current,expected){
    if(!current||!expected||current.version!==expected.version||current.transferId!==expected.transferId||current.createdAt!==expected.createdAt) return false;
    try{return JSON.stringify(current.quote)===JSON.stringify(expected.quote);}catch{return false;}
  }
  function sameHandoffSnapshot(current,expected){
    return !!current&&!!expected&&current.version===expected.version&&current.target===expected.target&&current.transferId===expected.transferId&&current.createdAt===expected.createdAt;
  }
  function sameTransferSnapshot(current,expected){
    return !!current?.quote&&!!expected?.quote
      &&sameSourceSnapshot(current.source,expected.source)
      &&sameHandoffSnapshot(current.handoff,expected.handoff);
  }
  function exactPair(source,handoff){
    return !!source&&!!handoff&&source.version===2&&handoff.version===2
      &&typeof source.transferId==='string'&&!!source.transferId
      &&source.transferId===handoff.transferId
      &&source.createdAt===handoff.createdAt;
  }
  function isStaleExactPair(source,handoff){
    if(!exactPair(source,handoff)) return false;
    const t=Date.parse(handoff.createdAt||'');
    return Number.isFinite(t)&&Date.now()-t>HANDOFF_MAX_AGE_MS;
  }
  function ownsTransfer(source,handoff){
    const persistedSource=readJSON(SOURCE_KEY,null);
    const persistedHandoff=readJSON(HANDOFF_KEY,null);
    return sameSourceSnapshot(persistedSource,source)&&sameHandoffSnapshot(persistedHandoff,handoff);
  }
  function clearOwnedTransferUnlocked(source,handoff){
    if(!ownsTransfer(source,handoff)) return false;
    removeKey(HANDOFF_KEY);
    removeKey(SOURCE_KEY);
    return true;
  }
  async function withTransferLock(fn){
    const locks=globalThis.navigator?.locks;
    if(!locks?.request) throw new Error('이 브라우저에서는 안전한 다중 탭 전송을 지원하지 않습니다. 최신 브라우저에서 다시 시도해 주세요.');
    return locks.request(LOCK_NAME,{mode:'exclusive'},fn);
  }
  async function clearOwnedTransferExclusive(source,handoff){return withTransferLock(()=>clearOwnedTransferUnlocked(source,handoff));}
  async function withReviewLock(fn){
    const locks=globalThis.navigator?.locks;
    if(locks?.request) return locks.request(REVIEW_LOCK_NAME,{mode:'exclusive'},fn);
    return fn();
  }

  function amountCheck(value){
    const raw=String(value??'').trim();
    if(!raw) return {ok:true,raw:'',number:0};
    const number=Number(raw);
    return {ok:Number.isFinite(number)&&number>=0&&number<=MAX_SAFE_AMOUNT,raw,number};
  }
  function validateQuoteAmounts(quote){
    let total=0;
    for(const id of ITEMS){
      const item=quote?.items?.[id];
      const checked=amountCheck(item?.amount);
      if(!checked.ok) throw new Error(`${item?.name||id} 금액이 브라우저에서 안전하게 계산할 수 있는 범위를 벗어났습니다.`);
      total+=checked.number;
      if(!Number.isFinite(total)||total>MAX_SAFE_AMOUNT) throw new Error('한 업체의 입력 금액 합계가 브라우저에서 안전하게 계산할 수 있는 범위를 벗어났습니다.');
    }
    return true;
  }
  function flatKey(id,vendor,kind){return `${id}:${vendor}:${kind}`;}
  function quoteToFlat(quote,target){
    if(!isValidQuote(quote)||!VENDORS.includes(target)) throw new Error('유효한 견적과 업체 칸이 필요합니다.');
    validateQuoteAmounts(quote);
    const out={};
    for(const id of ITEMS){
      const item=quote.items[id];
      out[flatKey(id,target,'state')]=item.state;
      out[flatKey(id,target,'amount')]=String(item.amount??'');
    }
    return out;
  }
  function mergeFlat(existing,incoming){return {...(existing||{}),...(incoming||{})};}
  function readDomFlat(root=document){
    const out={};
    for(const id of ITEMS){
      const row=$(`[data-compare-row="${id}"]`,root);
      if(!row) continue;
      for(const vendor of VENDORS){
        const state=$(`[data-vendor="${vendor}"][data-state]`,row);
        const amount=$(`[data-vendor="${vendor}"][data-amount]`,row);
        if(state) out[flatKey(id,vendor,'state')]=state.value;
        if(amount) out[flatKey(id,vendor,'amount')]=amount.value;
      }
    }
    return out;
  }
  function compareFieldKey(el){
    const row=el?.closest?.('[data-compare-row]');
    const id=row?.dataset?.compareRow||'';
    const vendor=el?.dataset?.vendor||'';
    const kind=el?.hasAttribute?.('data-state')?'state':el?.hasAttribute?.('data-amount')?'amount':'';
    return ITEMS.includes(id)&&VENDORS.includes(vendor)&&kind?flatKey(id,vendor,kind):'';
  }
  function readDomFlatKeys(keys,root=document){
    const out={};
    for(const key of keys||[]){
      const [id,vendor,kind]=String(key).split(':');
      if(!ITEMS.includes(id)||!VENDORS.includes(vendor)||!['state','amount'].includes(kind)) continue;
      const row=$(`[data-compare-row="${id}"]`,root);
      const el=row&&$(`[data-vendor="${vendor}"][data-${kind}]`,row);
      if(el) out[key]=el.value;
    }
    return out;
  }
  function replaceDomFlat(flat,root=document){
    for(const id of ITEMS){
      const row=$(`[data-compare-row="${id}"]`,root);
      if(!row) continue;
      for(const vendor of VENDORS){
        const state=$(`[data-vendor="${vendor}"][data-state]`,row);
        const amount=$(`[data-vendor="${vendor}"][data-amount]`,row);
        const stateKey=flatKey(id,vendor,'state'),amountKey=flatKey(id,vendor,'amount');
        if(state) setField(state,VALID_STATES.has(flat?.[stateKey])?flat[stateKey]:'missing');
        if(amount) setField(amount,flat?.[amountKey]==null?'':flat[amountKey]);
      }
    }
  }
  function hasTargetFields(target,root=document){
    if(!VENDORS.includes(target)) return false;
    return ITEMS.every(id=>{
      const row=$(`[data-compare-row="${id}"]`,root);
      return !!row&&!!$(`[data-vendor="${target}"][data-state]`,row)&&!!$(`[data-vendor="${target}"][data-amount]`,row);
    });
  }
  function setField(el,value){
    if(!el||value==null) return;
    const next=String(value);
    if(el.value===next) return;
    el.value=next;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function applyFlatToDom(flat,root=document){
    let applied=0;
    for(const [key,value] of Object.entries(flat||{})){
      const [id,vendor,kind]=key.split(':');
      if(!ITEMS.includes(id)||!VENDORS.includes(vendor)||!['state','amount'].includes(kind)) continue;
      const row=$(`[data-compare-row="${id}"]`,root);
      if(!row) continue;
      const el=$(`[data-vendor="${vendor}"][data-${kind}]`,row);
      if(!el) continue;
      setField(el,value);
      applied++;
    }
    return applied;
  }
  function vendorAmountInputs(vendor,root=document){
    return ITEMS.map(id=>$(`[data-compare-row="${id}"] [data-vendor="${vendor}"][data-amount]`,root)).filter(Boolean);
  }
  function sanitizeVendorAmounts(vendor,root=document,status=null,dispatch=false){
    let total=0,changed=false;
    for(const el of vendorAmountInputs(vendor,root)){
      const checked=amountCheck(el.value);
      const nextTotal=total+(checked.ok?checked.number:0);
      if(!checked.ok||!Number.isFinite(nextTotal)||nextTotal>MAX_SAFE_AMOUNT){
        if(el.value!==''){
          el.value='';changed=true;
          if(dispatch){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
        }
        continue;
      }
      total=nextTotal;
    }
    if(changed&&status) status.textContent='안전하게 계산할 수 없는 금액 입력을 비웠습니다. 0 이상의 유한한 금액으로 다시 입력해 주세요.';
    return {changed,total};
  }
  function sanitizeAllAmounts(root=document,status=null,dispatch=false){
    let changed=false;
    for(const vendor of VENDORS) changed=sanitizeVendorAmounts(vendor,root,status,dispatch).changed||changed;
    return !changed;
  }
  function bindAmountGuard(host,status){
    if(!host) return;
    const guard=e=>{
      const el=e.target?.closest?.('[data-vendor][data-amount]');
      if(!el||!host.contains(el)) return;
      sanitizeVendorAmounts(el.dataset.vendor,host,status,false);
    };
    host.addEventListener('input',guard,true);
    host.addEventListener('change',guard,true);
  }

  function vendorMetaFromQuote(quote,source){
    return {context:quote.context&&typeof quote.context==='object'?quote.context:{},items:quote.items,transferId:source?.transferId||null,importedAt:new Date().toISOString()};
  }
  function saveReview(review){
    review.updatedAt=new Date().toISOString();
    if(!writeJSON(REVIEW_KEY,review)) throw new Error('비교 상태를 저장하지 못했습니다.');
    return review;
  }
  function replaceReview(target,next){
    target.version=next.version;target.flat=next.flat;target.vendors=next.vendors;target.updatedAt=next.updatedAt;return target;
  }
  async function commitReview(target,quote,source,currentReview,host){
    if(!hasTargetFields(target,host)) throw new Error('현재 비교표 구조가 예상과 다릅니다.');
    const incoming=quoteToFlat(quote,target);
    return withReviewLock(()=>{
      const persisted=readJSON(REVIEW_KEY,null);
      const next=normalizeReview(persisted||{flat:readDomFlat(host),vendors:currentReview?.vendors,updatedAt:currentReview?.updatedAt});
      next.flat=mergeFlat(next.flat,incoming);
      next.vendors[target]=vendorMetaFromQuote(quote,source);
      saveReview(next);
      return {incoming,next};
    });
  }
  async function commitAutosave(review,host,keys,guard=()=>true){
    return withReviewLock(()=>{
      if(!guard()) return null;
      const persisted=readJSON(REVIEW_KEY,null);
      const next=normalizeReview(persisted||{flat:readDomFlat(host),vendors:review?.vendors,updatedAt:review?.updatedAt});
      next.flat=mergeFlat(next.flat,readDomFlatKeys(keys,host));
      saveReview(next);
      replaceReview(review,next);
      return next;
    });
  }

  function ensureStatus(){
    let el=$('[data-v41-shell-status]');
    if(el) return el;
    const host=$('[data-compare-table]');
    if(!host) return null;
    el=document.createElement('div');el.className='notice';el.dataset.v41ShellStatus='';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.textContent='견적 비교 준비';host.before(el);return el;
  }
  function injectPreview(transfer){
    const host=$('[data-compare-table]');
    if(!host||$('[data-v41-shell-preview]')) return;
    const wrap=document.createElement('section');wrap.dataset.v41ShellPreview='';wrap.className='notice';
    const title=document.createElement('strong');title.textContent=`${transfer.handoff.target.toUpperCase()} 업체로 견적 가져오기`;
    const p=document.createElement('p');p.textContent='상태·금액은 현재 비교표에 채우고, 평수·사양·수량·메모는 업체별 상세 정보로 함께 저장합니다.';
    const apply=document.createElement('button');apply.type='button';apply.dataset.v41ShellApply='';apply.textContent='비교표에 적용';
    const cancel=document.createElement('button');cancel.type='button';cancel.dataset.v41ShellCancel='';cancel.textContent='취소';
    wrap.append(title,p,apply,cancel);host.before(wrap);
  }
  function hidePreview(){const el=$('[data-v41-shell-preview]');if(el)el.remove();}
  function reconcileCleanupMiss(review,status){
    const current=readTransfer();
    if(current.quote){
      injectPreview(current);
      if(status) status.textContent=`${current.handoff.target.toUpperCase()} 업체의 새 handoff가 감지되어 기존 정리 대상을 건드리지 않았습니다. 새 미리보기를 확인하세요.`;
    }else if(current.source||current.handoff){
      if(status) status.textContent='정리 대상이 다른 탭에서 변경되어 현재 전송 데이터를 보존했습니다. 새로고침해 최신 상태를 다시 확인하세요.';
    }else if(status){
      status.textContent=Object.keys(review.flat).length?'다른 탭에서 handoff가 이미 정리되었습니다. 저장된 비교표를 복원했습니다.':'다른 탭에서 handoff가 이미 정리되었습니다. 새 견적을 가져올 준비가 됐습니다.';
    }
    return current;
  }
  function bindReviewAutosave(review,status){
    const host=$('[data-compare-table]');if(!host) return null;
    let timer=0,epoch=0,syncing=false;
    const dirty=new Set();
    const schedule=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{flush().catch(()=>{});},20);
    };
    const mark=e=>{
      if(syncing) return;
      const key=compareFieldKey(e.target);
      if(!key) return;
      dirty.add(key);
      schedule();
    };
    const flush=async()=>{
      clearTimeout(timer);timer=0;
      if(!dirty.size) return review;
      const keys=[...dirty];dirty.clear();
      const token=epoch;
      try{
        const next=await commitAutosave(review,host,keys,()=>token===epoch);
        if(!next&&token!==epoch) return review;
        return next||review;
      }catch(err){
        for(const key of keys) dirty.add(key);
        if(status) status.textContent='비교 상태를 저장하지 못했습니다. 현재 화면 값은 유지되지만 새로고침하면 사라질 수 있습니다.';
        throw err;
      }
    };
    const invalidate=()=>{
      epoch++;clearTimeout(timer);timer=0;dirty.clear();
    };
    const applyRemote=raw=>{
      const localPatch=raw==null?{}:readDomFlatKeys([...dirty],host);
      if(raw==null) invalidate();
      else {epoch++;clearTimeout(timer);timer=0;}
      let next=blankReview();
      if(raw!=null){
        try{next=normalizeReview(JSON.parse(raw));}catch{return;}
      }
      replaceReview(review,next);
      syncing=true;
      try{
        replaceDomFlat(next.flat,host);
        if(raw!=null&&Object.keys(localPatch).length) applyFlatToDom(localPatch,host);
      }finally{syncing=false;}
      if(raw!=null&&Object.keys(localPatch).length){
        for(const key of Object.keys(localPatch)) dirty.add(key);
        schedule();
      }
      if(status) status.textContent=raw==null?'다른 탭에서 비교표가 초기화되어 현재 탭도 동기화했습니다.':'다른 탭의 비교표 변경을 현재 탭에 반영했습니다.';
    };
    host.addEventListener('input',mark);host.addEventListener('change',mark);
    return {flush,invalidate,applyRemote,isSyncing:()=>syncing,dirtyKeys:()=>[...dirty]};
  }

  function init(){
    const host=$('[data-compare-table]');if(!host) return;
    const status=ensureStatus();
    let review=normalizeReview(readJSON(REVIEW_KEY,blankReview()));
    bindAmountGuard(host,status);
    const autosave=bindReviewAutosave(review,status);
    const reset=$('[data-reset-compare]');
    reset?.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      autosave?.invalidate();
      withReviewLock(()=>{
        removeKey(REVIEW_KEY);
        removeKey('interior-compare-v5');
        removeKey('interior-compare-v6');
      }).finally(()=>location.reload());
    },true);
    applyFlatToDom(review.flat,host);
    sanitizeAllAmounts(host,status,true);

    let transfer=readTransfer();
    if(transfer.quote){
      injectPreview(transfer);
      if(status) status.textContent=`${transfer.handoff.target.toUpperCase()} 업체 handoff 감지 · 자동 적용하지 않음`;
    }else if(isStaleExactPair(transfer.source,transfer.handoff)){
      if(status) status.textContent='30분이 지난 handoff를 안전하게 정리하는 중입니다.';
      clearOwnedTransferExclusive(transfer.source,transfer.handoff).then(cleared=>{
        if(cleared){
          transfer={source:null,handoff:null,quote:null};
          if(status) status.textContent=Object.keys(review.flat).length?'오래된 handoff 정리 완료 · 저장된 비교표를 복원했습니다.':'오래된 handoff 정리 완료 · 새 견적을 가져올 준비가 됐습니다.';
        }else transfer=reconcileCleanupMiss(review,status);
      }).catch(err=>{if(status) status.textContent=`오래된 handoff를 안전하게 정리하지 못했습니다. ${String(err?.message||err)}`;});
    }else if(exactPair(transfer.source,transfer.handoff)){
      if(status) status.textContent='적용할 수 없는 handoff를 안전하게 정리하는 중입니다.';
      clearOwnedTransferExclusive(transfer.source,transfer.handoff).then(cleared=>{
        if(cleared){
          transfer={source:null,handoff:null,quote:null};
          if(status) status.textContent=Object.keys(review.flat).length?'유효하지 않은 handoff 정리 완료 · 저장된 비교표를 복원했습니다.':'유효하지 않은 handoff 정리 완료 · 새 견적을 가져올 준비가 됐습니다.';
        }else transfer=reconcileCleanupMiss(review,status);
      }).catch(err=>{if(status) status.textContent=`유효하지 않은 handoff를 안전하게 정리하지 못했습니다. ${String(err?.message||err)}`;});
    }else if(status){
      status.textContent=Object.keys(review.flat).length?'저장된 비교표를 복원했습니다.':'handoff 없음 · 새 견적을 가져올 준비가 됐습니다.';
    }

    document.addEventListener('click',async e=>{
      const apply=e.target.closest?.('[data-v41-shell-apply]');
      if(apply){
        apply.disabled=true;
        const persisted=readTransfer();
        if(!sameTransferSnapshot(persisted,transfer)){
          if(isStaleExactPair(persisted.source,persisted.handoff)&&persisted.handoff?.transferId===transfer.handoff?.transferId&&persisted.handoff?.createdAt===transfer.handoff?.createdAt){
            try{await clearOwnedTransferExclusive(transfer.source,transfer.handoff);}catch{}
          }
          hidePreview();if(status) status.textContent='handoff가 만료되었거나 다른 탭에서 변경되어 기존 미리보기를 적용하지 않았습니다.';transfer={source:null,handoff:null,quote:null};return;
        }
        const target=transfer.handoff.target;
        let committed;
        try{
          await autosave?.flush();
          committed=await commitReview(target,transfer.quote,transfer.source,review,host);
        }catch(err){apply.disabled=false;if(status) status.textContent=`적용하지 않았습니다. ${String(err?.message||err)}`;return;}
        replaceReview(review,committed.next);
        applyFlatToDom(committed.incoming,host);
        try{
          const cleared=await clearOwnedTransferExclusive(transfer.source,transfer.handoff);
          hidePreview();
          if(status) status.textContent=cleared?`${target.toUpperCase()} 업체 적용 완료 · 비교 상태를 저장했습니다.`:`${target.toUpperCase()} 업체 적용 완료 · 다른 탭의 새 전송은 그대로 보존했습니다.`;
          transfer={source:null,handoff:null,quote:null};
        }catch(err){
          apply.disabled=true;const cancel=$('[data-v41-shell-cancel]');if(cancel){cancel.disabled=false;cancel.textContent='전송 데이터 정리 재시도';}
          if(status) status.textContent=`${target.toUpperCase()} 업체 적용 저장은 완료됐지만 임시 전송 데이터를 안전하게 정리하지 못했습니다. ${String(err?.message||err)}`;
        }
        return;
      }
      const cancel=e.target.closest?.('[data-v41-shell-cancel]');
      if(cancel){
        cancel.disabled=true;
        try{
          const cleared=await clearOwnedTransferExclusive(transfer.source,transfer.handoff);
          hidePreview();if(status) status.textContent=cleared?'가져오기를 취소했습니다. 기존 비교표는 유지됩니다.':'현재 미리보기는 취소했고 다른 탭의 새 전송은 건드리지 않았습니다.';transfer={source:null,handoff:null,quote:null};
        }catch(err){cancel.disabled=false;if(status) status.textContent=`가져오기 취소를 안전하게 완료하지 못했습니다. ${String(err?.message||err)}`;}
      }
    });

    window.addEventListener('storage',e=>{
      if(e.key===REVIEW_KEY){
        autosave?.applyRemote(e.newValue);
        return;
      }
      if(![SOURCE_KEY,HANDOFF_KEY].includes(e.key)) return;
      const persisted=readTransfer();
      if(!sameTransferSnapshot(persisted,transfer)){
        hidePreview();if(status) status.textContent='다른 탭에서 source 또는 handoff snapshot이 변경되어 기존 미리보기를 무효화했습니다.';transfer={source:null,handoff:null,quote:null};
      }
    });
  }

  window.InteriorQuoteCompareAdapter41={
    SOURCE_KEY,HANDOFF_KEY,REVIEW_KEY,LOCK_NAME,REVIEW_LOCK_NAME,MAX_SAFE_AMOUNT,ITEMS,VENDORS,
    isValidQuote,isFreshHandoff,getMatchedQuote,readTransfer,
    sameSourceSnapshot,sameHandoffSnapshot,sameTransferSnapshot,exactPair,isStaleExactPair,ownsTransfer,
    withTransferLock,clearOwnedTransferExclusive,
    amountCheck,validateQuoteAmounts,sanitizeVendorAmounts,sanitizeAllAmounts,bindAmountGuard,
    quoteToFlat,mergeFlat,readDomFlat,readDomFlatKeys,replaceDomFlat,compareFieldKey,hasTargetFields,applyFlatToDom,normalizeReview,commitReview,commitAutosave,bindReviewAutosave,reconcileCleanupMiss,withReviewLock,init
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

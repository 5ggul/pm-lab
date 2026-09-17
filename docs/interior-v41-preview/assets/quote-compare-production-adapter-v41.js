(() => {
  'use strict';

  const SOURCE_KEY='interior-quote-source-v41';
  const HANDOFF_KEY='interior-quote-compare-handoff-v41';
  const REVIEW_KEY='interior-quote-compare-shell-v41';
  const LOCK_NAME='interior-v41-handoff-write-v41';
  const HANDOFF_MAX_AGE_MS=30*60*1000;
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

  function blankReview(){
    return {version:1,flat:{},vendors:{a:null,b:null,c:null},updatedAt:null};
  }
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
  function ownsTransfer(source,handoff){
    const persistedSource=readJSON(SOURCE_KEY,null);
    const persistedHandoff=readJSON(HANDOFF_KEY,null);
    return !!getMatchedQuote(persistedSource,persistedHandoff)
      && persistedSource.transferId===source?.transferId
      && persistedSource.createdAt===source?.createdAt
      && persistedHandoff.transferId===handoff?.transferId
      && persistedHandoff.createdAt===handoff?.createdAt;
  }
  function clearOwnedTransferUnlocked(source,handoff){
    if(!ownsTransfer(source,handoff)) return false;
    removeKey(HANDOFF_KEY);
    removeKey(SOURCE_KEY);
    return true;
  }
  function isProductionShell(){
    try{return location.pathname.includes('/production-shell/quote-compare/');}catch{return false;}
  }
  async function withTransferLock(fn){
    const locks=globalThis.navigator?.locks;
    if(locks?.request) return locks.request(LOCK_NAME,{mode:'exclusive'},fn);
    if(isProductionShell()) throw new Error('이 브라우저에서는 다중 탭 전송 보호를 사용할 수 없습니다. 최신 브라우저에서 다시 시도해 주세요.');
    return fn();
  }
  async function clearOwnedTransferExclusive(source,handoff){
    return withTransferLock(()=>clearOwnedTransferUnlocked(source,handoff));
  }

  function flatKey(id,vendor,kind){return `${id}:${vendor}:${kind}`;}
  function quoteToFlat(quote,target){
    if(!isValidQuote(quote)||!VENDORS.includes(target)) throw new Error('유효한 견적과 업체 칸이 필요합니다.');
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
  function vendorMetaFromQuote(quote,source){
    return {
      context:quote.context&&typeof quote.context==='object'?quote.context:{},
      items:quote.items,
      transferId:source?.transferId||null,
      importedAt:new Date().toISOString()
    };
  }
  function saveReview(review){
    review.updatedAt=new Date().toISOString();
    if(!writeJSON(REVIEW_KEY,review)) throw new Error('검수용 비교 상태를 저장하지 못했습니다.');
    return review;
  }
  function commitReview(target,quote,source,currentReview,host){
    if(!hasTargetFields(target,host)) throw new Error('현재 비교표 구조가 검수 기준과 다릅니다.');
    const incoming=quoteToFlat(quote,target);
    const next=normalizeReview(currentReview);
    next.flat=mergeFlat(readDomFlat(host),incoming);
    next.vendors[target]=vendorMetaFromQuote(quote,source);
    saveReview(next);
    return {incoming,next};
  }
  function replaceReview(target,next){
    target.version=next.version;
    target.flat=next.flat;
    target.vendors=next.vendors;
    target.updatedAt=next.updatedAt;
    return target;
  }

  function ensureStatus(){
    let el=$('[data-v41-shell-status]');
    if(el) return el;
    const host=$('[data-compare-table]');
    if(!host) return null;
    el=document.createElement('div');
    el.className='notice';
    el.dataset.v41ShellStatus='';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.textContent='v41 production-shell 검수 준비';
    host.before(el);
    return el;
  }
  function injectPreview(transfer){
    const host=$('[data-compare-table]');
    if(!host||$('[data-v41-shell-preview]')) return;
    const wrap=document.createElement('section');
    wrap.dataset.v41ShellPreview='';
    wrap.className='notice';
    const title=document.createElement('strong');
    title.textContent=`${transfer.handoff.target.toUpperCase()} 업체로 견적 가져오기`;
    const p=document.createElement('p');
    p.textContent='상태·금액은 현재 비교표에 채우고, 평수·사양·수량·메모는 검수용 metadata에 보존합니다.';
    const apply=document.createElement('button');apply.type='button';apply.dataset.v41ShellApply='';apply.textContent='미리보기 적용';
    const cancel=document.createElement('button');cancel.type='button';cancel.dataset.v41ShellCancel='';cancel.textContent='취소';
    wrap.append(title,p,apply,cancel);
    host.before(wrap);
  }
  function hidePreview(){const el=$('[data-v41-shell-preview]');if(el)el.remove();}

  function guardProductionButtons(status){
    const save=$('[data-save-compare]');
    const reset=$('[data-reset-compare]');
    for(const btn of [save,reset].filter(Boolean)){
      btn.dataset.v41Guarded='';
      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        if(status) status.textContent='v41 검수 화면에서는 운영 compare 저장키를 변경하지 않습니다.';
      },true);
    }
  }

  function bindReviewAutosave(review,status){
    const host=$('[data-compare-table]');
    if(!host) return;
    let timer=0;
    const save=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        review.flat=readDomFlat(host);
        try{
          saveReview(review);
        }catch{
          if(status) status.textContent='검수용 비교 상태를 저장하지 못했습니다. 현재 화면 값은 유지되지만 새로고침하면 사라질 수 있습니다.';
        }
      },20);
    };
    host.addEventListener('input',save);
    host.addEventListener('change',save);
  }

  function init(){
    const host=$('[data-compare-table]');
    if(!host) return;
    const status=ensureStatus();
    let review=normalizeReview(readJSON(REVIEW_KEY,blankReview()));
    applyFlatToDom(review.flat,host);
    guardProductionButtons(status);
    bindReviewAutosave(review,status);

    let transfer=readTransfer();
    if(transfer.quote){
      injectPreview(transfer);
      if(status) status.textContent=`${transfer.handoff.target.toUpperCase()} 업체 handoff 감지 · 자동 적용하지 않음`;
    }else if(status){
      status.textContent=Object.keys(review.flat).length?'검수용 저장 비교표를 복원했습니다.':'handoff 없음 · 검수용 production-shell 대기';
    }

    document.addEventListener('click',async e=>{
      const apply=e.target.closest?.('[data-v41-shell-apply]');
      if(apply){
        apply.disabled=true;
        const persisted=readTransfer();
        if(!persisted.quote||persisted.handoff?.transferId!==transfer.handoff?.transferId||persisted.handoff?.createdAt!==transfer.handoff?.createdAt){
          hidePreview();
          if(status) status.textContent='다른 탭에서 handoff가 변경되어 기존 미리보기를 적용하지 않았습니다.';
          return;
        }
        const target=transfer.handoff.target;
        let committed;
        try{
          committed=commitReview(target,transfer.quote,transfer.source,review,host);
        }catch(err){
          apply.disabled=false;
          if(status) status.textContent=`적용하지 않았습니다. ${String(err?.message||err)}`;
          return;
        }
        replaceReview(review,committed.next);
        applyFlatToDom(committed.incoming,host);
        try{
          const cleared=await clearOwnedTransferExclusive(transfer.source,transfer.handoff);
          hidePreview();
          if(status) status.textContent=cleared
            ? `${target.toUpperCase()} 업체 적용 완료 · 운영 저장키는 변경하지 않았습니다.`
            : `${target.toUpperCase()} 업체 적용 완료 · 다른 탭의 새 전송은 그대로 보존했습니다.`;
          transfer={source:null,handoff:null,quote:null};
        }catch(err){
          apply.disabled=true;
          const cancel=$('[data-v41-shell-cancel]');if(cancel){cancel.disabled=false;cancel.textContent='전송 데이터 정리 재시도';}
          if(status) status.textContent=`${target.toUpperCase()} 업체 적용 저장은 완료됐지만 임시 전송 데이터를 안전하게 정리하지 못했습니다. ${String(err?.message||err)}`;
        }
        return;
      }
      const cancel=e.target.closest?.('[data-v41-shell-cancel]');
      if(cancel){
        cancel.disabled=true;
        try{
          const cleared=await clearOwnedTransferExclusive(transfer.source,transfer.handoff);
          hidePreview();
          if(status) status.textContent=cleared?'가져오기를 취소했습니다. 기존 검수용 비교표는 유지됩니다.':'현재 미리보기는 취소했고 다른 탭의 새 전송은 건드리지 않았습니다.';
          transfer={source:null,handoff:null,quote:null};
        }catch(err){
          cancel.disabled=false;
          if(status) status.textContent=`가져오기 취소를 안전하게 완료하지 못했습니다. ${String(err?.message||err)}`;
        }
      }
    });

    window.addEventListener('storage',e=>{
      if(![SOURCE_KEY,HANDOFF_KEY].includes(e.key)) return;
      const persisted=readTransfer();
      if(!transfer.handoff||!persisted.handoff||persisted.handoff.transferId!==transfer.handoff.transferId||persisted.handoff.createdAt!==transfer.handoff.createdAt){
        hidePreview();
        if(status) status.textContent='다른 탭에서 handoff가 변경되어 기존 미리보기를 무효화했습니다.';
        transfer={source:null,handoff:null,quote:null};
      }
    });
  }

  window.InteriorProductionCompareAdapter41={
    SOURCE_KEY,HANDOFF_KEY,REVIEW_KEY,LOCK_NAME,ITEMS,VENDORS,
    isValidQuote,isFreshHandoff,getMatchedQuote,readTransfer,
    withTransferLock,clearOwnedTransferExclusive,
    quoteToFlat,mergeFlat,readDomFlat,hasTargetFields,applyFlatToDom,normalizeReview,commitReview,init
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
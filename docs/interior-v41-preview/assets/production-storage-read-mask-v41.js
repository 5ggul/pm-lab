(() => {
  'use strict';
  const PROTECTED_KEYS=new Set([
    'interior-quote-v5',
    'interior-compare-v5',
    'interior-compare-v6'
  ]);
  function isAllowedContext(){
    try{return location.pathname.includes('/production-shell/')||globalThis.__INTERIOR_V41_STORAGE_MASK_TEST__===true;}catch{return globalThis.__INTERIOR_V41_STORAGE_MASK_TEST__===true;}
  }
  if(!isAllowedContext()) return;
  if(globalThis.InteriorProductionStorageReadMask41) return;
  if(document.readyState==='complete') return;
  const proto=globalThis.Storage?.prototype;
  if(!proto||typeof proto.getItem!=='function') return;
  const originalGetItem=proto.getItem;
  let active=true;
  function maskedGetItem(key){
    if(PROTECTED_KEYS.has(String(key))) return null;
    return originalGetItem.call(this,key);
  }
  function restore(){
    if(!active) return;
    if(proto.getItem===maskedGetItem) proto.getItem=originalGetItem;
    active=false;
  }
  proto.getItem=maskedGetItem;
  window.InteriorProductionStorageReadMask41={
    PROTECTED_KEYS:[...PROTECTED_KEYS],
    isAllowedContext,
    restore,
    get active(){return active;}
  };
  window.addEventListener('DOMContentLoaded',restore,{once:true});
  window.addEventListener('load',restore,{once:true});
})();

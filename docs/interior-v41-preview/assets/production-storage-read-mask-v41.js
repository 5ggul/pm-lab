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

  const proto=globalThis.Storage?.prototype;
  if(!proto||typeof proto.getItem!=='function'||typeof proto.setItem!=='function'||typeof proto.removeItem!=='function') return;

  const originalGetItem=proto.getItem;
  const originalSetItem=proto.setItem;
  const originalRemoveItem=proto.removeItem;
  let readMaskActive=document.readyState!=='complete';

  function maskedGetItem(key){
    if(PROTECTED_KEYS.has(String(key))) return null;
    return originalGetItem.call(this,key);
  }
  function shieldedSetItem(key,value){
    if(PROTECTED_KEYS.has(String(key))) return;
    return originalSetItem.call(this,key,value);
  }
  function shieldedRemoveItem(key){
    if(PROTECTED_KEYS.has(String(key))) return;
    return originalRemoveItem.call(this,key);
  }
  function restoreRead(){
    if(!readMaskActive) return;
    if(proto.getItem===maskedGetItem) proto.getItem=originalGetItem;
    readMaskActive=false;
  }

  if(readMaskActive) proto.getItem=maskedGetItem;
  proto.setItem=shieldedSetItem;
  proto.removeItem=shieldedRemoveItem;

  window.InteriorProductionStorageReadMask41={
    PROTECTED_KEYS:[...PROTECTED_KEYS],
    isAllowedContext,
    restore:restoreRead,
    get active(){return readMaskActive;},
    get writeShieldActive(){return proto.setItem===shieldedSetItem&&proto.removeItem===shieldedRemoveItem;}
  };

  if(readMaskActive){
    window.addEventListener('DOMContentLoaded',restoreRead,{once:true});
    window.addEventListener('load',restoreRead,{once:true});
  }
})();

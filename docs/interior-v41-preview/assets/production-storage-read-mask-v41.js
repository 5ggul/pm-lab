(() => {
  'use strict';
  const PROTECTED_KEYS=new Set([
    'interior-quote-v5',
    'interior-compare-v5',
    'interior-compare-v6'
  ]);
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
    restore,
    get active(){return active;}
  };
  window.addEventListener('DOMContentLoaded',restore,{once:true});
})();

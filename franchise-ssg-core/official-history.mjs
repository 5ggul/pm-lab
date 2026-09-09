const finiteOrNull=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

function storeFlowValues(row={}){
  return [
    finiteOrNull(row?.stores),
    finiteOrNull(row?.newStores),
    finiteOrNull(row?.contractEnd??row?.ended),
    finiteOrNull(row?.contractCancel??row?.cancelled)
  ];
}

export function isPlaceholderStoreHistoryRow(row){
  if(finiteOrNull(row?.year)===null)return false;
  const values=storeFlowValues(row);
  return values.every(value=>value===0);
}

export function hasPositiveStoreHistoryObservation(row){
  return storeFlowValues(row).some(value=>value!==null&&value>0);
}

export function sanitizeOfficialStoreHistory(rows=[]){
  const list=Array.isArray(rows)?rows:[];
  const hasPositiveObservation=list.some(hasPositiveStoreHistoryObservation);
  if(!hasPositiveObservation)return [...list];
  return list.filter(row=>!isPlaceholderStoreHistoryRow(row));
}

export function summarizeStoreHistorySuppression(rows=[]){
  const list=Array.isArray(rows)?rows:[];
  const sanitized=sanitizeOfficialStoreHistory(list);
  const kept=new Set(sanitized);
  const suppressed=list.filter(row=>!kept.has(row));
  return {sanitized,suppressed};
}

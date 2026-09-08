const norm=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const finiteOrNull=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};

export function normalizeBrandName(value){return norm(value)}

function groupByName(records=[]){
  const groups=new Map();
  for(const record of records){
    const key=norm(record?.brandName??record?.name);
    if(!key)continue;
    const rows=groups.get(key)||[];rows.push(record);groups.set(key,rows);
  }
  return groups;
}

export function matchOfficialBrands(catalogBrands=[],officialDoc={}){
  const records=Array.isArray(officialDoc?.records)?officialDoc.records:[];
  const groups=groupByName(records);
  const matches=[];const unmatched=[];const ambiguous=[];
  for(const brand of catalogBrands){
    const exactKey=norm(brand?.name);const exact=groups.get(exactKey)||[];
    if(exact.length===1){matches.push({brand,record:exact[0],method:'EXACT',key:exactKey});continue}
    if(exact.length>1){ambiguous.push({name:brand.name,method:'EXACT',key:exactKey,candidates:exact.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))});continue}
    const aliasKeys=[...new Set((brand?.aliases||[]).map(norm).filter(k=>k&&k!==exactKey&&k.length>=2))];
    const candidateMap=new Map();
    for(const key of aliasKeys){const rows=groups.get(key)||[];for(const r of rows)candidateMap.set(`${norm(r.name||r.brandName)}|${norm(r.corp)}|${norm(r.industryMajor)}`,r)}
    const candidates=[...candidateMap.values()];
    if(candidates.length===1){matches.push({brand,record:candidates[0],method:'ALIAS',key:aliasKeys.find(k=>(groups.get(k)||[]).includes(candidates[0]))||null});continue}
    if(candidates.length>1){ambiguous.push({name:brand.name,method:'ALIAS',keys:aliasKeys,candidates:candidates.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))});continue}
    unmatched.push({name:brand.name,slug:brand.slug||null,aliases:brand.aliases||[]});
  }
  const matchedRecords=new Set(matches.map(x=>x.record));
  const officialOnly=records.filter(r=>!matchedRecords.has(r)).map(r=>({name:r.name||r.brandName||null,corp:r.corp||null,industryMajor:r.industryMajor||null}));
  const duplicateOfficialNames=[...groups.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,count:rows.length,candidates:rows.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))}));
  return {matches,unmatched,ambiguous,officialOnly,duplicateOfficialNames,totalCatalog:catalogBrands.length,totalOfficial:records.length};
}

export function mergeBrandWithOfficial(brand,record){
  const currentStore=(record?.storeHistory||[]).find(x=>Number(x.year)===Number(record?.referenceYear))||null;
  const previousStore=(record?.storeHistory||[]).find(x=>Number(x.year)===Number(record?.previousReferenceYear))||null;
  return {
    ...brand,
    corp:record?.corp||brand?.corp||null,
    cost:finiteOrNull(record?.startupCost10k),
    stores:finiteOrNull(record?.stores??currentStore?.stores),
    lastStores:finiteOrNull(record?.previousStores??previousStore?.stores),
    direct:finiteOrNull(record?.directStores),
    sales:finiteOrNull(record?.averageSales10k??currentStore?.averageSales10k),
    fee:finiteOrNull(record?.startupFee10k),
    education:finiteOrNull(record?.startupEducation10k),
    deposit:finiteOrNull(record?.startupDeposit10k),
    interior:finiteOrNull(record?.startupInterior10k),
    other:finiteOrNull(record?.startupEtc10k),
    regions:record?.regions&&typeof record.regions==='object'?record.regions:{},
    dataMode:'FTC_OFFICIAL',
    official:{
      referenceYear:record?.referenceYear??null,
      historyYears:record?.historyYears||[],
      generatedAt:record?.generatedAt||null,
      sourceUrl:record?.sourceUrl||record?.source?.url||null,
      source:record?.source||null,
      storeHistory:record?.storeHistory||[],
      costHistory:record?.costHistory||[],
      costComponents:record?.costComponents||{},
      openClose:record?.openClose||{}
    }
  };
}

export function buildOfficialMergePlan({catalogBrands=[],officialDoc={},criticalBrandNames=[]}={}){
  const matched=matchOfficialBrands(catalogBrands,officialDoc);
  const byName=new Map(matched.matches.map(x=>[x.brand.name,x]));
  const criticalMissingMetrics=[];
  for(const name of criticalBrandNames){const hit=byName.get(name);if(!hit){criticalMissingMetrics.push({name,reason:'MATCH_MISSING'});continue}const cost=finiteOrNull(hit.record?.startupCost10k),stores=finiteOrNull(hit.record?.stores);if(cost==null||stores==null)criticalMissingMetrics.push({name,reason:'CORE_METRIC_MISSING',costReady:cost!=null,storesReady:stores!=null})}
  const snapshotReady=officialDoc?.status==='READY'&&Boolean(officialDoc?.promotion?.allowPreviewOverlay)&&Array.isArray(officialDoc?.records)&&officialDoc.records.length>0;
  const activationBlockers=[];
  if(!snapshotReady)activationBlockers.push('OFFICIAL_SNAPSHOT_NOT_READY');
  if(matched.unmatched.length)activationBlockers.push(`UNMATCHED_CATALOG:${matched.unmatched.length}`);
  if(matched.ambiguous.length)activationBlockers.push(`AMBIGUOUS_CATALOG:${matched.ambiguous.length}`);
  if(criticalMissingMetrics.length)activationBlockers.push(`CRITICAL_METRIC_MISSING:${criticalMissingMetrics.length}`);
  const active=activationBlockers.length===0;
  const matchByName=new Map(matched.matches.map(x=>[x.brand.name,x.record]));
  const mergedBrands=active?catalogBrands.map(b=>mergeBrandWithOfficial(b,matchByName.get(b.name))):catalogBrands;
  const report={
    schemaVersion:1,generatedAt:new Date().toISOString(),engineReady:true,active,
    snapshot:{status:officialDoc?.status||'MISSING',referenceYear:officialDoc?.referenceYear??null,historyYears:officialDoc?.historyYears||[],recordCount:Array.isArray(officialDoc?.records)?officialDoc.records.length:0,allowPreviewOverlay:Boolean(officialDoc?.promotion?.allowPreviewOverlay)},
    coverage:{catalogBrands:catalogBrands.length,officialRecords:matched.totalOfficial,matched:matched.matches.length,exact:matched.matches.filter(x=>x.method==='EXACT').length,alias:matched.matches.filter(x=>x.method==='ALIAS').length,unmatched:matched.unmatched.length,ambiguous:matched.ambiguous.length,officialOnly:matched.officialOnly.length},
    activationBlockers,criticalMissingMetrics,
    unmatchedCatalog:matched.unmatched,ambiguousCatalog:matched.ambiguous,duplicateOfficialNames:matched.duplicateOfficialNames,
    officialOnly:matched.officialOnly
  };
  return {active,mergedBrands,report,matches:matched.matches};
}

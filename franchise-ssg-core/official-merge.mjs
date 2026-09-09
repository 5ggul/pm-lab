const norm=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const finiteOrNull=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};

// Manually reviewed FTC naming variants only. Never add fuzzy matches here.
// Ambiguous umbrella/sub-brand cases stay outside the official core until the catalog model is explicit.
export const OFFICIAL_ALIAS_OVERRIDES=Object.freeze({
  '메가MGC커피':['메가엠지씨커피(MEGA MGC COFFEE)'],
  '컴포즈커피':['컴포즈커피(COMPOSE COFFEE)'],
  '매머드커피':['매머드커피(Mammoth coffee)'],
  '텐퍼센트커피':['텐퍼센트스페셜티커피'],
  '탐앤탐스':['탐앤탐스커피(TOMNTOMS COFFEE)'],
  'bhc치킨':['비에이치씨(BHC)'],
  'BBQ치킨':['비비큐(BBQ)'],
  '지코바치킨':['지코바양념치킨'],
  '노브랜드버거':['노브랜드 버거(No Brand Burger)'],
  '버거앤프라이즈':['버거앤프라이즈(Burger&Friez)'],
  '666버거':['666 BURGER'],
  '원할머니보쌈':['원할머니'],
  '오봉집':['오복 오봉집'],
  '유가네닭갈비':['유가네'],
  '요아정':['카페요아정'],
  '명랑핫도그':['명랑시대쌀핫도그'],
  '던킨':['던킨/던킨도너츠'],
  '역전할머니맥주':['역전할머니맥주1982'],
  '크라운호프':['크라운호프보리장인'],
  '프레퍼스':['프레퍼스다이어트푸드'],
  '샐러드박스':['샐러드박스(SaladBox)'],
  'CU':['씨유(CU)'],
  '이마트24':['이마트24(emart24)'],
  '초심스터디카페':['CHOSIM(초심)'],
  '화이트펜슬스터디카페':['화이트펜슬(white pencil)'],
  '해법수학':['스마트해법수학'],
  '잉글리시아이':['잉글리시아이(englisheye)'],
  '아소비교육':['아소비'],
  '리안헤어':['리안'],
  '워시엔조이':['워시엔조이 멤버스'],
  '티스테이션':["티스테이션(T'station)"],
  '오토오아시스':['오토오아시스(autoOasis)']
});

// Duplicate exact FTC names are never selected by store count or fuzzy scoring.
// A corporation override is allowed only after a manual review of the current disclosure identity.
export const OFFICIAL_EXACT_CORP_OVERRIDES=Object.freeze({
  '피자스쿨':'(주)씨에이치컴퍼니'
});

// Reviewed catalog rows that currently have no single safe 2025 FTC record.
// They are resolved as catalog exceptions, not silently force-matched. Their numeric fields stay null.
export const OFFICIAL_CATALOG_RESOLUTIONS=Object.freeze({
  '마제소바백소정':{status:'DUPLICATE_CANONICAL',canonicalName:'백소정',reason:'MENU_KEYWORD_DUPLICATES_CANONICAL_BRAND'},
  '피그인더가든':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '포케박스':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '샐러드로우':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '플랜에이스터디카페':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '랭스터디카페':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '윤선생':{status:'UMBRELLA_MULTIPLE_DISCLOSURES',reason:'MULTIPLE_SUBBRANDS_REQUIRE_SEPARATE_CATALOG_ROWS'},
  '눈높이러닝센터':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '튼튼영어':{status:'UMBRELLA_MULTIPLE_DISCLOSURES',reason:'MULTIPLE_SUBBRANDS_REQUIRE_SEPARATE_CATALOG_ROWS'},
  '셀피아':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '크린업24':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '런드리24':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '워시프렌즈':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '더런드리':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '스피드메이트':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '타이어뱅크':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '차차차정비':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '아르르프렌즈':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '도그마루':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '멍이요':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'},
  '펫트리':{status:'SNAPSHOT_UNCONFIRMED',reason:'NO_SINGLE_SAFE_2025_FTC_MATCH'}
});

export function normalizeBrandName(value){return norm(value)}
export function reviewedOfficialAliases(name){return OFFICIAL_ALIAS_OVERRIDES[name]||[]}
export function reviewedCatalogResolution(name){return OFFICIAL_CATALOG_RESOLUTIONS[name]||null}

function groupByName(records=[]){
  const groups=new Map();
  for(const record of records){
    const key=norm(record?.brandName??record?.name);
    if(!key)continue;
    const rows=groups.get(key)||[];rows.push(record);groups.set(key,rows);
  }
  return groups;
}

function excludedRow(brand,resolution){return {name:brand?.name||null,slug:brand?.slug||null,aliases:brand?.aliases||[],resolution}}

export function matchOfficialBrands(catalogBrands=[],officialDoc={}){
  const records=Array.isArray(officialDoc?.records)?officialDoc.records:[];
  const groups=groupByName(records);
  const matches=[];const unmatched=[];const ambiguous=[];const resolvedExcluded=[];
  for(const brand of catalogBrands){
    const resolution=reviewedCatalogResolution(brand?.name);
    const exactKey=norm(brand?.name);const exact=groups.get(exactKey)||[];
    if(exact.length===1){matches.push({brand,record:exact[0],method:'EXACT',key:exactKey});continue}
    if(exact.length>1){
      const corpOverride=OFFICIAL_EXACT_CORP_OVERRIDES[brand?.name];
      if(corpOverride){
        const reviewed=exact.filter(x=>norm(x?.corp)===norm(corpOverride));
        if(reviewed.length===1){matches.push({brand,record:reviewed[0],method:'EXACT',key:exactKey,review:'CORP_OVERRIDE'});continue}
      }
      if(resolution){resolvedExcluded.push(excludedRow(brand,resolution));continue}
      ambiguous.push({name:brand.name,method:'EXACT',key:exactKey,candidates:exact.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))});continue
    }
    const aliases=[...(brand?.aliases||[]),...reviewedOfficialAliases(brand?.name)];
    const aliasKeys=[...new Set(aliases.map(norm).filter(k=>k&&k!==exactKey&&k.length>=2))];
    const candidateMap=new Map();
    for(const key of aliasKeys){const rows=groups.get(key)||[];for(const r of rows)candidateMap.set(`${norm(r.name||r.brandName)}|${norm(r.corp)}|${norm(r.industryMajor)}`,r)}
    const candidates=[...candidateMap.values()];
    if(candidates.length===1){matches.push({brand,record:candidates[0],method:'ALIAS',key:aliasKeys.find(k=>(groups.get(k)||[]).includes(candidates[0]))||null});continue}
    if(candidates.length>1){
      if(resolution){resolvedExcluded.push(excludedRow(brand,resolution));continue}
      ambiguous.push({name:brand.name,method:'ALIAS',keys:aliasKeys,candidates:candidates.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))});continue
    }
    if(resolution){resolvedExcluded.push(excludedRow(brand,resolution));continue}
    unmatched.push({name:brand.name,slug:brand.slug||null,aliases});
  }
  const matchedRecords=new Set(matches.map(x=>x.record));
  const officialOnly=records.filter(r=>!matchedRecords.has(r)).map(r=>({name:r.name||r.brandName||null,corp:r.corp||null,industryMajor:r.industryMajor||null}));
  const duplicateOfficialNames=[...groups.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,count:rows.length,candidates:rows.map(x=>({name:x.name||x.brandName||null,corp:x.corp||null,industryMajor:x.industryMajor||null}))}));
  return {matches,unmatched,ambiguous,resolvedExcluded,officialOnly,duplicateOfficialNames,totalCatalog:catalogBrands.length,totalOfficial:records.length};
}

export function mergeBrandWithOfficial(brand,record){
  if(!record){
    return {...brand,corp:null,cost:null,stores:null,lastStores:null,direct:null,sales:null,fee:null,education:null,deposit:null,interior:null,other:null,regions:{},dataMode:'FTC_OFFICIAL_UNMATCHED',official:null};
  }
  const currentStore=(record?.storeHistory||[]).find(x=>Number(x.year)===Number(record?.referenceYear))||null;
  const previousStore=(record?.storeHistory||[]).find(x=>Number(x.year)===Number(record?.previousReferenceYear))||null;
  return {
    ...brand,
    corp:record?.corp||null,
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
    schemaVersion:2,generatedAt:new Date().toISOString(),engineReady:true,active,
    snapshot:{status:officialDoc?.status||'MISSING',referenceYear:officialDoc?.referenceYear??null,historyYears:officialDoc?.historyYears||[],recordCount:Array.isArray(officialDoc?.records)?officialDoc.records.length:0,allowPreviewOverlay:Boolean(officialDoc?.promotion?.allowPreviewOverlay)},
    coverage:{catalogBrands:catalogBrands.length,officialRecords:matched.totalOfficial,matched:matched.matches.length,exact:matched.matches.filter(x=>x.method==='EXACT').length,alias:matched.matches.filter(x=>x.method==='ALIAS').length,resolvedExcluded:matched.resolvedExcluded.length,unmatched:matched.unmatched.length,ambiguous:matched.ambiguous.length,officialOnly:matched.officialOnly.length},
    activationBlockers,criticalMissingMetrics,
    resolvedExcludedCatalog:matched.resolvedExcluded,unmatchedCatalog:matched.unmatched,ambiguousCatalog:matched.ambiguous,duplicateOfficialNames:matched.duplicateOfficialNames,
    officialOnly:matched.officialOnly
  };
  return {active,mergedBrands,report,matches:matched.matches,resolvedExcluded:matched.resolvedExcluded};
}

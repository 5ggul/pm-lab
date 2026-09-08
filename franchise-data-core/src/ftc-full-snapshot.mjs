import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {fetchText, parseApiPayload} from './core.mjs';
import {FTC_PUBLIC_DATASETS, discoverPublicPreviewKey} from './ftc-registry.mjs';
import {classifyDataGoError} from './data-go-error.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ownKey=process.env.DATA_GO_KR_SERVICE_KEY||'';
const pilotPath=resolve(repoRoot,'data/franchise/snapshots/ftc/pilot-2025.json');
const jsonPath=resolve(repoRoot,'data/franchise/official/brands-2025.json');
const jsPath=resolve(repoRoot,'docs/franchise-data-preview/official-brand-data-final.js');
const YEARS=Object.freeze([2025,2024,2023]);
const HISTORY_YEARS=Object.freeze([...YEARS].reverse());
const keyPart=v=>String(v||'').includes('%')?String(v):encodeURIComponent(String(v||''));
const numOrNull=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const posOrNull=v=>{const n=numOrNull(v);return n!=null&&n>0?n:null};
const to10k=v=>{const n=posOrNull(v);return n==null?null:n/10};
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const rowKey=r=>`${norm(r.brandNm)}|${norm(r.corpNm)}|${norm(r.indutyLclasNm)}`;
const brandIndustryKey=r=>`${norm(r.brandNm)}|${norm(r.indutyLclasNm)}`;

async function writeResult(doc){await mkdir(dirname(jsonPath),{recursive:true});await writeFile(jsonPath,JSON.stringify(doc,null,2)+'\n','utf8');await writeFile(jsPath,`'use strict';\n// Generated official FTC brand snapshot.\nglobalThis.OFFICIAL_BRAND_DATA=${JSON.stringify(doc,null,2)};\n`,'utf8')}
let pilot={status:'BLOCKED',blockers:['pilot missing']};try{pilot=JSON.parse(await readFile(pilotPath,'utf8'))}catch{}
if(!['PROMOTION_READY','PREVIEW_READY'].includes(pilot.status)){
 const blocked={schemaVersion:3,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY_YEARS,reason:'FTC_PILOT_NOT_READY',credentialMode:pilot.credentialMode||null,productionReady:false,blockers:pilot.blockers||[],records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await writeResult(blocked);console.log(JSON.stringify({status:blocked.status,reason:blocked.reason,blockers:blocked.blockers},null,2));process.exit(0);
}
let serviceKey=ownKey;
if(pilot.credentialMode==='FTC_PUBLIC_PREVIEW_DEMO'){
 const found=await discoverPublicPreviewKey();if(!found.ok){const blocked={schemaVersion:3,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY_YEARS,reason:'FTC_PUBLIC_PREVIEW_KEY_UNAVAILABLE',credentialMode:pilot.credentialMode,productionReady:false,blockers:[found.error||'preview key unavailable'],records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await writeResult(blocked);console.log(JSON.stringify(blocked,null,2));process.exit(0)}serviceKey=found.key;
}
if(!serviceKey){const blocked={schemaVersion:3,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY_YEARS,reason:'KEY_REQUIRED',credentialMode:pilot.credentialMode||null,productionReady:false,blockers:['service key unavailable'],records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await writeResult(blocked);process.exit(0)}

async function fetchPage(spec,year,pageNo,numOfRows=3000){
 const q=new URLSearchParams({pageNo:String(pageNo),numOfRows:String(numOfRows),resultType:'json',[spec.yearParam]:String(year)});const url=`${spec.endpoint}?${q.toString()}&serviceKey=${keyPart(serviceKey)}`;
 const r=await fetchText(url,{timeoutMs:20000,attempts:2});
 if(!r.ok){const g=classifyDataGoError(r.text,r.status);throw new Error(`${spec.id} ${g.kind}${g.code?`(${g.code})`:''}`)}
 const p=parseApiPayload(r.text);const raw=p.raw||{};const header=raw?.response?.header||raw;const body=raw?.response?.body||raw;const code=header?.resultCode??body?.resultCode;
 if(code!=null&&!['00','0','0000'].includes(String(code))){const g=classifyDataGoError(r.text,r.status);throw new Error(`${spec.id} ${g.kind}${g.code?`(${g.code})`:''}`)}
 let items=body?.items??[];if(Array.isArray(items)){}else if(Array.isArray(items?.item))items=items.item;else if(items?.item)items=[items.item];else if(items&&typeof items==='object'&&Object.keys(items).length)items=[items];else items=[];return {items,totalCount:Number(body?.totalCount)||items.length,transport:r.transport};
}
async function fetchAll(spec,year){const rows=[];let page=1,total=Infinity,transport=null;while(rows.length<total){const r=await fetchPage(spec,year,page);transport=r.transport;total=r.totalCount;rows.push(...r.items);if(!r.items.length||page>100)break;page++}return {year,totalCount:Number.isFinite(total)?total:rows.length,rows,transport}}
function indexUnique(rows,keyFn){const groups=new Map();for(const r of rows){const k=keyFn(r);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}const unique=new Map();for(const [k,v] of groups)if(v.length===1)unique.set(k,v[0]);return unique}
const makeIndex=rows=>({exact:indexUnique(rows,rowKey),fallback:indexUnique(rows,brandIndustryKey)});
const match=(idx,row)=>idx?.exact?.get(rowKey(row))||idx?.fallback?.get(brandIndustryKey(row))||null;
const compact=obj=>Object.fromEntries(Object.entries(obj).filter(([,v])=>v!=null));
const storePoint=(year,r)=>r?compact({year,stores:numOrNull(r.frcsCnt),newStores:numOrNull(r.newFrcsRgsCnt),contractEnd:numOrNull(r.ctrtEndCnt),contractCancel:numOrNull(r.ctrtCncltnCnt),nameChanges:numOrNull(r.nmChgCnt),averageSales10k:to10k(r.avrgSlsAmt),averageSalesPerArea10k:to10k(r.arUnitAvrgSlsAmt)}):null;
const costPoint=(year,r)=>r?compact({year,total10k:to10k(r.smtnAmt),franchiseFee10k:to10k(r.jngBzmnJngAmt),education10k:to10k(r.jngBzmnEduAmt),deposit10k:to10k(r.jngBzmnAssrncAmt),etc10k:to10k(r.jngBzmnEtcAmt)}):null;
async function previewNames(){try{const code=await readFile(resolve(repoRoot,'docs/franchise-data-preview/data-final.js'),'utf8');const marker=code.indexOf('function bySlug');const ctx={console};vm.createContext(ctx);vm.runInContext(code.slice(0,marker)+"\n;globalThis.__names=brands.map(b=>b.name);",ctx);return ctx.__names||[]}catch{return []}}

const specs=Object.fromEntries(FTC_PUBLIC_DATASETS.map(s=>[s.id,s]));
const [statsRuns,costRuns]=await Promise.all([
 Promise.all(YEARS.map(year=>fetchAll(specs.ftcBrandStores,year))),
 Promise.all(YEARS.map(year=>fetchAll(specs.ftcBrandCost,year)))
]);
const statsByYear=Object.fromEntries(statsRuns.map(r=>[r.year,r]));
const costByYear=Object.fromEntries(costRuns.map(r=>[r.year,r]));
const statsIndex=Object.fromEntries(YEARS.map(year=>[year,makeIndex(statsByYear[year].rows)]));
const costIndex=Object.fromEntries(YEARS.map(year=>[year,makeIndex(costByYear[year].rows)]));

let exactCostHits=0,fallbackCostHits=0,previousHits=0,thirdYearHits=0;const records=[];
for(const s of statsByYear[2025].rows){
 const k=rowKey(s),bk=brandIndustryKey(s);let c=costIndex[2025].exact.get(k);if(c)exactCostHits++;else{c=costIndex[2025].fallback.get(bk);if(c)fallbackCostHits++}
 const s24=match(statsIndex[2024],s),s23=match(statsIndex[2023],s);if(s24)previousHits++;if(s23)thirdYearHits++;
 const historyRows={2025:s,2024:s24,2023:s23};
 const costRows={2025:c,2024:match(costIndex[2024],s),2023:match(costIndex[2023],s)};
 const storeHistory=HISTORY_YEARS.map(year=>storePoint(year,historyRows[year])).filter(Boolean);
 const costHistory=HISTORY_YEARS.map(year=>costPoint(year,costRows[year])).filter(Boolean);
 const currentStore=storePoint(2025,s)||{};const currentCost=costPoint(2025,c)||{};const previousCost=costPoint(2024,costRows[2024])||{};
 const costComponents=compact({franchiseFee10k:currentCost.franchiseFee10k,education10k:currentCost.education10k,deposit10k:currentCost.deposit10k,etc10k:currentCost.etc10k,total10k:currentCost.total10k});
 const record={
  name:String(s.brandNm||'').trim(),corp:String(s.corpNm||'').trim(),industryMajor:String(s.indutyLclasNm||'').trim(),industryMid:String(s.indutyMlsfcNm||'').trim(),
  referenceYear:2025,previousReferenceYear:2024,historyYears:HISTORY_YEARS,
  stores:currentStore.stores??null,previousStores:storePoint(2024,s24)?.stores??null,directStores:null,
  newStores:currentStore.newStores??null,contractEnd:currentStore.contractEnd??null,contractCancel:currentStore.contractCancel??null,nameChanges:currentStore.nameChanges??null,
  averageSales10k:currentStore.averageSales10k??null,averageSalesPerArea10k:currentStore.averageSalesPerArea10k??null,
  startupCost10k:currentCost.total10k??null,startupFee10k:currentCost.franchiseFee10k??null,startupEducation10k:currentCost.education10k??null,startupDeposit10k:currentCost.deposit10k??null,startupEtc10k:currentCost.etc10k??null,previousStartupCost10k:previousCost.total10k??null,
  storeHistory,costHistory,costComponents,
  openClose:compact({newStores:currentStore.newStores,ended:currentStore.contractEnd,cancelled:currentStore.contractCancel,nameChanges:currentStore.nameChanges}),
  sourceUrl:specs.ftcBrandStores.guideUrl,
  source:{url:specs.ftcBrandStores.guideUrl,statsDataId:'15110241',statsUrl:specs.ftcBrandStores.guideUrl,costDataId:c?'15110265':null,costUrl:c?specs.ftcBrandCost.guideUrl:null}
 };
 if(record.name)records.push(record);
}
const names=await previewNames(),officialUnique=indexUnique(records,r=>norm(r.name)),previewMatched=names.filter(n=>officialUnique.has(norm(n))).length;
const costCoverage=records.length?(exactCostHits+fallbackCostHits)/records.length:0,previousCoverage=records.length?previousHits/records.length:0,thirdYearCoverage=records.length?thirdYearHits/records.length:0,previewMatchRate=names.length?previewMatched/names.length:0;
const threeYearStoreCoverage=records.length?records.filter(r=>r.storeHistory.length>=3).length/records.length:0;
const threeYearCostCoverage=records.length?records.filter(r=>r.costHistory.length>=3).length/records.length:0;
const quality={
 statsByYear:Object.fromEntries(YEARS.map(year=>[year,statsByYear[year].rows.length])),costByYear:Object.fromEntries(YEARS.map(year=>[year,costByYear[year].rows.length])),
 costCoverage,previousCoverage,thirdYearCoverage,threeYearStoreCoverage,threeYearCostCoverage,previewNames:names.length,previewMatched,previewMatchRate,
 transport:{stats2025:statsByYear[2025].transport,cost2025:costByYear[2025].transport}
};
const allowPreviewOverlay=records.length>=100&&costCoverage>=0.45&&previousCoverage>=0.45&&previewMatchRate>=0.55,productionReady=pilot.credentialMode==='USER_DATA_GO_KR_KEY'&&allowPreviewOverlay;
const doc={schemaVersion:3,status:'READY',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY_YEARS,credentialMode:pilot.credentialMode,productionReady,units:{startup:'만원 (FTC 천원값 ÷ 10)',sales:'만원/연 (FTC 천원값 ÷ 10)'},quality,promotion:{allowPreviewOverlay,productionReady,requirements:{recordsMin:100,costCoverageMin:0.45,previousCoverageMin:0.45,previewMatchRateMin:0.55}},records};
await writeResult(doc);console.log(JSON.stringify({status:doc.status,credentialMode:doc.credentialMode,productionReady,records:records.length,historyYears:HISTORY_YEARS,quality,promotion:doc.promotion},null,2));

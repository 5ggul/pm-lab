import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchText,parseApiPayload} from './core.mjs';
import {FTC_PUBLIC_DATASETS,discoverPublicPreviewKey,requestFtc} from './ftc-registry.mjs';
import {classifyDataGoError} from './data-go-error.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const storesPath=resolve(root,'data/franchise/official/stores-2025.json');
const jsonPath=resolve(root,'data/franchise/official/brands-2025.json');
const jsPath=resolve(root,'docs/franchise-data-preview/official-brand-data-final.js');
const YEARS=[2025,2024,2023];
const HISTORY=[2023,2024,2025];
const spec=FTC_PUBLIC_DATASETS.find(x=>x.id==='ftcBrandCost');
const keyPart=v=>String(v||'').includes('%')?String(v):encodeURIComponent(String(v||''));
const n=v=>{if(v==null||v==='')return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null};
const to10k=v=>{const x=n(v);return x==null?null:x/10};
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const key=r=>`${norm(r?.brandNm??r?.name)}|${norm(r?.corpNm??r?.corp)}|${norm(r?.indutyLclasNm??r?.industryMajor)}`;
const fallback=r=>`${norm(r?.brandNm??r?.name)}|${norm(r?.indutyLclasNm??r?.industryMajor)}`;
const compact=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!=null));
async function write(doc){await mkdir(dirname(jsonPath),{recursive:true});await writeFile(jsonPath,JSON.stringify(doc,null,2)+'\n','utf8');await writeFile(jsPath,`'use strict';\nglobalThis.OFFICIAL_BRAND_DATA=${JSON.stringify(doc,null,2)};\n`,'utf8')}
function unique(rows,keyFn){const g=new Map();for(const r of rows){const k=keyFn(r);if(!k)continue;const a=g.get(k)||[];a.push(r);g.set(k,a)}const u=new Map();for(const [k,a] of g)if(a.length===1)u.set(k,a[0]);return u}
const indexes=rows=>({exact:unique(rows,key),fallback:unique(rows,fallback)});
const find=(idx,r)=>idx.exact.get(key(r))||idx.fallback.get(fallback(r))||null;
const costPoint=(year,r)=>r?compact({year,total10k:to10k(r.smtnAmt),franchiseFee10k:to10k(r.jngBzmnJngAmt),education10k:to10k(r.jngBzmnEduAmt),deposit10k:to10k(r.jngBzmnAssrncAmt),etc10k:to10k(r.jngBzmnEtcAmt)}):null;
async function fetchPage(publicKey,year,pageNo,numOfRows=3000){const q=new URLSearchParams({pageNo:String(pageNo),numOfRows:String(numOfRows),resultType:'json',[spec.yearParam]:String(year)});const url=`${spec.endpoint}?${q.toString()}&serviceKey=${keyPart(publicKey)}`;const r=await fetchText(url,{timeoutMs:25000,attempts:2,headers:{referer:'https://franchise.ftc.go.kr/'}});if(!r.ok){const g=classifyDataGoError(r.text,r.status);throw new Error(`${g.kind}${g.code?`(${g.code})`:''}`)}const p=parseApiPayload(r.text),raw=p.raw||{},header=raw?.response?.header||raw,body=raw?.response?.body||raw;const code=header?.resultCode??body?.resultCode;if(code!=null&&!['00','0','0000'].includes(String(code))){const g=classifyDataGoError(r.text,r.status);throw new Error(`${g.kind}${g.code?`(${g.code})`:''}`)}let items=body?.items??[];if(Array.isArray(items)){}else if(Array.isArray(items?.item))items=items.item;else if(items?.item)items=[items.item];else items=[];return {items,totalCount:Number(body?.totalCount)||items.length,transport:r.transport}}
async function fetchAll(publicKey,year){const rows=[];let pageNo=1,total=Infinity,transport=null;while(rows.length<total){const r=await fetchPage(publicKey,year,pageNo);transport=r.transport;total=r.totalCount;rows.push(...r.items);if(!r.items.length||pageNo>100)break;pageNo++}return {year,rows,totalCount:Number.isFinite(total)?total:rows.length,transport}}

let stores;try{stores=JSON.parse(await readFile(storesPath,'utf8'))}catch{}
if(!stores||stores.status!=='READY'||!Array.isArray(stores.records)||!stores.records.length){const d={schemaVersion:4,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,reason:'STORE_SNAPSHOT_NOT_READY',records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await write(d);console.log(JSON.stringify(d,null,2));process.exit(0)}
const found=await discoverPublicPreviewKey();
if(!found.ok){const d={schemaVersion:4,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,reason:'FTC_PUBLIC_CLIENT_KEY_UNAVAILABLE',records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await write(d);console.log(JSON.stringify(d,null,2));process.exit(0)}
const probe=await requestFtc(spec,found.key,{year:2025,numOfRows:1,timeoutMs:20000});
if(probe.live!=='LIVE_VERIFIED'){const d={schemaVersion:4,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,reason:'FTC_PUBLIC_COST_PATH_NOT_READY',probe:{live:probe.live,httpStatus:probe.httpStatus||null,dataGoCode:probe.dataGoCode||null},records:[],promotion:{allowPreviewOverlay:false,productionReady:false}};await write(d);console.log(JSON.stringify(d,null,2));process.exit(0)}
const runs=await Promise.all(YEARS.map(y=>fetchAll(found.key,y)));
const byYear=Object.fromEntries(runs.map(r=>[r.year,r]));
const idx=Object.fromEntries(YEARS.map(y=>[y,indexes(byYear[y].rows)]));
let currentCostMatches=0,threeYearCost=0;
const records=stores.records.map(s=>{
 const c25=find(idx[2025],s),c24=find(idx[2024],s),c23=find(idx[2023],s);if(c25)currentCostMatches++;
 const costHistory=[costPoint(2023,c23),costPoint(2024,c24),costPoint(2025,c25)].filter(Boolean);if(costHistory.length>=3)threeYearCost++;
 const current=costPoint(2025,c25)||{},prev=costPoint(2024,c24)||{};
 return {...s,
  startupCost10k:current.total10k??null,startupFee10k:current.franchiseFee10k??null,startupEducation10k:current.education10k??null,startupDeposit10k:current.deposit10k??null,startupEtc10k:current.etc10k??null,startupInterior10k:null,previousStartupCost10k:prev.total10k??null,
  costHistory,costComponents:compact({franchiseFee10k:current.franchiseFee10k,education10k:current.education10k,deposit10k:current.deposit10k,etc10k:current.etc10k,total10k:current.total10k}),
  sourceUrl:spec.guideUrl,source:{statsDataId:'15110241',statsUrl:stores.source?.url||'https://www.data.go.kr/data/15110241/openapi.do',costDataId:'15110265',costUrl:spec.guideUrl,costAccess:'FTC_OFFICIAL_PUBLIC_CLIENT_RUNTIME'}
 };
});
const costCoverage=records.length?currentCostMatches/records.length:0,threeYearCostCoverage=records.length?threeYearCost/records.length:0;
const quality={rowsByYear:Object.fromEntries(runs.map(r=>[r.year,r.rows.length])),records:records.length,costCoverage,threeYearStoreCoverage:stores.quality?.threeYearCoverage??null,threeYearCostCoverage,transport:{stores:stores.quality?.transport||null,cost2025:runs.find(r=>r.year===2025)?.transport||null}};
const allowPreviewOverlay=records.length>=100&&costCoverage>=0.9;
const doc={schemaVersion:4,status:'READY',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,credentialMode:'HYBRID_OFFICIAL_PUBLIC',productionReady:false,units:{startup:'만원 (FTC 천원값 ÷ 10)',sales:'만원/연 (FTC 천원값 ÷ 10)'},sourceAccess:{stores:'USER_DATA_GO_KR_KEY',cost:'FTC_OFFICIAL_PUBLIC_CLIENT_RUNTIME',publicClientKeyPersisted:false},quality,promotion:{allowPreviewOverlay,productionReady:false},records};
await write(doc);console.log(JSON.stringify({status:doc.status,credentialMode:doc.credentialMode,records:records.length,quality,promotion:doc.promotion},null,2));

import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchText,parseApiPayload} from './core.mjs';
import {FTC_PUBLIC_DATASETS} from './ftc-registry.mjs';
import {classifyDataGoError} from './data-go-error.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const serviceKey=process.env.DATA_GO_KR_SERVICE_KEY||'';
const YEARS=[2025,2024,2023];
const HISTORY=[2023,2024,2025];
const spec=FTC_PUBLIC_DATASETS.find(x=>x.id==='ftcBrandStores');
const outJson=resolve(repoRoot,'data/franchise/official/stores-2025.json');
const outJs=resolve(repoRoot,'docs/franchise-data-preview/official-store-data-final.js');
const keyPart=v=>String(v||'').includes('%')?String(v):encodeURIComponent(String(v||''));
const n=v=>{if(v===null||v===undefined)return null;const s=String(v).trim();if(!s)return null;const x=Number(s.replace(/,/g,''));return Number.isFinite(x)?x:null};
const to10k=v=>{const x=n(v);return x==null?null:x/10};
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const rowKey=r=>`${norm(r.brandNm)}|${norm(r.corpNm)}|${norm(r.indutyLclasNm)}`;
const fallbackKey=r=>`${norm(r.brandNm)}|${norm(r.indutyLclasNm)}`;
const compact=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!=null));

async function write(doc){await mkdir(dirname(outJson),{recursive:true});await writeFile(outJson,JSON.stringify(doc,null,2)+'\n','utf8');await writeFile(outJs,`'use strict';\nglobalThis.OFFICIAL_STORE_DATA=${JSON.stringify(doc,null,2)};\n`,'utf8')}
async function page(year,pageNo,numOfRows=3000){
 const q=new URLSearchParams({pageNo:String(pageNo),numOfRows:String(numOfRows),resultType:'json',[spec.yearParam]:String(year)});
 const url=`${spec.endpoint}?${q.toString()}&serviceKey=${keyPart(serviceKey)}`;
 const r=await fetchText(url,{timeoutMs:25000,attempts:2});
 if(!r.ok){const g=classifyDataGoError(r.text,r.status);throw new Error(`${g.kind}${g.code?`(${g.code})`:''}`)}
 const p=parseApiPayload(r.text),raw=p.raw||{},header=raw?.response?.header||raw,body=raw?.response?.body||raw;
 const code=header?.resultCode??body?.resultCode;if(code!=null&&!['00','0','0000'].includes(String(code))){const g=classifyDataGoError(r.text,r.status);throw new Error(`${g.kind}${g.code?`(${g.code})`:''}`)}
 let items=body?.items??[];if(Array.isArray(items)){}else if(Array.isArray(items?.item))items=items.item;else if(items?.item)items=[items.item];else items=[];
 return {items,totalCount:Number(body?.totalCount)||items.length,transport:r.transport};
}
async function all(year){const rows=[];let pageNo=1,total=Infinity,transport=null;while(rows.length<total){const r=await page(year,pageNo);transport=r.transport;total=r.totalCount;rows.push(...r.items);if(!r.items.length||pageNo>100)break;pageNo++}return {year,rows,totalCount:Number.isFinite(total)?total:rows.length,transport}}
function uniqueIndex(rows,keyFn){const g=new Map();for(const r of rows){const k=keyFn(r);if(!k)continue;const a=g.get(k)||[];a.push(r);g.set(k,a)}const u=new Map();for(const [k,a] of g)if(a.length===1)u.set(k,a[0]);return u}
const point=(year,r)=>r?compact({year,stores:n(r.frcsCnt),newStores:n(r.newFrcsRgsCnt),contractEnd:n(r.ctrtEndCnt),contractCancel:n(r.ctrtCncltnCnt),nameChanges:n(r.nmChgCnt),averageSales10k:to10k(r.avrgSlsAmt),averageSalesPerArea10k:to10k(r.arUnitAvrgSlsAmt)}):null;

if(!serviceKey){await write({schemaVersion:1,status:'BLOCKED',generatedAt:new Date().toISOString(),reason:'KEY_REQUIRED',referenceYear:2025,historyYears:HISTORY,records:[]});process.exit(0)}
try{
 const runs=await Promise.all(YEARS.map(all));
 const byYear=Object.fromEntries(runs.map(r=>[r.year,r]));
 const indexes=Object.fromEntries(YEARS.map(y=>[y,{exact:uniqueIndex(byYear[y].rows,rowKey),fallback:uniqueIndex(byYear[y].rows,fallbackKey)}]));
 const match=(y,r)=>indexes[y].exact.get(rowKey(r))||indexes[y].fallback.get(fallbackKey(r))||null;
 const records=byYear[2025].rows.map(r=>{
  const r24=match(2024,r),r23=match(2023,r);const storeHistory=[point(2023,r23),point(2024,r24),point(2025,r)].filter(Boolean);const cur=point(2025,r)||{};
  return {name:String(r.brandNm||'').trim(),corp:String(r.corpNm||'').trim(),industryMajor:String(r.indutyLclasNm||'').trim(),industryMid:String(r.indutyMlsfcNm||'').trim(),referenceYear:2025,previousReferenceYear:2024,historyYears:HISTORY,stores:cur.stores??null,previousStores:point(2024,r24)?.stores??null,newStores:cur.newStores??null,contractEnd:cur.contractEnd??null,contractCancel:cur.contractCancel??null,nameChanges:cur.nameChanges??null,averageSales10k:cur.averageSales10k??null,averageSalesPerArea10k:cur.averageSalesPerArea10k??null,storeHistory,openClose:compact({newStores:cur.newStores,ended:cur.contractEnd,cancelled:cur.contractCancel,nameChanges:cur.nameChanges}),sourceUrl:spec.guideUrl,source:{dataId:spec.dataId,url:spec.guideUrl}};
 }).filter(r=>r.name);
 const threeYear=records.filter(r=>r.storeHistory.length>=3).length;
 const doc={schemaVersion:1,status:'READY',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,credentialMode:'USER_DATA_GO_KR_KEY',source:{dataId:spec.dataId,url:spec.guideUrl},quality:{rowsByYear:Object.fromEntries(runs.map(r=>[r.year,r.rows.length])),records:records.length,threeYearCoverage:records.length?threeYear/records.length:0,transport:runs[0]?.transport||null},records};
 await write(doc);console.log(JSON.stringify({status:doc.status,records:records.length,rowsByYear:doc.quality.rowsByYear,threeYearCoverage:doc.quality.threeYearCoverage},null,2));
}catch(error){const doc={schemaVersion:1,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,historyYears:HISTORY,reason:String(error?.message||error),records:[]};await write(doc);console.log(JSON.stringify(doc,null,2));}

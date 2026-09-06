import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {fetchText, parseApiPayload} from './core.mjs';
import {FTC_PUBLIC_DATASETS} from './ftc-registry.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const key=process.env.DATA_GO_KR_SERVICE_KEY||'';
const pilotPath=resolve(repoRoot,'data/franchise/snapshots/ftc/pilot-2025.json');
const jsonPath=resolve(repoRoot,'data/franchise/official/brands-2025.json');
const jsPath=resolve(repoRoot,'docs/franchise-data-preview/official-brand-data-final.js');
const keyPart=v=>String(v||'').includes('%')?String(v):encodeURIComponent(String(v||''));
const numOrNull=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const posOrNull=v=>{const n=numOrNull(v);return n&&n>0?n:null};
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const rowKey=r=>`${norm(r.brandNm)}|${norm(r.corpNm)}|${norm(r.indutyLclasNm)}`;
const brandIndustryKey=r=>`${norm(r.brandNm)}|${norm(r.indutyLclasNm)}`;

async function fetchPage(spec,year,pageNo,numOfRows=3000){
  const q=new URLSearchParams({pageNo:String(pageNo),numOfRows:String(numOfRows),resultType:'json',[spec.yearParam]:String(year)});
  const url=`${spec.endpoint}?${q.toString()}&serviceKey=${keyPart(key)}`;
  const r=await fetchText(url,{timeoutMs:30000,attempts:2});
  if(!r.ok)throw new Error(`${spec.id} HTTP ${r.status}`);
  const p=parseApiPayload(r.text);const raw=p.raw||{};const header=raw?.response?.header||raw;const body=raw?.response?.body||raw;
  const code=header?.resultCode??body?.resultCode;if(code!=null&&!['00','0','0000'].includes(String(code)))throw new Error(`${spec.id} resultCode=${code} ${header?.resultMsg||body?.resultMsg||''}`);
  let items=body?.items??[];if(Array.isArray(items)){}else if(Array.isArray(items?.item))items=items.item;else if(items?.item)items=[items.item];else if(items&&typeof items==='object'&&Object.keys(items).length)items=[items];else items=[];
  return {items,totalCount:Number(body?.totalCount)||items.length};
}
async function fetchAll(spec,year){
  const rows=[];let page=1,total=Infinity;
  while(rows.length<total){const r=await fetchPage(spec,year,page);total=r.totalCount;rows.push(...r.items);if(!r.items.length||page>100)break;page++;}
  return {year,totalCount:Number.isFinite(total)?total:rows.length,rows};
}
function indexUnique(rows,keyFn){
  const groups=new Map();for(const r of rows){const k=keyFn(r);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
  const unique=new Map();for(const [k,v] of groups)if(v.length===1)unique.set(k,v[0]);return unique;
}
async function previewNames(){
  try{const code=await readFile(resolve(repoRoot,'docs/franchise-data-preview/data-final.js'),'utf8');const marker=code.indexOf('function bySlug');const ctx={console};vm.createContext(ctx);vm.runInContext(code.slice(0,marker)+"\n;globalThis.__names=brands.map(b=>b.name);",ctx);return ctx.__names||[]}catch{return []}
}
async function writeResult(doc){await mkdir(dirname(jsonPath),{recursive:true});await writeFile(jsonPath,JSON.stringify(doc,null,2)+'\n','utf8');await writeFile(jsPath,`'use strict';\n// Generated official FTC brand snapshot.\nglobalThis.OFFICIAL_BRAND_DATA=${JSON.stringify(doc,null,2)};\n`,'utf8')}

let pilot={status:'BLOCKED',blockers:['pilot missing']};try{pilot=JSON.parse(await readFile(pilotPath,'utf8'))}catch{}
if(pilot.status!=='PROMOTION_READY'||!key){
  const blocked={schemaVersion:1,status:'BLOCKED',generatedAt:new Date().toISOString(),referenceYear:2025,reason:!key?'KEY_REQUIRED':'FTC_PILOT_NOT_READY',blockers:pilot.blockers||[],records:[],promotion:{allowPreviewOverlay:false}};
  await writeResult(blocked);console.log(JSON.stringify({status:blocked.status,reason:blocked.reason,blockers:blocked.blockers},null,2));process.exit(0);
}

const specs=Object.fromEntries(FTC_PUBLIC_DATASETS.map(s=>[s.id,s]));
const [stats25,stats24,cost25,cost24]=await Promise.all([
  fetchAll(specs.ftcBrandStores,2025),fetchAll(specs.ftcBrandStores,2024),fetchAll(specs.ftcBrandCost,2025),fetchAll(specs.ftcBrandCost,2024)
]);
const cost25Exact=indexUnique(cost25.rows,rowKey),cost25Fallback=indexUnique(cost25.rows,brandIndustryKey),cost24Exact=indexUnique(cost24.rows,rowKey),cost24Fallback=indexUnique(cost24.rows,brandIndustryKey);
const stats24Exact=indexUnique(stats24.rows,rowKey),stats24Fallback=indexUnique(stats24.rows,brandIndustryKey);
let exactCostHits=0,fallbackCostHits=0,previousHits=0;
const records=[];
for(const s of stats25.rows){
  const k=rowKey(s),bk=brandIndustryKey(s);let c=cost25Exact.get(k);if(c)exactCostHits++;else{c=cost25Fallback.get(bk);if(c)fallbackCostHits++}
  const p=stats24Exact.get(k)||stats24Fallback.get(bk);if(p)previousHits++;
  const cp=c?(cost24Exact.get(rowKey(c))||cost24Fallback.get(brandIndustryKey(c))):null;
  const stores=numOrNull(s.frcsCnt),prevStores=p?numOrNull(p.frcsCnt):null;
  const totalCostKrwK= c?posOrNull(c.smtnAmt):null;
  const record={
    name:String(s.brandNm||'').trim(),corp:String(s.corpNm||'').trim(),industryMajor:String(s.indutyLclasNm||'').trim(),industryMid:String(s.indutyMlsfcNm||'').trim(),
    referenceYear:2025,previousReferenceYear:2024,
    stores,previousStores:prevStores,directStores:null,
    newStores:numOrNull(s.newFrcsRgsCnt),contractEnd:numOrNull(s.ctrtEndCnt),contractCancel:numOrNull(s.ctrtCncltnCnt),nameChanges:numOrNull(s.nmChgCnt),
    averageSales10k:posOrNull(s.avrgSlsAmt)!=null?posOrNull(s.avrgSlsAmt)/10:null,averageSalesPerArea10k:posOrNull(s.arUnitAvrgSlsAmt)!=null?posOrNull(s.arUnitAvrgSlsAmt)/10:null,
    startupCost10k:totalCostKrwK!=null?totalCostKrwK/10:null,startupFee10k:c&&posOrNull(c.jngBzmnJngAmt)!=null?posOrNull(c.jngBzmnJngAmt)/10:null,startupEducation10k:c&&posOrNull(c.jngBzmnEduAmt)!=null?posOrNull(c.jngBzmnEduAmt)/10:null,startupDeposit10k:c&&posOrNull(c.jngBzmnAssrncAmt)!=null?posOrNull(c.jngBzmnAssrncAmt)/10:null,startupEtc10k:c&&posOrNull(c.jngBzmnEtcAmt)!=null?posOrNull(c.jngBzmnEtcAmt)/10:null,
    previousStartupCost10k:cp&&posOrNull(cp.smtnAmt)!=null?posOrNull(cp.smtnAmt)/10:null,
    source:{statsDataId:'15110241',costDataId:c?'15110265':null}
  };
  if(record.name)records.push(record);
}
const names=await previewNames();const officialUnique=indexUnique(records,r=>norm(r.name));const previewMatched=names.filter(n=>officialUnique.has(norm(n))).length;
const costCoverage=records.length?(exactCostHits+fallbackCostHits)/records.length:0;const previousCoverage=records.length?previousHits/records.length:0;const previewMatchRate=names.length?previewMatched/names.length:0;
const quality={stats2025:stats25.rows.length,stats2024:stats24.rows.length,cost2025:cost25.rows.length,cost2024:cost24.rows.length,costCoverage,previousCoverage,previewNames:names.length,previewMatched,previewMatchRate};
const allowPreviewOverlay=records.length>=100&&costCoverage>=0.45&&previousCoverage>=0.45&&previewMatchRate>=0.55;
const doc={schemaVersion:1,status:'READY',generatedAt:new Date().toISOString(),referenceYear:2025,units:{startup:'만원 (FTC 천원값 ÷ 10)',sales:'만원/연 (FTC 천원값 ÷ 10)'},quality,promotion:{allowPreviewOverlay,requirements:{recordsMin:100,costCoverageMin:0.45,previousCoverageMin:0.45,previewMatchRateMin:0.55}},records};
await writeResult(doc);console.log(JSON.stringify({status:doc.status,records:records.length,quality,promotion:doc.promotion},null,2));

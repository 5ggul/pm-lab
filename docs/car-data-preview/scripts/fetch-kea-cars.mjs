import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rawDir=path.join(root,'data','raw');
const stagingDir=path.join(root,'data','staging');
const generatedDir=path.join(root,'data','generated');
const keyRaw=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
const endpoint=process.env.KEA_CAR_API_ENDPOINT||'https://apis.data.go.kr/B553530/CAR/CAR_01_LIST';
const sourcePage='https://www.data.go.kr/data/15101093/openapi.do';
const fetchedAt=new Date().toISOString();
const pageSize=100;

fs.mkdirSync(rawDir,{recursive:true});
fs.mkdirSync(stagingDir,{recursive:true});
fs.mkdirSync(generatedDir,{recursive:true});

const statusPath=path.join(generatedDir,'kea-api-status.json');
const rawPath=path.join(rawDir,'kea-car-efficiency.json');
const normalizedPath=path.join(stagingDir,'kea-car-efficiency-normalized.json');
const unmatchedPath=path.join(stagingDir,'kea-car-efficiency-unmatched.json');

function safeKey(raw){try{return decodeURIComponent(raw)}catch{return raw}}
function stableId(row){const base=String(row.rqno||'')||`${row.enterprise||''}|${row.modelname||''}|${row.displacement||''}|${row.mileage||''}`;return 'kea-'+crypto.createHash('sha1').update(base).digest('hex').slice(0,16)}
function numberOrNull(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null}
function gradeOrNull(v){const m=String(v??'').match(/(\d+)/);return m?Number(m[1]):null}
function itemsFrom(payload){
  const candidates=[payload?.response?.body?.items?.item,payload?.response?.body?.items,payload?.body?.items?.item,payload?.body?.items,payload?.items?.item,payload?.items,payload?.data,payload?.result];
  for(const c of candidates){if(Array.isArray(c))return c;if(c&&typeof c==='object'&&!Array.isArray(c)&&('modelname'in c||'rqno'in c))return[c]}
  return [];
}
function totalFrom(payload){return Number(payload?.response?.body?.totalCount??payload?.body?.totalCount??payload?.totalCount??0)||0}
function apiError(payload,text){const code=payload?.response?.header?.resultCode??payload?.header?.resultCode??payload?.resultCode;const msg=payload?.response?.header?.resultMsg??payload?.header?.resultMsg??payload?.resultMsg;if(code&&String(code)!=='00'&&String(code)!=='0')return `${code}: ${msg||'API error'}`;if(/SERVICE_KEY|PERMISSION_DENIED|ACCESS_DENIED|LIMITED_NUMBER/i.test(text))return text.slice(0,500);return null}
async function getPage(pageNo){
  const url=new URL(endpoint);url.searchParams.set('serviceKey',safeKey(keyRaw));url.searchParams.set('pageNo',String(pageNo));url.searchParams.set('numOfRows',String(pageSize));url.searchParams.set('apiType','json');
  const res=await fetch(url,{headers:{'user-agent':'pm-lab-car-preview/1.0'},signal:AbortSignal.timeout(20000)});const text=await res.text();let payload=null;try{payload=JSON.parse(text)}catch{}
  if(!res.ok)throw new Error(`HTTP ${res.status}: ${text.slice(0,300)}`);const err=apiError(payload,text);if(err)throw new Error(err);if(!payload)throw new Error(`Non-JSON response: ${text.slice(0,300)}`);return{payload,rows:itemsFrom(payload),total:totalFrom(payload)};
}
function normalize(rows){return rows.map((r,i)=>({source_record_id:String(r.rqno??stableId(r)),candidate_id:stableId(r),maker_raw:String(r.enterprise??'').trim()||null,model_raw:String(r.modelname??'').trim()||null,displacement_cc:numberOrNull(r.displacement),combined_efficiency:numberOrNull(r.mileage),efficiency_grade:gradeOrNull(r.grade),official_annual_fuel_cost_krw:numberOrNull(r.year_oilprice),source_registered_at:String(r.data_reg_dt??'').trim()||null,source_row_index:i,source_api:'KEA_CAR_01_LIST',source_url:sourcePage,publishable:false,match_status:'unmatched'}));}
function writeStatus(obj){fs.writeFileSync(statusPath,JSON.stringify(obj,null,2)+'\n')}

if(!keyRaw){writeStatus({ok:false,status:'missing_service_key',fetched_at:fetchedAt,endpoint,source_url:sourcePage,snapshot_exists:fs.existsSync(rawPath)});console.log('KEA API skipped: DATA_GO_KR_SERVICE_KEY missing');process.exit(0)}

try{
  const first=await getPage(1);let rows=[...first.rows],total=first.total||first.rows.length,pages=Math.max(1,Math.ceil(total/pageSize));
  for(let page=2;page<=pages;page++){const next=await getPage(page);rows.push(...next.rows);if(page%10===0||page===pages)console.log(`KEA page ${page}/${pages}: ${rows.length}/${total}`)}
  const dedup=new Map();for(const r of rows){const k=String(r.rqno??stableId(r));dedup.set(k,r)}rows=[...dedup.values()];
  const raw={schema_version:1,source:'한국에너지공단 자동차 에너지효율등급 정보조회 서비스',source_url:sourcePage,endpoint,fetched_at:fetchedAt,total_count:total,row_count:rows.length,page_size:pageSize,rows};
  const normalized=normalize(rows);
  fs.writeFileSync(rawPath,JSON.stringify(raw,null,2)+'\n');fs.writeFileSync(normalizedPath,JSON.stringify({schema_version:1,source_url:sourcePage,fetched_at:fetchedAt,row_count:normalized.length,rows:normalized},null,2)+'\n');fs.writeFileSync(unmatchedPath,JSON.stringify({schema_version:1,fetched_at:fetchedAt,row_count:normalized.length,rows:normalized},null,2)+'\n');
  writeStatus({ok:true,status:'fetched',fetched_at:fetchedAt,endpoint,source_url:sourcePage,api_total_count:total,snapshot_rows:rows.length,normalized_rows:normalized.length});console.log(`KEA API fetched ${rows.length} rows (reported ${total})`);
}catch(error){
  const message=String(error?.message||error);const permission=/PERMISSION|ACCESS_DENIED|SERVICE_ACCESS|SERVICE_KEY|30:|20:/i.test(message);writeStatus({ok:false,status:permission?'permission_required':'fetch_failed',fetched_at:fetchedAt,endpoint,source_url:sourcePage,error:message.slice(0,700),snapshot_exists:fs.existsSync(rawPath)});console.error(`KEA API fetch failed: ${message}`);if(!fs.existsSync(rawPath))process.exitCode=2;
}

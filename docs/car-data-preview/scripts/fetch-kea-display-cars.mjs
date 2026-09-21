import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addDataGoServiceKey, dataGoServiceKeys } from './data-go-service-key.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rawDir=path.join(root,'data','raw');
const stagingDir=path.join(root,'data','staging');
const generatedDir=path.join(root,'data','generated');
const serviceKeys=dataGoServiceKeys();
const nativeEndpoint='https://apis.data.go.kr/B553530/CAREFF/CAREFF_LIST';
const nativeSourcePage='https://www.data.go.kr/data/15139827/openapi.do';
const csvSourcePage='https://www.data.go.kr/data/15083023/fileData.do';
const csvUrl='https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003644543&fileDetailSn=1&insertDataPrcus=N';
const fetchedAt=new Date().toISOString();
const nativePageSize=100;

fs.mkdirSync(rawDir,{recursive:true});
fs.mkdirSync(stagingDir,{recursive:true});
fs.mkdirSync(generatedDir,{recursive:true});
const rawPath=path.join(rawDir,'kea-car-display.json');
const normalizedPath=path.join(stagingDir,'kea-car-display-normalized.json');
const statusPath=path.join(generatedDir,'kea-display-status.json');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function pick(row,...keys){for(const k of keys){if(row?.[k]!==undefined&&row?.[k]!==null&&String(row[k]).trim()!=='')return row[k]}return null}
function numberOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const m=String(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function stableId(row){return 'kea-display-'+crossSourceId(row).slice(0,18)}
function identityText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/(?:주식회사|\(주\)|㈜)/g,'').replace(/[^0-9a-z가-힣]+/g,'')}
function crossSourceId(row){const base=[
  identityText(pick(row,'COMP_NM','제조(수입사)','제조사','ENTP_NM','ENTP_NAME','MAKER','MANUFACTURER')),
  identityText(pick(row,'모델명','MODEL_NM','MODEL_NAME','CAR_NM','CAR_NAME','MODEL')),
  numberOrNull(pick(row,'DISPLAY_EFF','복합_연비','복합연비','MILEAGE','FUEL_EFFICIENCY','COMB_EFF'))??'',
  numberOrNull(pick(row,'URBAN_EFF','도심_연비','도심연비','CITY_MILEAGE','CITY_EFF'))??'',
  numberOrNull(pick(row,'HIGHWAY_EFF','고속도로_연비','고속도로연비','HIGHWAY_MILEAGE','HWY_MILEAGE'))??'',
  numberOrNull(pick(row,'RANGE_PER_CHARGE','1회충전주행거리','1회충전거리','DRIVING_RANGE','RANGE_KM'))??''
].join('|');return crypto.createHash('sha1').update(base).digest('hex')}
function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);field='';if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[]}else field+=ch}if(field||row.length){row.push(field);rows.push(row)}if(!rows.length)return[];const headers=rows.shift().map((h,i)=>(i===0?h.replace(/^\uFEFF/,''):h).trim());return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]??''])))}
function redact(s){return String(s||'').replace(/serviceKey=[^&\s"']+/gi,'serviceKey=[REDACTED]').slice(0,1200)}
async function requestText(url,{timeout=45000,attempts=3}={}){let last;for(let i=1;i<=attempts;i++){try{const res=await fetch(url,{headers:{'user-agent':'pm-lab-car-preview/1.0','accept':'application/json,text/csv,*/*'},redirect:'follow',signal:AbortSignal.timeout(timeout)});const text=await res.text();if(!res.ok)throw new Error(`HTTP ${res.status}: ${text.slice(0,500)}`);return text}catch(e){last=e;if(i<attempts)await sleep(i*800)}}try{return execFileSync('curl',['-fsSL','--retry','3','--retry-all-errors','--connect-timeout','10','--max-time','70','-A','pm-lab-car-preview/1.0',String(url)],{encoding:'utf8',maxBuffer:64*1024*1024})}catch(e){throw new Error(`request failed: ${redact(last?.message||e?.message||e)}`)}}
function normalize(rows,transport,sourceUrl){return rows.map((r,i)=>{const rowTransport=r.__source_transport||transport;return ({
  source_record_id:stableId(r),
  maker_raw:String(pick(r,'COMP_NM','제조(수입사)','제조사','ENTP_NM','ENTP_NAME','MAKER','MANUFACTURER','MNFCT_NM')??'').trim()||null,
  model_raw:String(pick(r,'모델명','MODEL_NM','MODEL_NAME','CAR_NM','CAR_NAME','MODEL')??'').trim()||null,
  vehicle_class_raw:String(pick(r,'CAR_KIND','차종','CAR_TYPE','CAR_TY','VHCL_TYPE')??'').trim()||null,
  type_raw:String(pick(r,'FUEL_NM','유형','FUEL','FUEL_TYPE','TYPE','USE_FUEL','ENERGY_TYPE')??'').trim()||null,
  displacement_cc:numberOrNull(pick(r,'ENGINE_DISPLACEMENT','배기량','DISPLACEMENT')),
  combined_efficiency:numberOrNull(pick(r,'DISPLAY_EFF','복합_연비','복합연비','MILEAGE','FUEL_EFFICIENCY','COMB_MILEAGE','COMB_EFF','EFFICIENCY')),
  city_efficiency:numberOrNull(pick(r,'URBAN_EFF','도심_연비','도심연비','CITY_MILEAGE','CITY_EFF')),
  highway_efficiency:numberOrNull(pick(r,'고속도로_연비','고속도로연비','HIGHWAY_MILEAGE','HWY_MILEAGE','HIGHWAY_EFF')),
  range_km:numberOrNull(pick(r,'RANGE_PER_CHARGE','1회충전주행거리','1회충전거리','ONE_CHARGE_RANGE','DRIVING_RANGE','RANGE_KM')),
  efficiency_grade:numberOrNull(pick(r,'등급','GRADE','EFF_GRADE','EFFICIENCY_GRADE')),
  co2_g_km:numberOrNull(pick(r,'CO2_OUTPUT','CO2','co2','이산화탄소배출량')),
  official_annual_fuel_cost_krw:numberOrNull(pick(r,'ESTIMATED_FUEL_COST','연간유류비')),
  source_row_index:Number.isInteger(r.__source_row_index)?r.__source_row_index:i,source_dataset:rowTransport==='native_api'?'KEA_CAREFF_LIST':'KEA_DISPLAY_EFFICIENCY_20260424',transport:rowTransport,source_url:rowTransport==='native_api'?nativeSourcePage:sourceUrl,publishable:false,match_status:'unmatched'
})})}
function mergeRows(csvRows,apiRows){const merged=new Map();for(const [index,row] of csvRows.entries())merged.set(crossSourceId(row),{...row,__source_transport:'csv',__source_row_index:index});for(const [index,row] of apiRows.entries())merged.set(crossSourceId(row),{...row,__source_transport:'native_api',__source_row_index:index});return[...merged.values()]}
function persist(rows,{transport,sourceUrl,endpoint=null}){const norm=normalize(rows,transport,sourceUrl);const usable=norm.filter(r=>r.model_raw&&r.combined_efficiency!=null).length;if(rows.length&&usable/rows.length<0.25)throw new Error(`source schema not recognized: usable ${usable}/${rows.length}`);fs.writeFileSync(rawPath,JSON.stringify({schema_version:2,source:transport==='api+csv'?'한국에너지공단 자동차 표시연비 API + 보관 CSV':transport==='native_api'?'한국에너지공단 자동차 표시연비 목록 조회 서비스':'한국에너지공단 자동차 표시연비 정보_20260424',source_url:sourceUrl,endpoint,csv_url:['csv','api+csv'].includes(transport)?csvUrl:null,fetched_at:fetchedAt,transport,row_count:rows.length,rows},null,2)+'\n');fs.writeFileSync(normalizedPath,JSON.stringify({schema_version:2,source_url:sourceUrl,fetched_at:fetchedAt,transport,row_count:norm.length,usable_rows:usable,rows:norm},null,2)+'\n');return{count:norm.length,usable}}
function status(obj){fs.writeFileSync(statusPath,JSON.stringify(obj,null,2)+'\n')}
function arraysDeep(obj,depth=0){if(depth>8||obj==null)return[];if(Array.isArray(obj))return obj.length&&obj.every(x=>x&&typeof x==='object'&&!Array.isArray(x))?[obj]:obj.flatMap(x=>arraysDeep(x,depth+1));if(typeof obj==='object')return Object.values(obj).flatMap(x=>arraysDeep(x,depth+1));return[]}
function nativeItems(payload){const direct=[payload?.response?.body?.items?.item,payload?.response?.body?.items,payload?.body?.items?.item,payload?.body?.items,payload?.items?.item,payload?.items,payload?.data,payload?.result].find(Array.isArray);if(direct)return direct;const candidates=arraysDeep(payload).filter(a=>a.length);return candidates.sort((a,b)=>b.length-a.length)[0]||[]}
function nativeTotal(payload){return Number(payload?.response?.body?.totalCount??payload?.body?.totalCount??payload?.totalCount??0)||0}
function nativeError(payload,text){const auth=payload?.OpenAPI_ServiceResponse?.cmmMsgHeader??payload?.response?.header??payload?.header;if(auth?.returnAuthMsg||auth?.errMsg)return `${auth.returnReasonCode||''}: ${auth.returnAuthMsg||auth.errMsg}`;const code=auth?.resultCode??payload?.resultCode;const message=auth?.resultMsg??payload?.resultMsg;if(code&&String(code)!=='00'&&String(code)!=='0')return `${code}: ${message||'API error'}`;if(/SERVICE_KEY|PERMISSION_DENIED|ACCESS_DENIED/i.test(text))return text.slice(0,500);return null}

let nativeFailure=null;
let nativeResult=null;
for(let keyIndex=0;keyIndex<serviceKeys.length;keyIndex++){
  const serviceKey=serviceKeys[keyIndex];
  try{let page=1,rows=[],total=0;while(true){const u=addDataGoServiceKey(new URL(nativeEndpoint),serviceKey);u.searchParams.set('pageNo',String(page));u.searchParams.set('numOfRows',String(nativePageSize));u.searchParams.set('apiType','json');const text=await requestText(u,{timeout:40000,attempts:2});let j;try{j=JSON.parse(text)}catch{throw new Error(`CAREFF non-JSON response: ${text.slice(0,300)}`)}const err=nativeError(j,text);if(err)throw new Error(err);const data=nativeItems(j);if(!data.length)break;rows.push(...data);total=nativeTotal(j)||total||rows.length;console.log(`CAREFF page ${page}: ${rows.length}/${total||'?'}`);if((total&&rows.length>=total)||data.length<nativePageSize)break;if(++page>100)throw new Error('CAREFF page safety limit exceeded')}if(!rows.length)throw new Error('CAREFF returned zero rows');nativeResult={rows,total:total||rows.length,keySlot:keyIndex+1};console.log(`KEA CAREFF API verified ${rows.length} live rows`);break}catch(e){nativeFailure=redact(e?.message||e);console.error(`KEA CAREFF key slot ${keyIndex+1} unavailable: ${nativeFailure}`)}
}

try{const text=await requestText(csvUrl,{timeout:65000,attempts:3});const csvRows=parseCsv(text);if(!csvRows.length)throw new Error('CSV returned zero rows');const rows=nativeResult?mergeRows(csvRows,nativeResult.rows):csvRows;const crossSourceDuplicates=nativeResult?csvRows.length+nativeResult.rows.length-rows.length:0;if(nativeResult&&crossSourceDuplicates<1)throw new Error('API and CSV overlap could not be identified');const transport=nativeResult?'api+csv':'csv';const p=persist(rows,{transport,sourceUrl:csvSourcePage,endpoint:nativeResult?nativeEndpoint:null});status({ok:true,status:nativeResult?'fetched_native_api_and_csv':'fetched_csv_fallback',transport,fetched_at:fetchedAt,source_url:csvSourcePage,csv_url:csvUrl,api_source_url:nativeSourcePage,api_endpoint:nativeEndpoint,csv_rows:csvRows.length,api_rows:nativeResult?.rows.length||0,api_total_count:nativeResult?.total||0,cross_source_duplicates:crossSourceDuplicates,merged_rows:p.count,rows:p.count,usable_rows:p.usable,key_slot:nativeResult?.keySlot||null,native_api_error:nativeFailure?.slice(0,500)||null});console.log(`KEA display source persisted ${p.count} rows from ${csvRows.length} CSV rows${nativeResult?` plus ${nativeResult.rows.length} live API rows after removing ${crossSourceDuplicates} cross-source duplicates`:''}`)}catch(e){const csvError=redact(e?.message||e);if(csvError.includes('overlap could not be identified')){status({ok:false,status:'merge_integrity_failed',fetched_at:fetchedAt,source_url:csvSourcePage,api_rows:nativeResult?.rows.length||0,merge_error:csvError,snapshot_exists:fs.existsSync(rawPath)});console.error(`KEA display merge failed: ${csvError}`);process.exitCode=2}else if(nativeResult){const rows=nativeResult.rows.map(row=>({...row,__source_transport:'native_api'})),p=persist(rows,{transport:'native_api',sourceUrl:nativeSourcePage,endpoint:nativeEndpoint});status({ok:true,status:'fetched_native_api_csv_unavailable',transport:'native_api',fetched_at:fetchedAt,source_url:nativeSourcePage,api_endpoint:nativeEndpoint,api_rows:p.count,api_total_count:nativeResult.total,usable_rows:p.usable,key_slot:nativeResult.keySlot,csv_error:csvError.slice(0,500)});console.log(`KEA display native API persisted ${p.count} rows; CSV unavailable`)}else{status({ok:false,status:'fetch_failed',fetched_at:fetchedAt,source_url:csvSourcePage,native_api_error:nativeFailure?.slice(0,500)||null,csv_error:csvError.slice(0,500),api_rows:0,snapshot_exists:fs.existsSync(rawPath)});console.error(`KEA display source failed: ${csvError}`);process.exitCode=2}}

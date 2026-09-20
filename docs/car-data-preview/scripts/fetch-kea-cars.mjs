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
const endpoint='https://apis.data.go.kr/B553530/CAREFF/CAREFF_LIST';
const csvUrl=(process.env.KEA_CAR_CSV_URL||'').trim();
const sourcePage='https://www.data.go.kr/data/15139827/openapi.do';
const csvSourcePage='https://www.data.go.kr/data/15083023/fileData.do';
const fetchedAt=new Date().toISOString();
const pageSize=100;

fs.mkdirSync(rawDir,{recursive:true});
fs.mkdirSync(stagingDir,{recursive:true});
fs.mkdirSync(generatedDir,{recursive:true});

const statusPath=path.join(generatedDir,'kea-api-status.json');
const rawPath=path.join(rawDir,'kea-car-efficiency.json');
const normalizedPath=path.join(stagingDir,'kea-car-efficiency-normalized.json');
const unmatchedPath=path.join(stagingDir,'kea-car-efficiency-unmatched.json');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function pick(row,...keys){for(const k of keys){if(row?.[k]!==undefined&&row?.[k]!==null&&String(row[k]).trim()!=='')return row[k]}return null}
function numberOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const m=String(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function gradeOrNull(v){const m=String(v??'').match(/(\d+)/);return m?Number(m[1]):null}
function stableId(row){const base=String(pick(row,'rqno','신청번호','id','ID')||'')||`${pick(row,'enterprise','COMP_NM','제조(수입사)','제조사','maker','manufacturer')||''}|${pick(row,'modelname','MODEL_NM','모델명','modelName','model')||''}|${pick(row,'displacement','ENGINE_DISPLACEMENT','배기량','displacement_cc')||''}|${pick(row,'mileage','DISPLAY_EFF','복합_연비','복합연비','combined')||''}|${pick(row,'URBAN_EFF','HIGHWAY_EFF','RANGE_PER_CHARGE','도심_연비','고속도로_연비','1회충전주행거리')||''}`;return 'kea-'+crypto.createHash('sha1').update(base).digest('hex').slice(0,16)}
function itemsFrom(payload){const candidates=[payload?.response?.body?.items?.item,payload?.response?.body?.items,payload?.body?.items?.item,payload?.body?.items,payload?.items?.item,payload?.items,payload?.data,payload?.result,payload?.records];for(const c of candidates){if(Array.isArray(c))return c;if(c&&typeof c==='object'&&!Array.isArray(c))return[c]}return []}
function totalFrom(payload){return Number(payload?.response?.body?.totalCount??payload?.body?.totalCount??payload?.totalCount??payload?.total_count??0)||0}
function apiError(payload,text){const code=payload?.response?.header?.resultCode??payload?.header?.resultCode??payload?.resultCode;const msg=payload?.response?.header?.resultMsg??payload?.header?.resultMsg??payload?.resultMsg;if(code&&String(code)!=='00'&&String(code)!=='0')return `${code}: ${msg||'API error'}`;if(/SERVICE_KEY|PERMISSION_DENIED|ACCESS_DENIED|LIMITED_NUMBER/i.test(text))return text.slice(0,500);return null}
function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);field='';if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[]}else field+=ch}if(field||row.length){row.push(field);rows.push(row)}if(!rows.length)return[];const headers=rows.shift().map((h,i)=>(i===0?h.replace(/^\uFEFF/,''):h).trim());return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]??''])))}
function redact(msg){return String(msg||'').replace(/serviceKey=[^&\s]+/gi,'serviceKey=[REDACTED]').replace(/GKiB[^\s"']+/g,'[REDACTED]')}
async function requestText(url,{timeoutMs=30000,attempts=3}={}){
  let last=null;
  for(let i=1;i<=attempts;i++){
    try{
      const res=await fetch(url,{headers:{'user-agent':'pm-lab-car-preview/1.0','accept':'application/json,text/plain,*/*'},redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
      const text=await res.text();
      if(!res.ok)throw new Error(`HTTP ${res.status}: ${text.slice(0,500)}`);
      return text;
    }catch(error){last=error;if(i<attempts)await sleep(700*i)}
  }
  try{
    const config=`silent\nshow-error\nfail\nlocation\nretry = 3\nretry-all-errors\nconnect-timeout = 10\nmax-time = 45\nuser-agent = "pm-lab-car-preview/1.0"\nurl = "${String(url).replace(/"/g,'\\"')}"\n`;
    return execFileSync('curl',['--config','-'],{input:config,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});
  }catch(error){throw new Error(`network request failed after retries: ${redact(last?.message||error?.message||'unknown error')}`)}
}
async function getPage(serviceKey,pageNo){const url=addDataGoServiceKey(new URL(endpoint),serviceKey);url.searchParams.set('pageNo',String(pageNo));url.searchParams.set('numOfRows',String(pageSize));url.searchParams.set('apiType','json');const text=await requestText(url,{timeoutMs:30000,attempts:3});let payload=null;try{payload=JSON.parse(text)}catch{}const err=apiError(payload,text);if(err)throw new Error(err);if(!payload)throw new Error(`Non-JSON response: ${text.slice(0,300)}`);return{payload,rows:itemsFrom(payload),total:totalFrom(payload)}}
async function getCsv(){const text=await requestText(csvUrl,{timeoutMs:45000,attempts:3});const rows=parseCsv(text);if(!rows.length)throw new Error('CSV contains no rows');return rows}
function normalize(rows,sourceKind,sourceUrl){return rows.map((r,i)=>({
  source_record_id:String(pick(r,'rqno','신청번호','id','ID')??stableId(r)),candidate_id:stableId(r),
  maker_raw:String(pick(r,'enterprise','COMP_NM','제조(수입사)','제조사','maker','manufacturer','company')??'').trim()||null,
  model_raw:String(pick(r,'modelname','MODEL_NM','모델명','modelName','model','차명')??'').trim()||null,
  vehicle_class_raw:String(pick(r,'CAR_KIND','CAR_TYPE','차종','vehicleClass','carType')??'').trim()||null,
  type_raw:String(pick(r,'FUEL_NM','유형','type','fuelType','연료')??'').trim()||null,
  displacement_cc:numberOrNull(pick(r,'displacement','ENGINE_DISPLACEMENT','배기량','displacement_cc','engineDisplacement')),
  combined_efficiency:numberOrNull(pick(r,'mileage','DISPLAY_EFF','복합_연비','복합연비','combinedMileage','combined_efficiency','복합')),
  city_efficiency:numberOrNull(pick(r,'URBAN_EFF','도심_연비','도심연비','cityMileage','city_efficiency','도심')),
  highway_efficiency:numberOrNull(pick(r,'HIGHWAY_EFF','고속도로_연비','고속도로연비','highwayMileage','highway_efficiency','고속')),
  range_km:numberOrNull(pick(r,'RANGE_PER_CHARGE','1회충전주행거리','1회충전거리','range','range_km','drivingRange')),
  efficiency_grade:gradeOrNull(pick(r,'GRADE','grade','등급','efficiencyGrade')),
  co2_g_km:numberOrNull(pick(r,'CO2_OUTPUT','co2','CO2','co2Emission','이산화탄소배출량')),
  official_annual_fuel_cost_krw:numberOrNull(pick(r,'ESTIMATED_FUEL_COST','year_oilprice','연간유류비','annualFuelCost')),
  source_registered_at:String(pick(r,'DATA_REG_DT','data_reg_dt','등록일','기준일','date')??'').trim()||null,
  source_row_index:i,source_api:sourceKind,source_url:sourceUrl,publishable:false,match_status:'unmatched'
}));}
function persist(rows,{sourceName,sourceUrl,transport,totalCount}){const dedup=new Map();for(const r of rows)dedup.set(String(pick(r,'rqno','신청번호','id','ID')??stableId(r)),r);const unique=[...dedup.values()];const raw={schema_version:2,source:sourceName,source_url:sourceUrl,endpoint:transport==='api'?endpoint:null,csv_url:transport==='csv'?csvUrl:null,transport,fetched_at:fetchedAt,total_count:totalCount??unique.length,row_count:unique.length,page_size:transport==='api'?pageSize:null,rows:unique};const normalized=normalize(unique,transport==='api'?'KEA_API':'KEA_CSV',sourceUrl);fs.writeFileSync(rawPath,JSON.stringify(raw,null,2)+'\n');fs.writeFileSync(normalizedPath,JSON.stringify({schema_version:2,source_url:sourceUrl,transport,fetched_at:fetchedAt,row_count:normalized.length,rows:normalized},null,2)+'\n');fs.writeFileSync(unmatchedPath,JSON.stringify({schema_version:2,fetched_at:fetchedAt,row_count:normalized.length,rows:normalized},null,2)+'\n');return normalized.length}
function writeStatus(obj){fs.writeFileSync(statusPath,JSON.stringify(obj,null,2)+'\n')}

let apiFailure=null;
for(let keyIndex=0;keyIndex<serviceKeys.length;keyIndex++){
  const serviceKey=serviceKeys[keyIndex];
  try{const first=await getPage(serviceKey,1);let rows=[...first.rows],total=first.total||first.rows.length,pages=Math.max(1,Math.ceil(total/pageSize));for(let page=2;page<=pages;page++){const next=await getPage(serviceKey,page);rows.push(...next.rows);if(page%10===0||page===pages)console.log(`KEA page ${page}/${pages}: ${rows.length}/${total}`)}const count=persist(rows,{sourceName:'한국에너지공단 자동차 표시연비 목록 조회 서비스',sourceUrl:sourcePage,transport:'api',totalCount:total});writeStatus({ok:true,status:'fetched',transport:'api',fetched_at:fetchedAt,endpoint,source_url:sourcePage,api_total_count:total,normalized_rows:count,key_slot:keyIndex+1});console.log(`KEA API fetched ${count} rows`);process.exit(0)}catch(error){apiFailure=redact(error?.message||error);console.error(`KEA API key slot ${keyIndex+1} failed: ${apiFailure}`)}
}

if(csvUrl){try{const rows=await getCsv();const count=persist(rows,{sourceName:'한국에너지공단 자동차 표시연비 정보 CSV',sourceUrl:csvSourcePage,transport:'csv',totalCount:rows.length});writeStatus({ok:true,status:'fetched_fallback_csv',transport:'csv',fetched_at:fetchedAt,source_url:csvSourcePage,csv_rows:rows.length,normalized_rows:count,api_error:apiFailure?apiFailure.slice(0,500):null});console.log(`KEA CSV fallback fetched ${count} rows`);process.exit(0)}catch(error){const csvFailure=redact(error?.message||error);console.error(`KEA CSV fallback failed: ${csvFailure}`);writeStatus({ok:false,status:'fetch_failed',fetched_at:fetchedAt,endpoint,source_url:sourcePage,api_error:apiFailure?.slice(0,500)||null,csv_error:csvFailure.slice(0,500),snapshot_exists:fs.existsSync(rawPath)});if(!fs.existsSync(rawPath))process.exit(2);process.exit(0)}}

const permission=/PERMISSION|ACCESS_DENIED|SERVICE_ACCESS|SERVICE_KEY|등록되지 않은 서비스키|reasonCode.?30/i.test(apiFailure||'');writeStatus({ok:false,status:serviceKeys.length?(permission?'permission_required':'fetch_failed'):'missing_service_key',fetched_at:fetchedAt,endpoint,source_url:sourcePage,error:apiFailure?.slice(0,700)||null,key_slots_tried:serviceKeys.length,csv_fallback_configured:false,snapshot_exists:fs.existsSync(rawPath)});if(!fs.existsSync(rawPath))process.exitCode=2;

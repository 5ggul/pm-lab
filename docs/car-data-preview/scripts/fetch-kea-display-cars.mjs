import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rawDir=path.join(root,'data','raw');
const stagingDir=path.join(root,'data','staging');
const generatedDir=path.join(root,'data','generated');
const keyRaw=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
const sourcePage='https://www.data.go.kr/data/15083023/fileData.do';
const uddi='c5d3f252-f55b-469c-8573-e53160dd9e69';
const apiEndpoint=`https://api.odcloud.kr/api/15083023/v1/uddi:${uddi}`;
const csvUrl='https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003644543&fileDetailSn=1&insertDataPrcus=N';
const fetchedAt=new Date().toISOString();
const perPage=1000;
fs.mkdirSync(rawDir,{recursive:true});fs.mkdirSync(stagingDir,{recursive:true});fs.mkdirSync(generatedDir,{recursive:true});
const rawPath=path.join(rawDir,'kea-car-display.json');
const normalizedPath=path.join(stagingDir,'kea-car-display-normalized.json');
const statusPath=path.join(generatedDir,'kea-display-status.json');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function safeKey(raw){try{return decodeURIComponent(raw)}catch{return raw}}
function pick(row,...keys){for(const k of keys){if(row?.[k]!==undefined&&row?.[k]!==null&&String(row[k]).trim()!=='')return row[k]}return null}
function numberOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const m=String(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function stableId(row){const base=`${pick(row,'제조(수입사)','제조사')||''}|${pick(row,'모델명','model')||''}|${pick(row,'유형','type')||''}|${pick(row,'복합_연비','복합연비')||''}|${pick(row,'도심_연비','도심연비')||''}|${pick(row,'고속도로_연비','고속도로연비')||''}|${pick(row,'1회충전주행거리','1회충전거리')||''}`;return 'kea-display-'+crypto.createHash('sha1').update(base).digest('hex').slice(0,18)}
function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);field='';if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[]}else field+=ch}if(field||row.length){row.push(field);rows.push(row)}if(!rows.length)return[];const headers=rows.shift().map((h,i)=>(i===0?h.replace(/^\uFEFF/,''):h).trim());return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]??''])))}
function redact(s){return String(s||'').replace(/serviceKey=[^&\s]+/gi,'serviceKey=[REDACTED]')}
async function requestText(url,{timeout=40000,attempts=3}={}){let last;for(let i=1;i<=attempts;i++){try{const res=await fetch(url,{headers:{'user-agent':'pm-lab-car-preview/1.0','accept':'application/json,text/csv,*/*'},redirect:'follow',signal:AbortSignal.timeout(timeout)});const text=await res.text();if(!res.ok)throw new Error(`HTTP ${res.status}: ${text.slice(0,500)}`);return text}catch(e){last=e;if(i<attempts)await sleep(i*700)}}try{return execFileSync('curl',['-fsSL','--retry','3','--retry-all-errors','--connect-timeout','10','--max-time','60','-A','pm-lab-car-preview/1.0',String(url)],{encoding:'utf8',maxBuffer:64*1024*1024})}catch(e){throw new Error(`request failed: ${redact(last?.message||e?.message||e)}`)}}
function normalize(rows,transport){return rows.map((r,i)=>({source_record_id:stableId(r),maker_raw:String(pick(r,'제조(수입사)','제조사')??'').trim()||null,model_raw:String(pick(r,'모델명','model')??'').trim()||null,vehicle_class_raw:String(pick(r,'차종')??'').trim()||null,type_raw:String(pick(r,'유형')??'').trim()||null,combined_efficiency:numberOrNull(pick(r,'복합_연비','복합연비')),city_efficiency:numberOrNull(pick(r,'도심_연비','도심연비')),highway_efficiency:numberOrNull(pick(r,'고속도로_연비','고속도로연비')),range_km:numberOrNull(pick(r,'1회충전주행거리','1회충전거리')),efficiency_grade:numberOrNull(pick(r,'등급')),source_row_index:i,source_dataset:'KEA_DISPLAY_EFFICIENCY_20260424',transport,source_url:sourcePage,publishable:false,match_status:'unmatched'}))}
function persist(rows,transport){const norm=normalize(rows,transport);fs.writeFileSync(rawPath,JSON.stringify({schema_version:1,source:'한국에너지공단 자동차 표시연비 정보_20260424',source_url:sourcePage,api_endpoint:transport==='api'?apiEndpoint:null,csv_url:transport==='csv'?csvUrl:null,uddi,fetched_at:fetchedAt,transport,row_count:rows.length,rows},null,2)+'\n');fs.writeFileSync(normalizedPath,JSON.stringify({schema_version:1,source_url:sourcePage,fetched_at:fetchedAt,transport,row_count:norm.length,rows:norm},null,2)+'\n');return norm.length}
function status(obj){fs.writeFileSync(statusPath,JSON.stringify(obj,null,2)+'\n')}

let apiError=null;
if(keyRaw){try{let page=1,rows=[],total=null;while(true){const u=new URL(apiEndpoint);u.searchParams.set('page',String(page));u.searchParams.set('perPage',String(perPage));u.searchParams.set('returnType','JSON');u.searchParams.set('serviceKey',safeKey(keyRaw));const text=await requestText(u);const j=JSON.parse(text);if(j?.code&&Number(j.code)!==0&&String(j.code)!=='INFO-000')throw new Error(JSON.stringify(j).slice(0,700));const data=Array.isArray(j?.data)?j.data:[];rows.push(...data);total=Number(j?.totalCount??j?.matchCount??total??data.length);console.log(`KEA display API page ${page}: ${rows.length}/${total||'?'}`);if(!data.length||rows.length>=total||data.length<perPage)break;page++;if(page>100)throw new Error('page safety limit exceeded')}if(rows.length){const count=persist(rows,'api');status({ok:true,status:'fetched',transport:'api',fetched_at:fetchedAt,source_url:sourcePage,endpoint:apiEndpoint,rows:count});console.log(`KEA display API fetched ${count} rows`);process.exit(0)}throw new Error('API returned zero rows')}catch(e){apiError=redact(e?.message||e);console.error(`KEA display API failed: ${apiError}`)}}
try{const text=await requestText(csvUrl,{timeout:60000,attempts:3});const rows=parseCsv(text);if(!rows.length)throw new Error('CSV returned zero rows');const count=persist(rows,'csv');status({ok:true,status:'fetched_csv_fallback',transport:'csv',fetched_at:fetchedAt,source_url:sourcePage,csv_url:csvUrl,rows:count,api_error:apiError?.slice(0,500)||null});console.log(`KEA display CSV fetched ${count} rows`)}catch(e){const csvError=redact(e?.message||e);status({ok:false,status:'fetch_failed',fetched_at:fetchedAt,source_url:sourcePage,api_error:apiError?.slice(0,500)||null,csv_error:csvError.slice(0,500),snapshot_exists:fs.existsSync(rawPath)});console.error(`KEA display source failed: ${csvError}`);if(!fs.existsSync(rawPath))process.exitCode=2}

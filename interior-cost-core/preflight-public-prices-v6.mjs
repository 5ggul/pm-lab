import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {collectLiveRows,buildDataset,resolveQueryRange,API_BASE} from './collect-pps-g2b-price-info.mjs';
import {validateReadyDataset} from './v6-review/validate-public-unit-prices-ready-v6.mjs';

const DEFAULT_OUT_DIR='/tmp/interior-v6-public-price-preflight';
const DAY=86400000;
const topCounts=(values,limit=12)=>[...values.reduce((m,v)=>{const k=String(v??'').trim()||'(blank)';m.set(k,(m.get(k)||0)+1);return m},new Map())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).slice(0,limit).map(([value,count])=>({value,count}));
const dateMs=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])):NaN};
const headerValue=(res,name)=>{try{return String(res?.headers?.get?.(name)||'').trim()}catch{return ''}};

export function classifyCollectionError(value){
  const msg=String(value?.message??value??'');
  if(msg.includes('no valid PPS G2B unit price rows'))return{code:'no_rows_in_query_windows',scope:'source_coverage',owner_action:'인증키가 아니라 발표일 조회범위 문제다. 짧은 날짜 구간으로 분할 조회하고 실제 발표일 분포를 확인'};
  if(msg.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')||msg.includes('등록되지 않은 서비스키'))return{code:'service_key_not_registered',scope:'gateway_authorization_response',owner_action:'공통 인증키 교체로 단정하지 말고 동일 키의 정상 API 호출과 15129415 게이트웨이 응답을 교차 확인'};
  if(msg.includes('SERVICE_ACCESS_DENIED_ERROR')||msg.includes('PERMISSION_DENIED'))return{code:'service_access_denied',scope:'service_authorization',owner_action:'15129415 활용 상태와 게이트웨이 응답을 확인'};
  if(msg.includes('DEADLINE_HAS_EXPIRED_ERROR'))return{code:'service_key_expired',scope:'credential',owner_action:'공공데이터포털 인증키 이용기간 상태 확인'};
  if(msg.includes('BLACKLIST_IP_ACCESS_ERROR'))return{code:'blacklisted_egress_ip',scope:'network_egress',owner_action:'호출 서버 IP 차단 상태를 공공데이터포털 또는 제공기관에 확인'};
  if(msg.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR')||msg.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR'))return{code:'rate_limit',scope:'quota',owner_action:'호출량 초기화 후 재시도하거나 트래픽 증설 확인'};
  if(/fetch failed|CONNECT_TIMEOUT|ETIMEDOUT|ECONNRESET|PROVIDER_TRANSPORT/.test(msg))return{code:'source_transport_error',scope:'network_transport',owner_action:'동일 요청을 제한된 횟수로 재시도하고 지속되면 Data.go.kr 전송 경로 상태 확인'};
  if(msg.includes('HTTP 403'))return{code:'http_403_unclassified',scope:'gateway_or_authorization',owner_action:'sanitized response와 동일 공통키의 다른 정상 호출을 교차해 게이트웨이 상태를 구분'};
  return{code:'collection_error_unclassified',scope:'collector_or_source',owner_action:'sanitized collection error를 확인하고 요청 파라미터·날짜 구간·원천 상태를 점검'};
}

export async function probeGateway({fetchImpl=fetch,apiBase=API_BASE,scheme='https:',start='20260101',end='20260131'}={}){
  const u=new URL(apiBase);u.protocol=scheme;
  u.searchParams.set('numOfRows','1');u.searchParams.set('pageNo','1');u.searchParams.set('type','json');u.searchParams.set('inqryDiv','1');u.searchParams.set('inqryBgnDate',start);u.searchParams.set('inqryEndDate',end);
  try{
    const res=await fetchImpl(u,{redirect:'manual',headers:{accept:'application/json','user-agent':'interior-cost-gateway-probe/6.4'}});
    let body='';try{if(typeof res.text==='function')body=(await res.text()).replace(/\s+/g,' ').trim().slice(0,300)}catch{}
    let location=headerValue(res,'location');if(location){try{const x=new URL(location,u);location=`${x.protocol}//${x.host}${x.pathname}`}catch{location=location.slice(0,180)}}
    return {scheme:u.protocol,status:Number(res.status)||0,ok:Boolean(res.ok),content_type:headerValue(res,'content-type').slice(0,100)||null,server:headerValue(res,'server').slice(0,80)||null,location:location||null,body_snippet:body||null,service_key_sent:false};
  }catch(error){return {scheme:u.protocol,status:0,ok:false,error:String(error?.cause?.code||error?.code||error?.message||error).slice(0,300),service_key_sent:false}}
}

export function buildPreflightReport(dataset,{minRows=5000,maxAgeDays=730,now=new Date(),range=null,collection=null,gatewayProbes=[]}={}){
  const check=validateReadyDataset(dataset,{minRows,maxAgeDays,now});
  const rows=Array.isArray(dataset?.rows)?dataset.rows:[];
  const latest=check.stats.latest_published_date||dataset?.source?.latest_published_date||null;
  const latestMs=dateMs(latest),nowMs=now instanceof Date?now.getTime():new Date(now).getTime();
  const ageDays=Number.isFinite(latestMs)&&Number.isFinite(nowMs)?Math.floor((nowMs-latestMs)/DAY):null;
  return {
    schema_version:'1.2',
    generated_at:(now instanceof Date?now:new Date(now)).toISOString(),
    mode:'read_only_preflight',
    source:{provider:'조달청',public_data_id:'15129415',api_operation:'getStdMarkUprcinfoList',api_base:API_BASE},
    query:range?{start:range.start,end:range.end,days:range.days,window_days:Number(collection?.windowDays??dataset?.source?.query_window_days??0)||null,window_count:Number(collection?.windowCount??dataset?.source?.query_window_count??0)||null,nonempty_window_count:Number(collection?.nonemptyWindowCount??dataset?.source?.nonempty_window_count??0)||0}:null,
    summary:{
      readiness:check.ok?'ready':'blocked',
      published_rows:rows.length,
      minimum_rows:Number(minRows),
      latest_published_date:latest,
      latest_age_days:ageDays,
      maximum_age_days:Number(maxAgeDays),
      work_code_coverage:check.stats.work_code_coverage,
      standard_market_rows:check.stats.standard_market_rows,
      market_construction_rows:check.stats.market_construction_rows,
      source_total_count:Number(collection?.sourceTotalCount??dataset?.source?.source_row_count??0),
      raw_rows:Number(collection?.rawRowCount??dataset?.source?.raw_collected_row_count??0),
      valid_rows:Number(collection?.validRowCount??dataset?.source?.valid_row_count??0),
      query_window_days:Number(collection?.windowDays??dataset?.source?.query_window_days??0)||null,
      query_window_count:Number(collection?.windowCount??dataset?.source?.query_window_count??0)||null,
      nonempty_window_count:Number(collection?.nonemptyWindowCount??dataset?.source?.nonempty_window_count??0)||0
    },
    validator:{ok:check.ok,errors:check.errors,warnings:check.warnings},
    blocker:check.ok?null:{code:'publication_readiness_blocked',scope:'dataset_quality',owner_action:'실수집은 성공했다. validator errors에서 표본수·신선도·필드 품질 중 어떤 공개 조건이 부족한지 확인'},
    gateway_probes:gatewayProbes,
    distribution:{
      publication_dates:topCounts(rows.map(r=>r.published_date),20),
      units:topCounts(rows.map(r=>r.unit),20),
      application_prefixes:topCounts(rows.map(r=>String(r.application_condition||'').split(' · ').slice(0,2).join(' · ')),20)
    },
    safety:{repository_write:false,git_commit:false,git_push:false,production_deploy:false,api_key_in_output:false,http_probe_service_key_sent:false},
    next_action:check.ok?'snapshot is eligible for the publication pipeline after owner approval':'collection succeeded; inspect publication-readiness validator without replacing the shared service key'
  };
}

function failureReport(error,{range,minRows,maxAgeDays,gatewayProbes=[],now=new Date()}={}){
  const blocker=classifyCollectionError(error);
  return {
    schema_version:'1.2',generated_at:now.toISOString(),mode:'read_only_preflight',
    source:{provider:'조달청',public_data_id:'15129415',api_operation:'getStdMarkUprcinfoList',api_base:API_BASE},
    query:range?{start:range.start,end:range.end,days:range.days}:null,
    summary:{readiness:'collection_error',published_rows:0,minimum_rows:Number(minRows),latest_published_date:null,latest_age_days:null,maximum_age_days:Number(maxAgeDays)},
    validator:{ok:false,errors:[`collection:${String(error?.message||error)}`],warnings:[]},
    blocker,
    gateway_probes:gatewayProbes,
    distribution:{publication_dates:[],units:[],application_prefixes:[]},
    safety:{repository_write:false,git_commit:false,git_push:false,production_deploy:false,api_key_in_output:false,http_probe_service_key_sent:false},
    next_action:blocker.owner_action
  };
}

export async function main(env=process.env){
  const outDir=path.resolve(env.PREFLIGHT_OUT_DIR||DEFAULT_OUT_DIR);
  const reportFile=path.join(outDir,'public-price-preflight.json');
  const snapshotFile=path.join(outDir,'public-unit-prices.preflight.json');
  const minRows=Math.max(1,Number(env.PPS_MIN_PUBLISHED_ROWS)||5000);
  const maxAgeDays=Math.max(30,Number(env.PPS_MAX_AGE_DAYS)||730);
  const range=resolveQueryRange(env);
  const perPage=Math.max(1,Math.min(999,Number(env.PPS_PER_PAGE)||999));
  const maxPages=Math.max(1,Math.min(1000,Number(env.PPS_MAX_PAGES)||100));
  const windowDays=Math.max(1,Math.min(31,Number(env.PPS_WINDOW_DAYS)||30));
  const retries=Math.max(1,Math.min(5,Number(env.PPS_RETRIES)||3));
  const strict=env.PREFLIGHT_STRICT==='true';
  fs.mkdirSync(outDir,{recursive:true});
  let report,dataset=null;
  try{
    const collected=await collectLiveRows({apiKey:env.DATA_GO_KR_SERVICE_KEY,start:range.start,end:range.end,perPage,maxPages,minPublishedRows:1,windowDays,retries});
    dataset=buildDataset({...collected,start:range.start,end:range.end,minPublishedRows:minRows});
    report=buildPreflightReport(dataset,{minRows,maxAgeDays,range,collection:collected});
    fs.writeFileSync(snapshotFile,JSON.stringify(dataset,null,2)+'\n');
  }catch(error){
    const gatewayProbes=await Promise.all([
      probeGateway({scheme:'https:',start:range.start,end:range.end}),
      probeGateway({scheme:'http:',start:range.start,end:range.end})
    ]);
    report=failureReport(error,{range,minRows,maxAgeDays,gatewayProbes});
  }
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.validator.ok,mode:report.mode,readiness:report.summary.readiness,blocker:report.blocker,published_rows:report.summary.published_rows,minimum_rows:minRows,latest_published_date:report.summary.latest_published_date,query_window_count:report.summary.query_window_count??null,nonempty_window_count:report.summary.nonempty_window_count??null,gateway_probes:report.gateway_probes,report:reportFile,snapshot:dataset?snapshotFile:null,repository_write:false,production_deploy:false},null,2));
  if(strict&&!report.validator.ok)process.exit(2);
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
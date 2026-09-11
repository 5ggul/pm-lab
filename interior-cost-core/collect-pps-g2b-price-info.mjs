import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const API_BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
const DEFAULT_OUT='interior-cost-core/v6-review/data/public-unit-prices.json';
const DEFAULT_PER_PAGE=999;
const DEFAULT_MAX_PAGES=100;
const DEFAULT_QUERY_DAYS=550;
const DEFAULT_WINDOW_DAYS=30;
const DEFAULT_RETRIES=3;
const SUCCESS_CODES=new Set(['0','00','000']);

export function n(v){
  if(v===null||v===undefined||String(v).trim()==='')return null;
  const x=Number(String(v).replaceAll(',','').trim());
  return Number.isFinite(x)?x:null;
}
export function s(v){return String(v??'').trim()}
export function normalizeDate(v){
  const x=s(v).replace(/[^0-9]/g,'');
  return x.length===8?x:'';
}
function isoDate(v){
  const x=normalizeDate(v);
  return x?`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}`:'';
}
function joinCondition(...parts){return [...new Set(parts.map(s).filter(Boolean))].join(' · ')}
function sumCosts(...values){
  const nums=values.map(n).filter(Number.isFinite);
  if(!nums.length)return null;
  return nums.reduce((a,b)=>a+b,0);
}

export function normalizeLiveRow(row={}){
  const material=n(row.mtrlcstUprc),labor=n(row.lbrcstUprc),expense=n(row.gnrexpnsUprc);
  return {
    published_date:isoDate(row.pblctDate),
    work_code:s(row.qtyCalcCtyclcd),
    name:s(row.prdnm),
    spec:s(row.spec),
    unit:s(row.unit),
    material_cost_won:material,
    labor_cost_won:labor,
    expense_cost_won:expense,
    total_cost_won:sumCosts(material,labor,expense),
    application_condition:joinCondition(row.cnstwkDivCdNm,row.uprcDivNm,row.uprcAplCndtnCntnts),
    _division_code:s(row.cnstwkDivCd),
    _unit_price_type:s(row.uprcDivNm)
  };
}

export function validateLiveRow(r){
  if(!r?.name||!r?.published_date)return false;
  if(!Number.isFinite(r.total_cost_won)||r.total_cost_won<=0)return false;
  for(const k of ['material_cost_won','labor_cost_won','expense_cost_won'])if(r[k]!==null&&(!Number.isFinite(r[k])||r[k]<0))return false;
  return true;
}

function itemsArray(value){
  if(Array.isArray(value))return value;
  if(value&&typeof value==='object'&&'item' in value)return itemsArray(value.item);
  if(value&&typeof value==='object')return [value];
  return [];
}

export function parseLivePayload(json={}){
  const response=json?.response&&typeof json.response==='object'?json.response:json;
  const header=response?.header&&typeof response.header==='object'?response.header:(json?.header||{});
  const body=response?.body&&typeof response.body==='object'?response.body:(json?.body||response||{});
  const resultCode=s(header?.resultCode??body?.resultCode??json?.resultCode);
  const resultMsg=s(header?.resultMsg??body?.resultMsg??json?.resultMsg);
  if(resultCode&&!SUCCESS_CODES.has(resultCode))throw new Error(`PPS API result ${resultCode}${resultMsg?`: ${resultMsg}`:''}`);
  const items=itemsArray(body?.items??response?.items??json?.items??json?.data);
  const totalCount=n(body?.totalCount??response?.totalCount??json?.totalCount);
  const pageNo=n(body?.pageNo??response?.pageNo??json?.pageNo);
  const numOfRows=n(body?.numOfRows??response?.numOfRows??json?.numOfRows);
  return {items,totalCount,pageNo,numOfRows,resultCode,resultMsg};
}

function rowIdentity(r){return [r._division_code,r._unit_price_type,r.work_code,r.name,r.spec,r.unit].join('\u001f')}
export function dedupeLatestRows(rows=[]){
  const latest=new Map();
  for(const row of rows){
    const key=rowIdentity(row),prev=latest.get(key);
    if(!prev||row.published_date>prev.published_date)latest.set(key,row);
  }
  return [...latest.values()]
    .map(({_division_code,_unit_price_type,...row})=>row)
    .sort((a,b)=>b.published_date.localeCompare(a.published_date)||a.work_code.localeCompare(b.work_code,'ko')||a.name.localeCompare(b.name,'ko')||a.spec.localeCompare(b.spec,'ko'));
}

function ymdKst(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(x=>x.type===t)?.value||'';
  return `${get('year')}${get('month')}${get('day')}`;
}
export function shiftYmd(ymd,days){
  const x=normalizeDate(ymd);if(!x)throw new Error(`invalid YYYYMMDD: ${ymd}`);
  const d=new Date(Date.UTC(Number(x.slice(0,4)),Number(x.slice(4,6))-1,Number(x.slice(6,8))));
  d.setUTCDate(d.getUTCDate()+days);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
}
export function splitQueryRange(start,end,windowDays=DEFAULT_WINDOW_DAYS){
  const a=normalizeDate(start),b=normalizeDate(end),size=Math.max(1,Math.min(31,Number(windowDays)||DEFAULT_WINDOW_DAYS));
  if(!a||!b||a>b)throw new Error(`invalid PPS query range: ${start}-${end}`);
  const windows=[];let cursor=a;
  while(cursor<=b){
    const candidate=shiftYmd(cursor,size-1),windowEnd=candidate>b?b:candidate;
    windows.push({start:cursor,end:windowEnd});
    cursor=shiftYmd(windowEnd,1);
  }
  return windows;
}
export function resolveQueryRange(env=process.env){
  const end=normalizeDate(env.PPS_QUERY_END_DATE)||ymdKst();
  const days=Math.max(30,Math.min(3650,Number(env.PPS_QUERY_DAYS)||DEFAULT_QUERY_DAYS));
  const start=normalizeDate(env.PPS_QUERY_START_DATE)||shiftYmd(end,-days);
  if(start>end)throw new Error(`PPS query start after end: ${start}>${end}`);
  return {start,end,days};
}
function decodedServiceKey(value){
  const raw=s(value);if(!raw)return '';
  try{return decodeURIComponent(raw)}catch{return raw}
}
function redactSecret(text,secret){
  let out=String(text??'');
  const raw=s(secret),decoded=decodedServiceKey(raw),variants=[raw,decoded];
  try{variants.push(encodeURIComponent(decoded))}catch{}
  for(const value of [...new Set(variants.filter(v=>v&&v.length>=4))])out=out.split(value).join('[REDACTED]');
  return out;
}
function headerValue(res,name){try{return s(res?.headers?.get?.(name))}catch{return ''}}
async function safeErrorSnippet(res,apiKey){
  let body='';try{if(typeof res?.text==='function')body=await res.text()}catch{}
  body=redactSecret(body,apiKey).replace(/\s+/g,' ').trim().slice(0,500);
  const contentType=headerValue(res,'content-type').slice(0,100),server=headerValue(res,'server').slice(0,80),via=headerValue(res,'via').slice(0,80);
  return {body,contentType,server,via};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchPage({fetchImpl,apiKey,pageNo,perPage,start,end,apiBase=API_BASE,retries=DEFAULT_RETRIES,timeoutMs=20000}){
  const u=new URL(apiBase);
  u.searchParams.set('numOfRows',String(perPage));
  u.searchParams.set('pageNo',String(pageNo));
  u.searchParams.set('ServiceKey',decodedServiceKey(apiKey));
  u.searchParams.set('type','json');
  u.searchParams.set('inqryDiv','1');
  u.searchParams.set('inqryBgnDate',start);
  u.searchParams.set('inqryEndDate',end);
  let lastError=null;
  for(let attempt=1;attempt<=Math.max(1,retries);attempt++){
    try{
      const options={headers:{accept:'application/json','user-agent':'interior-cost-data-preflight/6.4'}};
      if(fetchImpl===fetch)options.signal=AbortSignal.timeout(timeoutMs);
      const res=await fetchImpl(u,options);
      if(!res.ok){
        const diag=await safeErrorSnippet(res,apiKey);
        const parts=[`PPS G2B API HTTP ${res.status}`];
        if(diag.contentType)parts.push(`content-type=${diag.contentType}`);
        if(diag.server)parts.push(`server=${diag.server}`);
        if(diag.via)parts.push(`via=${diag.via}`);
        if(diag.body)parts.push(`body=${JSON.stringify(diag.body)}`);
        const error=new Error(parts.join(' '));
        if((res.status>=500||res.status===429)&&attempt<retries){lastError=error;await sleep(400*2**(attempt-1));continue}
        throw error;
      }
      let json;try{json=await res.json()}catch{throw new Error('PPS G2B API returned non-JSON response')}
      return parseLivePayload(json);
    }catch(error){
      lastError=error;
      const msg=String(error?.message||error);
      const nonRetryable=/PPS API result (20|30|31)|SERVICE_KEY|HTTP 4(?!29)/.test(msg);
      if(nonRetryable||attempt>=retries)throw error;
      await sleep(400*2**(attempt-1));
    }
  }
  throw lastError||new Error('PPS G2B fetch failed');
}

async function collectWindow({fetchImpl,apiKey,apiBase,start,end,perPage,maxPages,retries}){
  const raw=[];let totalCount=null,pages=0;
  for(let pageNo=1;pageNo<=maxPages;pageNo++){
    const page=await fetchPage({fetchImpl,apiKey,pageNo,perPage,start,end,apiBase,retries});
    pages=pageNo;
    if(Number.isFinite(page.totalCount))totalCount=page.totalCount;
    raw.push(...page.items);
    if(page.items.length===0)break;
    if(Number.isFinite(totalCount)&&raw.length>=totalCount)break;
    if(!Number.isFinite(totalCount)&&page.items.length<perPage)break;
  }
  if(Number.isFinite(totalCount)&&raw.length<totalCount)throw new Error(`incomplete PPS G2B window ${start}-${end} ${raw.length}/${totalCount}`);
  return {start,end,raw,totalCount:Number.isFinite(totalCount)?totalCount:raw.length,pages};
}

export async function collectLiveRows({fetchImpl=fetch,apiKey=process.env.DATA_GO_KR_SERVICE_KEY,apiBase=API_BASE,start,end,perPage=DEFAULT_PER_PAGE,maxPages=DEFAULT_MAX_PAGES,minPublishedRows=1,windowDays=DEFAULT_WINDOW_DAYS,retries=DEFAULT_RETRIES}={}){
  if(!s(apiKey))throw new Error('DATA_GO_KR_SERVICE_KEY is required');
  if(!normalizeDate(start)||!normalizeDate(end))throw new Error('valid PPS query date range is required');
  const minRows=Math.max(1,Number(minPublishedRows)||1),raw=[],windows=splitQueryRange(start,end,windowDays),windowStats=[];
  let sourceTotalCount=0;
  for(const window of windows){
    const result=await collectWindow({fetchImpl,apiKey,apiBase,start:window.start,end:window.end,perPage,maxPages,retries});
    raw.push(...result.raw);sourceTotalCount+=result.totalCount;
    windowStats.push({start:window.start,end:window.end,totalCount:result.totalCount,rawRows:result.raw.length,pages:result.pages});
  }
  const normalized=raw.map(normalizeLiveRow).filter(validateLiveRow);
  const rows=dedupeLatestRows(normalized);
  if(!rows.length)throw new Error(`no valid PPS G2B unit price rows for ${start}-${end} across ${windows.length} bounded windows`);
  if(rows.length<minRows)throw new Error(`PPS G2B completeness floor not met ${rows.length}/${minRows}; bounded-window collection completed but the publication floor is not met`);
  return {rows,sourceTotalCount,rawRowCount:raw.length,validRowCount:normalized.length,minPublishedRows:minRows,windowDays:Math.max(1,Math.min(31,Number(windowDays)||DEFAULT_WINDOW_DAYS)),windowCount:windows.length,nonemptyWindowCount:windowStats.filter(x=>x.rawRows>0).length,windowStats};
}

export function buildDataset({rows,sourceTotalCount,rawRowCount,validRowCount,minPublishedRows,start,end,windowDays=null,windowCount=null,nonemptyWindowCount=null,generatedAt=new Date().toISOString()}={}){
  if(!Array.isArray(rows)||!rows.length)throw new Error('rows are required');
  const latest=rows.map(r=>r.published_date).filter(Boolean).sort().at(-1)||null;
  return {
    dataset:'공공 공사비 참고단가',
    data_type:'REFERENCE',
    schema_version:'1.2',
    generated_at:generatedAt,
    status:'ready',
    source:{
      provider:'조달청',
      name:'나라장터 가격정보현황서비스 · 표준시장단가및시장시공가격',
      public_data_id:'15129415',
      api_operation:'getStdMarkUprcinfoList',
      query_start_date:isoDate(start),
      query_end_date:isoDate(end),
      query_window_days:Number(windowDays)||null,
      query_window_count:Number(windowCount)||null,
      nonempty_window_count:Number(nonemptyWindowCount)||0,
      source_row_count:sourceTotalCount,
      raw_collected_row_count:rawRowCount,
      valid_row_count:validRowCount,
      collected_row_count:rows.length,
      completeness_floor_rows:Number(minPublishedRows)||null,
      latest_published_date:latest,
      total_cost_method:'재료비단가 + 노무비단가 + 경비단가',
      license:'이용허락범위 제한 없음',
      source_url:'https://www.data.go.kr/data/15129415/openapi.do'
    },
    fields:['published_date','work_code','name','spec','unit','material_cost_won','labor_cost_won','expense_cost_won','total_cost_won','application_condition'],
    rows
  };
}
function semantic(x){
  if(!x||typeof x!=='object')return x;
  const c=structuredClone(x);delete c.generated_at;
  if(c.source){delete c.source.query_start_date;delete c.source.query_end_date;delete c.source.source_row_count;delete c.source.raw_collected_row_count;delete c.source.valid_row_count;delete c.source.query_window_count;delete c.source.nonempty_window_count}
  return c;
}
function readExisting(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}}

export async function main(env=process.env){
  const out=path.resolve(env.OUT_FILE||DEFAULT_OUT);
  const range=resolveQueryRange(env);
  const perPage=Math.max(1,Math.min(999,Number(env.PPS_PER_PAGE)||DEFAULT_PER_PAGE));
  const maxPages=Math.max(1,Math.min(1000,Number(env.PPS_MAX_PAGES)||DEFAULT_MAX_PAGES));
  const minPublishedRows=Math.max(1,Number(env.PPS_MIN_PUBLISHED_ROWS)||1);
  const windowDays=Math.max(1,Math.min(31,Number(env.PPS_WINDOW_DAYS)||DEFAULT_WINDOW_DAYS));
  const retries=Math.max(1,Math.min(5,Number(env.PPS_RETRIES)||DEFAULT_RETRIES));
  const collected=await collectLiveRows({apiKey:env.DATA_GO_KR_SERVICE_KEY,start:range.start,end:range.end,perPage,maxPages,minPublishedRows,windowDays,retries});
  const dataset=buildDataset({...collected,start:range.start,end:range.end});
  const existing=readExisting(out),unchanged=Boolean(existing&&JSON.stringify(semantic(existing))===JSON.stringify(semantic(dataset)));
  if(!unchanged){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(dataset,null,2)+'\n')}
  console.log(JSON.stringify({ok:true,source:'15129415',operation:'getStdMarkUprcinfoList',query_start:range.start,query_end:range.end,query_window_days:windowDays,query_window_count:collected.windowCount,nonempty_window_count:collected.nonemptyWindowCount,min_published_rows:minPublishedRows,source_total:collected.sourceTotalCount,raw_rows:collected.rawRowCount,valid_rows:collected.validRowCount,published_rows:dataset.rows.length,latest_published_date:dataset.source.latest_published_date,output:out,semantic_unchanged:unchanged}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
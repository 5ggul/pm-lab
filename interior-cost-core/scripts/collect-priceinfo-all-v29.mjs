import fs from 'node:fs';
import path from 'node:path';

const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService';
const PAGE_SIZE=999;
const RETRIES=5;
const DELAY_MS=170;
const RAW_DIR=path.resolve(process.env.V29_RAW_DIR||'artifacts/v29-price-raw');
const DATA_DIR=path.resolve('interior-cost-core/data');
const SUMMARY_OUT=path.join(DATA_DIR,'g2b-priceinfo-v29-summary.json');
const INTERIOR_OUT=path.join(DATA_DIR,'g2b-priceinfo-v29-interior.json');
const now=new Date();
const currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric'}).format(now));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).replaceAll('-','');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const DIRECT=[
  {id:'materials_civil',label:'시설공통자재(토목)',operation:'getPriceInfoListFcltyCmmnMtrilEngrk'},
  {id:'materials_building',label:'시설공통자재(건축)',operation:'getPriceInfoListFcltyCmmnMtrilBildng'},
  {id:'materials_mechanical',label:'시설공통자재(기계설비)',operation:'getPriceInfoListFcltyCmmnMtrilMchnEqp'},
  {id:'materials_electrical_it',label:'시설공통자재(전기·정보통신)',operation:'getPriceInfoListFcltyCmmnMtrilElctyIrmc'},
  {id:'market_civil',label:'시장시공가격(토목)',operation:'getPriceInfoListMrktCnstrctPcEngrk'},
  {id:'market_building',label:'시장시공가격(건축)',operation:'getPriceInfoListMrktCnstrctPcBildng'},
  {id:'market_mechanical',label:'시장시공가격(기계설비)',operation:'getPriceInfoListMrktCnstrctPcMchnEqp'},
  {id:'construction_classification',label:'공종분류및세부공종',operation:'getCnsttyClsfcInfoList'},
  {id:'net_resource',label:'자원분류및순수자원',operation:'getNetRsceinfoList'},
];
const DATED=[
  {id:'standard_market_unit',label:'표준시장단가및시장시공가격',operation:'getStdMarkUprcinfoList',startYear:2010},
  {id:'materials_total',label:'시설공통자재(종합)',operation:'getPriceInfoListFcltyCmmnMtrilTotal',startYear:2024},
];
const OPS=[...DIRECT,...DATED];

const CATEGORY_KEYWORDS={
  bathroom:['욕실','타일','방수','도기','수전','변기','세면','샤워','배수'],
  wallpaper:['도배','벽지','합지','실크벽지'],
  floor:['바닥','마루','장판','데코타일','바닥타일'],
  carpentry:['목공','합판','석고보드','각재','몰딩','가벽','천장틀','목재'],
  insulation:['단열','보온','우레탄','글라스울','미네랄울','xps','eps','압출법','비드법'],
  kitchen:['주방','싱크','싱크대','상판','후드','주방가구'],
  window:['창호','샷시','창문','복층유리','유리창'],
  electrical:['전기','조명','콘센트','스위치','전선','분전반','차단기','배선'],
  plumbing:['배관','급수','배수','위생','수도','밸브','관이음'],
  demolition:['철거','해체','폐기물','철거공'],
};
const CATEGORY_LABELS={bathroom:'욕실',wallpaper:'도배',floor:'바닥',carpentry:'목공',insulation:'단열',kitchen:'주방',window:'창호',electrical:'전기·조명',plumbing:'배관·설비',demolition:'철거'};
const DROP_PUBLIC=new Set(['ServiceKey','invstDeptTelNo','invstOfclNm','cntrctCorpTelNo','cntrctCorpNm']);

function serviceKey(){
  const value=String(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
  if(!value)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');
  try{return /%[0-9a-f]{2}/i.test(value)?decodeURIComponent(value):value}catch{return value}
}
function rows(body){
  const items=body?.items;
  if(Array.isArray(items))return items;
  if(Array.isArray(items?.item))return items.item;
  if(items?.item&&typeof items.item==='object')return [items.item];
  return [];
}
function num(v){const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null}
function quantile(values,q){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const pos=(a.length-1)*q;const lo=Math.floor(pos),hi=Math.ceil(pos);return Math.round(a[lo]+(a[hi]-a[lo])*(pos-lo))}
function sanitize(row){const out={};for(const [k,v] of Object.entries(row||{})){if(!DROP_PUBLIC.has(k))out[k]=v}return out}
function sourceText(row){return [row.prdctClsfcNoNm,row.krnPrdctNm,row.prdnm,row.spec,row.qtyCalcCtyclNm,row.dscrpt,row.rsceNm,row.rsceSpecNm,row.rsceDscrpt,row.lvlRsceClsfcNm1,row.lvlRsceClsfcNm2,row.lvlRsceClsfcNm3,row.lvlRsceClsfcNm4,row.LvlqtyCalcCtyclNm1,row.LvlqtyCalcCtyclNm2,row.LvlqtyCalcCtyclNm3,row.LvlqtyCalcCtyclNm4,row.LvlqtyCalcCtyclNm5].filter(Boolean).join(' ').toLowerCase()}
function categories(row){const text=sourceText(row);return Object.entries(CATEGORY_KEYWORDS).filter(([,ks])=>ks.some(k=>text.includes(k.toLowerCase()))).map(([id])=>id)}
function priceValue(row){
  const direct=num(row.prce);
  if(Number.isFinite(direct)&&direct>0)return direct;
  const standardParts=[num(row.mtrlcstUprc),num(row.lbrcstUprc),num(row.gnrexpnsUprc)].filter(Number.isFinite);
  if(standardParts.length){const sum=standardParts.reduce((a,b)=>a+b,0);if(sum>0)return sum}
  const parts=[num(row.mtrlcst),num(row.lbrcst),num(row.gnrlexpns)].filter(Number.isFinite);
  if(parts.length){const sum=parts.reduce((a,b)=>a+b,0);if(sum>0)return sum}
  return null;
}
function unitValue(row){return String(row.unit??'').trim()||'단위 미기재'}
function nameValue(row){return String(row.krnPrdctNm??row.prdnm??row.qtyCalcCtyclNm??row.rsceNm??row.prdctClsfcNoNm??'').trim()||'미분류'}
function safeFile(id){return id.replace(/[^a-z0-9_-]/gi,'_')}

async function request(operation,pageNo,params={}){
  const u=new URL(`${BASE}/${operation}`);
  for(const [k,v] of Object.entries({ServiceKey:serviceKey(),pageNo:String(pageNo),numOfRows:String(PAGE_SIZE),type:'json',...params}))u.searchParams.set(k,String(v));
  let last;
  for(let attempt=1;attempt<=RETRIES;attempt++){
    try{
      const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(45000)});
      const text=await r.text();
      if((r.status===429||r.status>=500)&&attempt<RETRIES){await sleep(Math.min(8000,900*(2**(attempt-1))));continue}
      let payload;try{payload=JSON.parse(text)}catch{throw new Error(`NON_JSON:${r.status}`)}
      const root=payload?.response||payload;const code=String(root?.header?.resultCode??'');const msg=String(root?.header?.resultMsg??'');
      if(!r.ok||!['00','0'].includes(code))throw new Error(`PROVIDER:${r.status}:${code}:${msg}`);
      const body=root?.body||{};return {total:Number(body.totalCount||0),pageSize:Math.max(1,Number(body.numOfRows||PAGE_SIZE)),rows:rows(body)};
    }catch(error){last=error;if(attempt<RETRIES){await sleep(Math.min(8000,900*(2**(attempt-1))));continue}}
  }
  throw new Error(`${operation}:page=${pageNo}:${last?.message||last}`);
}

async function collectWindow(spec,params,rawPath){
  const first=await request(spec.operation,1,params);
  const pageSize=Math.max(1,first.pageSize||PAGE_SIZE);
  const pages=Math.max(1,Math.ceil(first.total/pageSize));
  const fh=fs.openSync(rawPath,'w');
  let count=0;
  try{
    const emit=batch=>{for(const row of batch){fs.writeSync(fh,JSON.stringify(row)+'\n');count++}};
    emit(first.rows);
    for(let page=2;page<=pages;page++){
      await sleep(DELAY_MS);
      const next=await request(spec.operation,page,params);
      if(next.total!==first.total)throw new Error(`${spec.id}:TOTAL_CHANGED:${first.total}:${next.total}`);
      emit(next.rows);
      if(page%25===0)console.error(`progress ${spec.id} ${page}/${pages} rows=${count}`);
    }
  }finally{fs.closeSync(fh)}
  if(count!==first.total)throw new Error(`${spec.id}:COUNT_MISMATCH expected=${first.total} got=${count}`);
  return {total:first.total,page_size:pageSize,page_count:pages,raw_path:rawPath};
}

function aggregateRelevant(agg,sourceId,row){
  const cats=categories(row);if(!cats.length)return;
  const clean=sanitize(row);const unit=unitValue(clean);const price=priceValue(clean);const name=nameValue(clean);
  for(const category of cats){
    const key=`${category}\u0000${sourceId}\u0000${unit}`;
    if(!agg.has(key))agg.set(key,{category,source_id:sourceId,unit,record_count:0,priced_count:0,prices:[],examples:new Map()});
    const g=agg.get(key);g.record_count++;
    if(Number.isFinite(price)&&price>0){g.priced_count++;g.prices.push(price)}
    if(g.examples.size<12){const ek=`${name}\u0000${unit}\u0000${price??''}`;if(!g.examples.has(ek))g.examples.set(ek,{name,unit,reference_price_krw:price})}
  }
}

fs.mkdirSync(RAW_DIR,{recursive:true});fs.mkdirSync(DATA_DIR,{recursive:true});
const collectedAt=new Date().toISOString();
const operationReports=[];const agg=new Map();
let totalRows=0;let totalCalls=0;

async function replayRaw(sourceId,rawPath){
  const content=fs.readFileSync(rawPath,'utf8');
  for(const line of content.split('\n')){if(!line)continue;aggregateRelevant(agg,sourceId,JSON.parse(line))}
}

for(const spec of DIRECT){
  const rawPath=path.join(RAW_DIR,`${safeFile(spec.id)}.ndjson`);
  const r=await collectWindow(spec,{},rawPath);totalRows+=r.total;totalCalls+=r.page_count;
  await replayRaw(spec.id,rawPath);
  operationReports.push({...spec,mode:'current_snapshot',record_count:r.total,page_count:r.page_count,page_size:r.page_size});
}
for(const spec of DATED){
  const years=[];let opRows=0;let opPages=0;
  for(let year=spec.startYear;year<=currentYear;year++){
    const end=year===currentYear?today:`${year}1231`;const params={inqryDiv:'1',inqryBgnDate:`${year}0101`,inqryEndDate:end};
    const rawPath=path.join(RAW_DIR,`${safeFile(spec.id)}-${year}.ndjson`);
    const r=await collectWindow(spec,params,rawPath);opRows+=r.total;opPages+=r.page_count;totalRows+=r.total;totalCalls+=r.page_count;
    await replayRaw(spec.id,rawPath);
    years.push({year,record_count:r.total,page_count:r.page_count,page_size:r.page_size});
  }
  operationReports.push({...spec,mode:'historical_by_year',record_count:opRows,page_count:opPages,years});
}

const categoryStats=[...agg.values()].map(g=>({
  category:g.category,category_label:CATEGORY_LABELS[g.category],source_id:g.source_id,unit:g.unit,
  record_count:g.record_count,priced_count:g.priced_count,
  min_price_krw:g.prices.length?Math.min(...g.prices):null,
  p25_price_krw:quantile(g.prices,.25),median_price_krw:quantile(g.prices,.5),p75_price_krw:quantile(g.prices,.75),
  max_price_krw:g.prices.length?Math.max(...g.prices):null,
  examples:[...g.examples.values()]
})).sort((a,b)=>a.category.localeCompare(b.category)||b.record_count-a.record_count||a.source_id.localeCompare(b.source_id));
const categoryOverview=Object.entries(CATEGORY_LABELS).map(([category,label])=>{
  const rows=categoryStats.filter(x=>x.category===category);return {category,label,record_count:rows.reduce((s,x)=>s+x.record_count,0),priced_count:rows.reduce((s,x)=>s+x.priced_count,0),sources:[...new Set(rows.map(x=>x.source_id))],units:[...new Set(rows.map(x=>x.unit))]};
});
const summary={schema_version:'29.0.0',agency:'조달청',service:'나라장터 가격정보현황서비스',endpoint_base:BASE,collected_at:collectedAt,operation_count:OPS.length,total_raw_rows:totalRows,total_api_pages:totalCalls,page_size_requested:PAGE_SIZE,operations:operationReports,public_note:'원본 API 전량 수집 결과. 공개 사이트에는 개인정보성 연락처·담당자·업체 전화 필드를 제외한 집계만 사용합니다.',interpretation:{valid_for:'조달청 가격정보·공종분류·순수자원·표준시장단가의 공개 참고 데이터 탐색',not_valid_for:'민간 아파트 인테리어 계약금액 평균 또는 적정견적의 직접 대체'}};
const interior={schema_version:'29.0.0',collected_at:collectedAt,source:'나라장터 가격정보현황서비스 전체 수집본에서 인테리어 관련 키워드를 후처리한 공개용 집계',category_overview:categoryOverview,category_stats:categoryStats,warning:'이 통계는 공공 가격정보의 항목·단위별 분포입니다. 일반 소비자 인테리어 평균 공사비가 아닙니다.'};
fs.writeFileSync(SUMMARY_OUT,JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync(INTERIOR_OUT,JSON.stringify(interior,null,2)+'\n');
console.log(JSON.stringify({ok:true,collected_at:collectedAt,operation_count:OPS.length,total_raw_rows:totalRows,total_api_pages:totalCalls,summary:SUMMARY_OUT,interior:INTERIOR_OUT,raw_dir:RAW_DIR,operations:operationReports.map(x=>({id:x.id,records:x.record_count,pages:x.page_count}))},null,2));

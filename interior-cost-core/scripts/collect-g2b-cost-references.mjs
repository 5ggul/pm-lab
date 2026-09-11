import fs from 'node:fs';
import path from 'node:path';

const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService';
const MARKET_ENDPOINT=`${BASE}/getPriceInfoListMrktCnstrctPcBildng`;
const STANDARD_ENDPOINT=`${BASE}/getStdMarkUprcinfoList`;
const MARKET_OUT=path.resolve('interior-cost-core/data/g2b-building-market-construction.json');
const STANDARD_OUT=path.resolve('interior-cost-core/data/g2b-standard-market-unit-building.json');
const PAGE_SIZE=500;
const MAX_PAGES=200;
const RETRIES=3;
const DELAY_MS=150;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function serviceKey(){
  const value=String(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
  if(!value)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');
  return /%[0-9a-f]{2}/i.test(value)?decodeURIComponent(value):value;
}
function num(v){const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null}
function rows(body){
  const items=body?.items;
  if(Array.isArray(items))return items;
  if(Array.isArray(items?.item))return items.item;
  if(items?.item&&typeof items.item==='object')return [items.item];
  return [];
}
function median(values){
  const a=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2);
}
async function fetchJson(url,label){
  let last;
  for(let attempt=1;attempt<=RETRIES;attempt++){
    try{
      const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
      const text=await response.text();
      if((response.status===429||response.status>=500)&&attempt<RETRIES){await sleep(700*attempt);continue;}
      let payload;try{payload=JSON.parse(text)}catch{throw new Error(`${label}:NON_JSON:${response.status}`)}
      return {response,payload};
    }catch(error){
      last=error;
      if(attempt<RETRIES){await sleep(700*attempt);continue;}
    }
  }
  throw new Error(`${label}:TRANSPORT:${last?.cause?.code||last?.name||last?.message||'FETCH_ERROR'}`);
}
async function fetchAll({endpoint,label,params={}}){
  const key=serviceKey();
  let total=null;let providerPageSize=PAGE_SIZE;const out=[];
  for(let pageNo=1;pageNo<=MAX_PAGES;pageNo++){
    const u=new URL(endpoint);
    for(const [k,v] of Object.entries({ServiceKey:key,pageNo:String(pageNo),numOfRows:String(PAGE_SIZE),type:'json',...params}))u.searchParams.set(k,v);
    const {response,payload}=await fetchJson(u,label);
    const root=payload?.response||payload;
    const code=String(root?.header?.resultCode??'');
    const message=String(root?.header?.resultMsg??'');
    if(!response.ok||!['00','0'].includes(code))throw new Error(`${label}:PROVIDER:${response.status}:${code}:${message}`);
    const body=root?.body||{};const batch=rows(body);
    const thisTotal=Number(body.totalCount||0);
    const thisSize=Math.max(1,Number(body.numOfRows||PAGE_SIZE));
    if(total===null){total=thisTotal;providerPageSize=thisSize}else if(total!==thisTotal)throw new Error(`${label}:TOTAL_CHANGED:${total}:${thisTotal}`);
    out.push(...batch);
    if(out.length>=total||batch.length===0)return {rows:out.slice(0,total),total,pages:pageNo,pageSize:providerPageSize};
    await sleep(DELAY_MS);
  }
  throw new Error(`${label}:PAGE_LIMIT:${total}:${out.length}`);
}
function existing(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')}
function safeFailure(error){return String(error?.message||error).replace(/ServiceKey=[^&\s]+/gi,'ServiceKey=REDACTED').slice(0,220)}

function marketRow(r){
  return {
    price_notice_no:String(r.prceNticeNo??''),notice_at:String(r.nticeDt??''),business_division:String(r.bsnsDivNm??''),
    product_class_no:String(r.prdctClsfcNo??''),product_id:String(r.prdctIdntNo??''),product_name:String(r.prdctClsfcNoNm??''),item_name:String(r.krnPrdctNm??''),
    unit:String(r.unit??'').trim(),price_krw:num(r.prce),material_cost_krw:num(r.mtrlcst),labor_cost_krw:num(r.lbrcst),expense_krw:num(r.gnrlexpns),
    supply_region:String(r.splyJrsdctRgnNm??''),vat:String(r.vatYnNm??''),price_type:String(r.prceDiv??''),delivery_condition:String(r.dlvryCndtnNm??''),distribution_stage:String(r.distbStep??'')
  };
}
function standardRow(r){
  const material=num(r.mtrlcstUprc),labor=num(r.lbrcstUprc),expense=num(r.gnrexpnsUprc);
  const parts=[material,labor,expense].filter(Number.isFinite);
  return {
    publication_date:String(r.pblctDate??''),construction_division_code:String(r.cnstwkDivCd??''),construction_division:String(r.cnstwkDivCdNm??''),
    item_name:String(r.prdnm??''),specification:String(r.spec??''),unit:String(r.unit??'').trim(),unit_price_type:String(r.uprcDivNm??''),
    material_cost_krw:material,labor_cost_krw:labor,expense_krw:expense,component_sum_krw:parts.length?parts.reduce((a,b)=>a+b,0):null,
    quantity_calc_cycle_code:String(r.qtyCalcCtyclcd??''),application_condition:String(r.uprcAplCndtnCntnts??'')
  };
}
function marketGroups(records){
  const map=new Map();
  for(const r of records){
    if(!Number.isFinite(r.price_krw)||r.price_krw<=0)continue;
    const key=`${r.product_name||'미분류'}\u0000${r.unit||'단위 미기재'}`;
    if(!map.has(key))map.set(key,[]);map.get(key).push(r);
  }
  return [...map.entries()].map(([key,list])=>{
    const [product_name,unit]=key.split('\u0000');const prices=list.map(x=>x.price_krw);const dates=list.map(x=>x.notice_at).filter(Boolean).sort();
    return {product_name,unit,record_count:list.length,min_price_krw:Math.min(...prices),median_price_krw:median(prices),max_price_krw:Math.max(...prices),latest_notice_at:dates.at(-1)||''};
  }).sort((a,b)=>b.record_count-a.record_count||a.product_name.localeCompare(b.product_name,'ko'));
}
function standardGroups(records){
  const map=new Map();
  for(const r of records){
    const key=`${r.item_name||'미분류'}\u0000${r.unit||'단위 미기재'}\u0000${r.unit_price_type||'구분 미기재'}`;
    if(!map.has(key))map.set(key,[]);map.get(key).push(r);
  }
  return [...map.entries()].map(([key,list])=>{
    const [item_name,unit,unit_price_type]=key.split('\u0000');const values=list.map(x=>x.component_sum_krw).filter(Number.isFinite);const dates=list.map(x=>x.publication_date).filter(Boolean).sort();
    return {item_name,unit,unit_price_type,record_count:list.length,min_component_sum_krw:values.length?Math.min(...values):null,median_component_sum_krw:median(values),max_component_sum_krw:values.length?Math.max(...values):null,latest_publication_date:dates.at(-1)||''};
  }).sort((a,b)=>b.record_count-a.record_count||a.item_name.localeCompare(b.item_name,'ko'));
}

const attemptedAt=new Date().toISOString();
const now=new Date();const y=new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric'}).format(now);
const md=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit'}).formatToParts(now);
const pick=t=>md.find(x=>x.type===t)?.value||'';const endDate=`${y}${pick('month')}${pick('day')}`;const beginDate=`${y}0101`;

let marketSnapshot;
try{
  const raw=await fetchAll({endpoint:MARKET_ENDPOINT,label:'G2B_MARKET'});
  const records=raw.rows.map(marketRow);
  marketSnapshot={schema_version:'1.0.0',source_id:'PPS-G2B-MARKET-CONSTRUCTION-BUILDING',agency:'조달청',service:'나라장터 가격정보현황서비스',operation:'시장시공가격(건축) 가격정보',endpoint:MARKET_ENDPOINT,source_collected_at:attemptedAt,refresh_attempted_at:attemptedAt,refresh_status:'live',total_count:raw.total,record_count:records.length,page_count:raw.pages,records,groups:marketGroups(records),interpretation:{valid_for:'조달청 공개 건축 시장시공가격 레코드의 품명·규격명·단위·가격 구성 확인',not_valid_for:'일반 아파트 인테리어 소비자가·민간 평균 견적·적정 견적의 직접 대체',aggregation:'품명과 단위가 같은 공개 레코드의 분포이며 규격·지역·계약조건 차이를 별도로 확인해야 함.'}};
}catch(error){
  const prev=existing(MARKET_OUT);if(!prev)throw error;
  marketSnapshot={...prev,refresh_attempted_at:attemptedAt,refresh_status:'stale_fallback',refresh_error:safeFailure(error)};
}
write(MARKET_OUT,marketSnapshot);

let standardSnapshot;
try{
  const raw=await fetchAll({endpoint:STANDARD_ENDPOINT,label:'G2B_STANDARD',params:{inqryDiv:'1',inqryBgnDate:beginDate,inqryEndDate:endDate}});
  const all=raw.rows.map(standardRow);
  const categoryCounts=Object.entries(all.reduce((acc,r)=>(acc[r.construction_division||'미분류']=(acc[r.construction_division||'미분류']||0)+1,acc),{})).map(([construction_division,count])=>({construction_division,count})).sort((a,b)=>b.count-a.count);
  const records=all.filter(r=>r.construction_division.includes('건축'));
  standardSnapshot={schema_version:'1.0.0',source_id:'PPS-G2B-STANDARD-MARKET-UNIT-BUILDING',agency:'조달청',service:'나라장터 가격정보현황서비스',operation:'표준시장단가및시장시공가격 정보',endpoint:STANDARD_ENDPOINT,query:{inqryDiv:'1',inqryBgnDate:beginDate,inqryEndDate:endDate,filter:'construction_division contains 건축'},source_collected_at:attemptedAt,refresh_attempted_at:attemptedAt,refresh_status:'live',provider_total_count:raw.total,record_count:records.length,page_count:raw.pages,category_counts:categoryCounts,records,groups:standardGroups(records),interpretation:{valid_for:'공공 시설공사 건축 분야 표준시장단가·시장시공가격의 공표 단가 구성과 적용조건 확인',not_valid_for:'민간 아파트 리모델링 시장가격·소비자가·적정 견적의 직접 대체',calculation:'component_sum_krw는 API 재료비+노무비+경비의 단순 합이며 별도 가산·현장조건을 추정하지 않음.'}};
}catch(error){
  const prev=existing(STANDARD_OUT);if(!prev)throw error;
  standardSnapshot={...prev,refresh_attempted_at:attemptedAt,refresh_status:'stale_fallback',refresh_error:safeFailure(error)};
}
write(STANDARD_OUT,standardSnapshot);

console.log(JSON.stringify({ok:true,market:{status:marketSnapshot.refresh_status,total:marketSnapshot.total_count,records:marketSnapshot.record_count,groups:marketSnapshot.groups?.length||0},standard:{status:standardSnapshot.refresh_status,provider_total:standardSnapshot.provider_total_count,building_records:standardSnapshot.record_count,categories:standardSnapshot.category_counts,groups:standardSnapshot.groups?.length||0,query:standardSnapshot.query}},null,2));

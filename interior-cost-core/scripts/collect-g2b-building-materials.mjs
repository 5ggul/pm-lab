import fs from 'node:fs';
import path from 'node:path';

const ENDPOINT='https://apis.data.go.kr/1230000/ao/PriceInfoService/getPriceInfoListFcltyCmmnMtrilBildng';
const OUT=path.resolve('interior-cost-core/data/g2b-building-materials.json');
const TERMS=['타일','벽지','장판','마루','합판','석고보드','시멘트','각재','전선','조명','창호','단열재'];

function decodedServiceKey(input){
  const value=String(input||'').trim();
  if(!value)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');
  if(!/%[0-9a-f]{2}/i.test(value))return value;
  try{return decodeURIComponent(value)}catch{throw new Error('DATA_GO_KR_SERVICE_KEY_INVALID_ENCODING')}
}
function rowsFromBody(body){
  const items=body?.items;
  if(Array.isArray(items))return items;
  if(Array.isArray(items?.item))return items.item;
  if(items?.item&&typeof items.item==='object')return [items.item];
  return [];
}
function number(v){
  const n=Number(String(v??'').replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:null;
}
function median(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2);
}
function sanitize(row,term){
  return {
    query_term:term,
    price_notice_no:String(row.prceNticeNo??''),
    notice_at:String(row.nticeDt??''),
    product_class_no:String(row.prdctClsfcNo??''),
    product_id:String(row.prdctIdntNo??''),
    product_name:String(row.prdctClsfcNoNm??''),
    item_name:String(row.krnPrdctNm??''),
    unit:String(row.unit??''),
    price_krw:number(row.prce),
    supply_region:String(row.splyJrsdctRgnNm??''),
    vat:String(row.vatYnNm??''),
    price_type:String(row.prceDiv??''),
    delivery_condition:String(row.dlvryCndtnNm??''),
    distribution_stage:String(row.distbStep??'')
  };
}
async function fetchTerm(term,key){
  const u=new URL(ENDPOINT);
  for(const [k,v] of Object.entries({ServiceKey:key,pageNo:'1',numOfRows:'100',type:'json',prdctClsfcNoNm:term}))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
  const text=await r.text();
  let payload;
  try{payload=JSON.parse(text)}catch{throw new Error(`G2B_NON_JSON:${term}:${r.status}`)}
  const root=payload?.response||payload;
  const code=String(root?.header?.resultCode??'');
  const msg=String(root?.header?.resultMsg??'');
  if(!r.ok||!['00','0'].includes(code))throw new Error(`G2B_ERROR:${term}:${r.status}:${code}:${msg}`);
  const body=root?.body||{};
  return {total:Number(body.totalCount||0),rows:rowsFromBody(body).map(x=>sanitize(x,term))};
}

const key=decodedServiceKey(process.env.DATA_GO_KR_SERVICE_KEY);
const groups=[];const all=[];
for(const term of TERMS){
  const result=await fetchTerm(term,key);
  const prices=result.rows.map(x=>x.price_krw).filter(x=>Number.isFinite(x)&&x>0);
  groups.push({
    term,
    total_count:result.total,
    captured_count:result.rows.length,
    priced_count:prices.length,
    min_price_krw:prices.length?Math.min(...prices):null,
    median_price_krw:median(prices),
    max_price_krw:prices.length?Math.max(...prices):null
  });
  all.push(...result.rows);
}
const dedup=new Map();
for(const row of all){
  const key=[row.price_notice_no,row.product_id,row.item_name,row.price_krw].join('|');
  if(!dedup.has(key))dedup.set(key,row);
}
const records=[...dedup.values()].sort((a,b)=>String(b.notice_at).localeCompare(String(a.notice_at))||String(a.product_name).localeCompare(String(b.product_name),'ko'));
const snapshot={
  schema_version:'1.0.0',
  source_id:'PPS-G2B-PRICE-BUILDING-MATERIALS',
  agency:'조달청',
  service:'나라장터 가격정보현황서비스',
  operation:'시설공통자재(건축) 가격정보',
  endpoint:ENDPOINT,
  collected_at:new Date().toISOString(),
  query_terms:TERMS,
  groups,
  record_count:records.length,
  records,
  interpretation:{
    valid_for:'조달청 공개 시설공통자재(건축) 가격 레코드의 단가·단위·게시시점 확인',
    not_valid_for:'일반 아파트 민간 인테리어 시공비·소비자가·적정견적·시장평균의 직접 대체',
    aggregation:'검색어별 수집 레코드의 단순 최소·중앙값·최대. 규격·지역·조건이 다른 품목을 동일 상품 가격으로 해석하지 않음.'
  }
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({ok:true,out:OUT,record_count:records.length,groups:groups.map(x=>({term:x.term,total:x.total_count,captured:x.captured_count,priced:x.priced_count}))},null,2));

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SOURCE_KEY='kca-price-csv';
export const DATASET_PAGE='https://www.data.go.kr/data/15083256/fileData.do';
export const LICENSE='이용허락범위 제한 없음';
export const MAX_DATASET_AGE_DAYS=45;
export const MAX_CANDIDATES=12;

function unescapeJsonString(s){
  try{return JSON.parse('"'+s.replaceAll('"','\\"').replaceAll('\\"','"')+'"')}catch{return s.replaceAll('\\/','/')}
}

export function extractContentUrl(html){
  const m=String(html).match(/"contentUrl"\s*:\s*"([^"]+)"/);
  if(!m)throw new Error('공공데이터포털 CSV 다운로드 주소를 찾지 못했습니다.');
  const value=m[1].replaceAll('\\/','/').replaceAll('&amp;','&');
  const u=new URL(value,DATASET_PAGE);
  if(u.protocol!=='https:'||u.hostname!=='www.data.go.kr'||u.pathname!=='/cmm/cmm/fileDownload.do')throw new Error('예상하지 못한 공공데이터 다운로드 주소입니다.');
  return u.href;
}

export function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else if(ch==='"')quoted=true;
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=ch;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(!rows.length)return [];
  const header=rows.shift();
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}

const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null};
const median=xs=>{const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const observedAt=date=>Date.parse(date+'T12:00:00+09:00');
const variantOf=product=>product.match(/\(([^()]*)\)\s*$/)?.[1]?.trim()||'조사 규격';
const productOf=product=>product.replace(/\s*\([^()]*\)\s*$/,'').trim()||product;
const cleanSeller=s=>String(s||'').trim();
const cleanProduct=s=>String(s||'').trim();
const daysOld=(date,now)=>Math.floor((now-observedAt(date))/86400000);
const idFor=x=>'kca-'+createHash('sha256').update([x.date,x.product,x.seller,x.price,x.sale,x.onePlusOne].join('|')).digest('hex').slice(0,24);

export function selectCandidates(rows,{now=Date.now(),limit=MAX_CANDIDATES}={}){
  if(!Array.isArray(rows)||!rows.length)throw new Error('참가격 CSV가 비어 있습니다.');
  const required=['상품명','조사일','판매가격','판매업소','제조사','세일여부','원플러스원'];
  for(const h of required)if(!(h in rows[0]))throw new Error('참가격 CSV 열 구성이 변경됐습니다: '+h);
  const latest=[...new Set(rows.map(x=>x['조사일']).filter(Boolean))].sort().at(-1);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(latest||''))throw new Error('최신 조사일을 확인하지 못했습니다.');
  const age=daysOld(latest,now);if(age<0||age>MAX_DATASET_AGE_DAYS)throw new Error(`참가격 최신 조사일이 ${age}일 전입니다. ${MAX_DATASET_AGE_DAYS}일을 넘긴 자료는 자동 원고로 만들지 않습니다.`);
  const latestRows=rows.map(x=>({
    product:cleanProduct(x['상품명']),date:x['조사일'],price:num(x['판매가격']),seller:cleanSeller(x['판매업소']),maker:String(x['제조사']||'').trim(),sale:String(x['세일여부']||'').trim().toUpperCase(),onePlusOne:String(x['원플러스원']||'').trim().toUpperCase()
  })).filter(x=>x.date===latest&&x.product&&x.seller&&Number.isSafeInteger(x.price)&&x.price>=0);
  const byProduct=new Map();
  for(const x of latestRows){if(!byProduct.has(x.product))byProduct.set(x.product,[]);byProduct.get(x.product).push(x.price);}
  const flagged=latestRows.filter(x=>x.sale==='Y'||x.onePlusOne==='Y');
  const scored=flagged.map(x=>{
    const med=median(byProduct.get(x.product)||[]);const pct=med&&med>x.price?Math.round((med-x.price)/med*100):0;
    let score=(x.onePlusOne==='Y'?100:0)+(x.sale==='Y'?40:0)+Math.min(40,Math.max(0,pct));
    if(/\(본사\)/.test(x.seller))score+=12;
    return {...x,median:med,percentBelowMedian:pct,score,id:idFor(x)};
  }).sort((a,b)=>b.score-a.score||a.price-b.price||a.product.localeCompare(b.product,'ko'));
  // One product per run keeps the queue varied; the official source can contain dozens of stores at the same price.
  const seen=new Set(),picked=[];
  for(const x of scored){if(seen.has(x.product))continue;seen.add(x.product);picked.push(x);if(picked.length>=limit)break;}
  return {latest,totalRows:rows.length,latestRows:latestRows.length,flagged:flagged.length,candidates:picked};
}

export function toPayload(selection,{downloadUrl=DATASET_PAGE,generatedAt=Date.now()}={}){
  const sourceUrl=DATASET_PAGE;
  const offers=selection.candidates.map(x=>{
    const flags=[];
    if(x.sale==='Y')flags.push('공식 데이터의 세일여부가 Y로 표시됐습니다.');
    if(x.onePlusOne==='Y')flags.push('공식 데이터의 원플러스원 여부가 Y로 표시됐습니다.');
    const conditions=[`한국소비자원 참가격 ${x.date} 조사 가격입니다.`,`판매점: ${x.seller}.`,...flags,'조사 시점 기준 자료라 현재 판매가격·재고·행사 적용 여부와 다를 수 있습니다.'].join(' ');
    const detail=`참가격 공식 데이터에서 ${x.date} ${x.seller} 판매가격이 ${x.price.toLocaleString('ko-KR')}원으로 기록됐습니다.`;
    return {
      id:x.id,product:productOf(x.product),seller:x.seller,variant:variantOf(x.product),type:'price',category:'이 가격 어때요?',price:x.price,shipping:0,requiredFee:0,points:0,quantity:1,unit:'상품',unitBase:1,coupons:[],conditions,region:'판매점 조사',eventKey:`참가격 ${x.date}`,endsAt:null,sourceId:'source-kca-price-csv',url:sourceUrl,volatile:false,affiliate:false,disclosure:'',reviewId:null,
      copyContext:{angle:'conditions',showUnitPrice:false,notes:[{kind:'detail',text:detail,sourceUrl,confirmed:true,originalSummary:true}],comparison:null,local:null},
      collector:{observedDate:x.date,sale:x.sale==='Y',onePlusOne:x.onePlusOne==='Y',manufacturer:x.maker,percentBelowMedian:x.percentBelowMedian}
    };
  });
  return {sourceKey:SOURCE_KEY,source:{id:'source-kca-price-csv',name:'한국소비자원 참가격 생필품 가격 정보',url:sourceUrl,domain:'www.data.go.kr',scope:`공공데이터포털 파일데이터 · ${LICENSE} · 월간 갱신 · 조사 시점 가격`,mode:'permission',reviewed:true,freshMinutes:MAX_DATASET_AGE_DAYS*24*60},datasetDate:selection.latest,generatedAt,totalRows:selection.totalRows,downloadUrl,offers};
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function fetchWithRetry(fetchImpl,url,options={}, {attempts=3,delayMs=1000,sleepImpl=sleep}={}){
  let lastError=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetchImpl(url,options);
      if(response.ok||(![408,425,429].includes(response.status)&&response.status<500))return response;
      lastError=new Error(`HTTP ${response.status}`);
      if(attempt===attempts)return response;
    }catch(error){lastError=error;if(attempt===attempts)throw error;}
    await sleepImpl(delayMs*attempt);
  }
  throw lastError||new Error('fetch retry failed');
}

export async function collect({fetchImpl=fetch,now=Date.now(),sleepImpl=sleep}={}){
  const page=await fetchWithRetry(fetchImpl,DATASET_PAGE,{headers:{'user-agent':'DealOps-KCA-Collector/0.7 (+manual-publish-only)','accept':'text/html'}},{sleepImpl});
  if(!page.ok)throw new Error('공공데이터포털 페이지 HTTP '+page.status);
  const html=await page.text();const downloadUrl=extractContentUrl(html);
  const file=await fetchWithRetry(fetchImpl,downloadUrl,{headers:{'user-agent':'DealOps-KCA-Collector/0.7 (+manual-publish-only)','accept':'text/csv,*/*'}},{sleepImpl});
  if(!file.ok)throw new Error('참가격 CSV HTTP '+file.status);
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength<1000||bytes.byteLength>40*1024*1024)throw new Error('참가격 CSV 크기가 예상 범위를 벗어났습니다.');
  const text=new TextDecoder('euc-kr').decode(bytes);const rows=parseCsv(text);const selection=selectCandidates(rows,{now});
  return toPayload(selection,{downloadUrl,generatedAt:now});
}

export async function postPayload(payload,{endpoint=process.env.DEALOPS_COLLECTOR_ENDPOINT||'https://dealops-preview.obvious-chive.workers.dev/api/collector/kca',token=process.env.DEALOPS_COLLECTOR_TOKEN,fetchImpl=fetch}={}){
  if(!token||token.length<32)throw new Error('DEALOPS_COLLECTOR_TOKEN이 설정되지 않았습니다.');
  const r=await fetchWithRetry(fetchImpl,endpoint,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-dealops-source':SOURCE_KEY},body:JSON.stringify(payload)});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={text:text.slice(0,500)}}
  if(!r.ok||data.ok!==true)throw new Error(`DealOps collector HTTP ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const payload=await collect();
  const result=await postPayload(payload);
  console.log(JSON.stringify({datasetDate:payload.datasetDate,totalRows:payload.totalRows,candidates:payload.offers.length,result},null,2));
}

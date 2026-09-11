const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService';
const OPERATIONS=[
  {id:'building_material',operation:'getPriceInfoListFcltyCmmnMtrilBildng',params:{}},
  {id:'building_market_construction',operation:'getPriceInfoListMrktCnstrctPcBildng',params:{}},
  {id:'standard_market_unit',operation:'getStdMarkUprcinfoList',params:{inqryDiv:'1',inqryBgnDate:'20260101',inqryEndDate:'20260912'}}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function decodedServiceKey(input){
  const value=String(input||'').trim();
  if(!value)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');
  if(!/%[0-9a-f]{2}/i.test(value))return value;
  return decodeURIComponent(value);
}
function rows(body){
  const items=body?.items;
  if(Array.isArray(items))return items;
  if(Array.isArray(items?.item))return items.item;
  if(items?.item&&typeof items.item==='object')return [items.item];
  return [];
}
async function request(url,label){
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
      const text=await r.text();
      if((r.status===429||r.status>=500)&&attempt<3){await sleep(700*attempt);continue;}
      return {r,text};
    }catch(error){
      last=error;
      if(attempt<3){await sleep(700*attempt);continue;}
    }
  }
  throw new Error(`${label}:TRANSPORT:${last?.cause?.code||last?.name||'FETCH_ERROR'}`);
}
const serviceKey=decodedServiceKey(process.env.DATA_GO_KR_SERVICE_KEY);
const output=[];
for(const spec of OPERATIONS){
  const {id,operation,params}=spec;
  const u=new URL(`${BASE}/${operation}`);
  for(const [k,v] of Object.entries({ServiceKey:serviceKey,pageNo:'1',numOfRows:'1',type:'json',...params}))u.searchParams.set(k,v);
  try{
    const {r,text}=await request(u,id);
    let payload;
    try{payload=JSON.parse(text)}catch{throw new Error(`${id}:NON_JSON:${r.status}`)}
    const root=payload?.response||payload;
    const code=String(root?.header?.resultCode??payload?.header?.resultCode??'');
    const message=String(root?.header?.resultMsg??payload?.header?.resultMsg??'');
    const body=root?.body||payload?.body||{};
    const sample=rows(body)[0]||{};
    output.push({
      id,operation,request_params:Object.keys(params),http_status:r.status,result_code:code,result_message:message,
      total_count:Number(body.totalCount||0),sample_fields:Object.keys(sample).sort(),root_fields:Object.keys(payload||{}).sort()
    });
  }catch(error){
    output.push({id,operation,error:String(error?.message||error).slice(0,180)});
  }
  await sleep(250);
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),operations:output},null,2));
if(output.some(x=>x.result_code&&!['00','0'].includes(x.result_code)))process.exitCode=1;
if(output.every(x=>x.error))process.exitCode=2;

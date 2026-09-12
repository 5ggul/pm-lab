const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService';
const now=new Date();
const currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric'}).format(now));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).replaceAll('-','');
const DIRECT=[
  ['materials_civil','getPriceInfoListFcltyCmmnMtrilEngrk'],
  ['materials_building','getPriceInfoListFcltyCmmnMtrilBildng'],
  ['materials_mechanical','getPriceInfoListFcltyCmmnMtrilMchnEqp'],
  ['materials_electrical_it','getPriceInfoListFcltyCmmnMtrilElctyIrmc'],
  ['market_civil','getPriceInfoListMrktCnstrctPcEngrk'],
  ['market_building','getPriceInfoListMrktCnstrctPcBildng'],
  ['market_mechanical','getPriceInfoListMrktCnstrctPcMchnEqp'],
  ['construction_classification','getCnsttyClsfcInfoList'],
  ['net_resource','getNetRsceinfoList'],
];
const DATED=[
  ['standard_market_unit','getStdMarkUprcinfoList'],
  ['materials_total','getPriceInfoListFcltyCmmnMtrilTotal'],
];
function key(){const x=String(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();if(!x)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');try{return /%[0-9a-f]{2}/i.test(x)?decodeURIComponent(x):x}catch{return x}}
function rows(body){const x=body?.items;if(Array.isArray(x))return x;if(Array.isArray(x?.item))return x.item;if(x?.item&&typeof x.item==='object')return [x.item];return []}
async function call(op,params={}){const u=new URL(`${BASE}/${op}`);for(const [k,v] of Object.entries({ServiceKey:key(),pageNo:'1',numOfRows:'1',type:'json',...params}))u.searchParams.set(k,v);const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});const text=await r.text();let j;try{j=JSON.parse(text)}catch{throw new Error(`NON_JSON:${r.status}`)}const root=j?.response||j;const code=String(root?.header?.resultCode??'');const msg=String(root?.header?.resultMsg??'');if(!r.ok||!['00','0'].includes(code))throw new Error(`PROVIDER:${r.status}:${code}:${msg}`);const body=root?.body||{};return {total_count:Number(body.totalCount||0),sample_fields:Object.keys(rows(body)[0]||{}).sort()}}
const operations=[];
for(const [id,operation] of DIRECT){try{operations.push({id,operation,...await call(operation)})}catch(e){operations.push({id,operation,error:String(e?.message||e).slice(0,240)})}}
for(const [id,operation] of DATED){const years=[];let total=0;let fields=[];for(let y=2000;y<=currentYear;y++){const end=y===currentYear?today:`${y}1231`;try{const x=await call(operation,{inqryDiv:'1',inqryBgnDate:`${y}0101`,inqryEndDate:end});years.push({year:y,total_count:x.total_count});total+=x.total_count;if(!fields.length&&x.sample_fields.length)fields=x.sample_fields}catch(e){years.push({year:y,error:String(e?.message||e).slice(0,180)})}}operations.push({id,operation,total_count_sum:total,years,sample_fields:fields})}
console.log(JSON.stringify({checked_at:new Date().toISOString(),operation_count:DIRECT.length+DATED.length,operations},null,2));
if(operations.some(x=>x.error||x.years?.some(y=>y.error)))process.exitCode=1;

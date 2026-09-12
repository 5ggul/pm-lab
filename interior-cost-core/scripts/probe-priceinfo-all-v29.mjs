const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');
const OPS=[
  ['materials_civil','getPriceInfoListFcltyCmmnMtrilEngrk',{}],
  ['materials_building','getPriceInfoListFcltyCmmnMtrilBildng',{}],
  ['materials_mechanical','getPriceInfoListFcltyCmmnMtrilMchnEqp',{}],
  ['materials_electrical_it','getPriceInfoListFcltyCmmnMtrilElctyIrmc',{}],
  ['market_civil','getPriceInfoListMrktCnstrctPcEngrk',{}],
  ['market_building','getPriceInfoListMrktCnstrctPcBildng',{}],
  ['market_mechanical','getPriceInfoListMrktCnstrctPcMchnEqp',{}],
  ['construction_classification','getCnsttyClsfcInfoList',{}],
  ['standard_market_unit','getStdMarkUprcinfoList',{inqryDiv:'1',inqryBgnDate:'20000101',inqryEndDate:today}],
  ['net_resource','getNetRsceinfoList',{}],
  ['materials_total','getPriceInfoListFcltyCmmnMtrilTotal',{inqryDiv:'1',inqryBgnDate:'20000101',inqryEndDate:today}],
];
function key(){const x=String(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();if(!x)throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');try{return /%[0-9a-f]{2}/i.test(x)?decodeURIComponent(x):x}catch{return x}}
function rows(body){const x=body?.items;if(Array.isArray(x))return x;if(Array.isArray(x?.item))return x.item;if(x?.item&&typeof x.item==='object')return [x.item];return []}
async function call(op,params){const u=new URL(`${BASE}/${op}`);for(const [k,v] of Object.entries({ServiceKey:key(),pageNo:'1',numOfRows:'1',type:'json',...params}))u.searchParams.set(k,v);const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});const text=await r.text();let j;try{j=JSON.parse(text)}catch{throw new Error(`NON_JSON:${r.status}`)}const root=j?.response||j;const code=String(root?.header?.resultCode??'');const msg=String(root?.header?.resultMsg??'');if(!r.ok||!['00','0'].includes(code))throw new Error(`PROVIDER:${r.status}:${code}:${msg}`);const body=root?.body||{};return {total_count:Number(body.totalCount||0),num_of_rows:Number(body.numOfRows||0),page_no:Number(body.pageNo||0),sample_fields:Object.keys(rows(body)[0]||{}).sort()}}
const out=[];for(const [id,operation,params] of OPS){try{const x=await call(operation,params);out.push({id,operation,params:Object.keys(params),...x})}catch(e){out.push({id,operation,params:Object.keys(params),error:String(e?.message||e).slice(0,240)})}}
console.log(JSON.stringify({checked_at:new Date().toISOString(),operation_count:OPS.length,operations:out},null,2));
if(out.some(x=>x.error))process.exitCode=1;

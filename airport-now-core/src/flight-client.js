import {SOURCES} from './source-registry.js';

export function decodedServiceKey(key) {
  const value=String(key||'').trim();
  if(!value)throw new Error('SERVICE_KEY_NOT_IN_EXECUTION_ENV');
  try {return /%[0-9a-f]{2}/i.test(value)?decodeURIComponent(value):value;}catch{throw new Error('INVALID_KEY_ENCODING');}
}
export function flightUrl({provider,direction,serviceDate,serviceKey,pageNo=1,numOfRows=100,airport}) {
  if(!['ARRIVAL','DEPARTURE'].includes(direction))throw new Error('INVALID_DIRECTION');
  if(!['KAC','IIAC'].includes(provider))throw new Error('INVALID_PROVIDER');
  const endpoint=provider==='KAC'?SOURCES.KAC_FLIGHT_STATUS_GW.endpoints[direction.toLowerCase()]:
    direction==='ARRIVAL'?SOURCES.IIAC_PASSENGER_ARRIVAL.detailEndpoint:SOURCES.IIAC_PASSENGER_DEPARTURE.endpoint;
  const u=new URL(endpoint);
  for(const [k,v] of Object.entries({serviceKey:decodedServiceKey(serviceKey),type:'json',pageNo,numOfRows,searchday:serviceDate.replaceAll('-','')}))u.searchParams.set(k,v);
  if(airport)u.searchParams.set('airport_code',airport);
  if(provider==='IIAC')u.searchParams.set('inqtimechcd','S');
  return u;
}
export function parseFlightEnvelope(payload) {
  let root;try {root=typeof payload==='string'?JSON.parse(payload):payload;}catch{
    const code=String(payload).match(/<returnReasonCode>\s*(\d+)\s*<\/returnReasonCode>/)?.[1];
    throw new Error(code?'GATEWAY_'+code:'FLIGHT_RESPONSE_NOT_JSON');
  }
  const gateway=root?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if(gateway)throw new Error(`GATEWAY_${String(gateway.returnReasonCode).replace(/[^0-9]/g,'')||'ERROR'}`);
  root=root?.response||root;
  const code=String(root?.header?.resultCode??'');
  if(!['00','0'].includes(code))throw new Error(`PROVIDER_${/^\d+$/.test(code)?code:'INVALID_ENVELOPE'}`);
  const body=root.body;
  if(!body||!Object.hasOwn(body,'totalCount'))throw new Error('PAGINATION_TOTAL_MISSING');
  const total=Number(body.totalCount),page=Number(body.pageNo),size=Number(body.numOfRows);
  if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(size)||size<1)throw new Error('INVALID_PAGINATION');
  const items=body.items, item=items?.item;
  const rows=Array.isArray(items)?items:Array.isArray(item)?item:item&&typeof item==='object'?[item]:[];
  if(!rows.length&&total>0)throw new Error('NONEMPTY_TOTAL_WITHOUT_ROWS');
  if(rows.length>total)throw new Error('INVALID_TOTAL');
  return {rows,total,page,size};
}
export async function fetchFlightRows(args,{fetchImpl=fetch,capture=async()=>{},maxPages=100}={}) {
  const rows=[];let total=null;const signatures=new Set();
  for(let pageNo=1;pageNo<=maxPages;pageNo++) {
    let r;
    try {r=await fetchImpl(flightUrl({...args,pageNo}),{signal:AbortSignal.timeout(25000),headers:{accept:'application/json'}});}catch(error){throw new Error(/^PROVIDER_TRANSPORT_\d+$/.test(error.message)?error.message:'FLIGHT_FETCH_FAILED');}
    const body=await r.text();
    if(body.length>8_000_000)throw new Error('FLIGHT_RESPONSE_TOO_LARGE');
    await capture({provider:args.provider,direction:args.direction,pageNo,capturedAt:new Date().toISOString(),httpStatus:r.status,body});
    if(!r.ok)throw new Error(`FLIGHT_HTTP_${r.status}`);
    const parsed=parseFlightEnvelope(body);
    if(parsed.page!==pageNo)throw new Error('PAGE_NUMBER_MISMATCH');
    if(total!==null&&total!==parsed.total)throw new Error('TOTAL_CHANGED_DURING_CAPTURE');
    total=parsed.total;
    const signature=JSON.stringify(parsed.rows);
    if(parsed.rows.length&&signatures.has(signature))throw new Error('REPEATED_PAGE');
    signatures.add(signature);rows.push(...parsed.rows);
    if(rows.length===total)return {rows,pages:pageNo,total};
    if(rows.length>total||!parsed.rows.length)throw new Error('PAGINATION_INCOMPLETE');
  }
  throw new Error('PAGE_LIMIT_EXCEEDED');
}

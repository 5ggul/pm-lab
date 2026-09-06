import { collapseIiacArrivalRows } from '../iiac-live.js';
import { recordSourceHealth } from '../storage/writer.js';
import { persistFlightBatch } from '../storage/flight-batch.js';
export { planFlightChanges, FLIGHT_BULK_SQL as IIAC_BULK_SQL } from '../storage/flight-batch.js';

export function parseIiacArrivalEnvelope(payload){
  const root=typeof payload==='string'?JSON.parse(payload):payload;
  const response=root?.response;
  const code=String(response?.header?.resultCode??'');
  if(code!=='00') throw new Error(`IIAC_RESPONSE_ERROR:${code||'MISSING_CODE'}:${response?.header?.resultMsg||''}`);
  const items=response?.body?.items;
  const rows=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:[];
  if(!rows.length) throw new Error('IIAC_EMPTY_ITEMS');
  return rows;
}

export async function ingestIiacArrivalPayload(db,payload,{serviceDate,observedAt}){
  if(!db) throw new Error('D1_REQUIRED');
  if(!serviceDate||!observedAt) throw new Error('serviceDate and observedAt required');
  try {
    const collapsed=collapseIiacArrivalRows(parseIiacArrivalEnvelope(payload),{serviceDate,observedAt});
    const result=await persistFlightBatch(db,collapsed);
    await recordSourceHealth(db,{sourceId:'IIAC_PASSENGER_ARRIVAL',readiness:'LIVE_CAPTURED',attemptedAt:observedAt,succeededAt:observedAt});
    return {...result,queryCount:result.queryCount+1};
  } catch(error) {
    try {await recordSourceHealth(db,{sourceId:'IIAC_PASSENGER_ARRIVAL',readiness:'ERROR',attemptedAt:observedAt,errorAt:observedAt,errorCode:'INGEST_ERROR',consecutiveFailures:1});} catch {}
    throw error;
  }
}

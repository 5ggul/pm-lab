import {AIRPORTS,serviceDateKst} from '../airports.js';
import {fetchFlightRows} from '../flight-client.js';
import {collapseFlightRows,normalizeIiacDetail,normalizeKacFlight} from '../flight-live.js';
import {persistFlightBatch} from '../storage/flight-batch.js';
import {recordSourceHealth} from '../storage/writer.js';
import {ingestKmaMetarPayload} from './kma-metar.js';
import {buildKmaMetarUrl} from '../../core.js';

function safeError(error) {
  const code=String(error?.message||'INGEST_FAILED');
  return /^[A-Z0-9_]+$/.test(code)?code:'INGEST_FAILED';
}
export async function ingestFlightRows(db,rows,ctx) {
  const normalizer=ctx.provider==='IIAC'?normalizeIiacDetail:normalizeKacFlight;
  return persistFlightBatch(db,collapseFlightRows(rows,normalizer,ctx));
}
export const INGEST_TASKS=Object.freeze(['iiacArrival','iiacDeparture','kacArrival','kacDeparture','metar']);
export async function ingestOnce(env,{fetchImpl=fetch,capture=async()=>{},now=()=>new Date().toISOString(),airports=AIRPORTS,onProgress=()=>{},tasks=INGEST_TASKS,maxPages=100,observationTime=null}={}) {
  if(!['development','test','preview'].includes(env.APP_ENV))throw new Error('ONCE_ENV_NOT_ALLOWED');
  if(!env.DB)throw new Error('D1_REQUIRED');
  if(!tasks.length||tasks.some(t=>!INGEST_TASKS.includes(t)))throw new Error('INVALID_INGEST_TASK');
  const serviceDate=serviceDateKst(now());
  const result={serviceDate};
  // Sequential source groups bound upstream load and prevent competing health writes.
  for(const [name,provider,direction] of [
    ['iiacArrival','IIAC','ARRIVAL'],['iiacDeparture','IIAC','DEPARTURE'],
    ['kacArrival','KAC','ARRIVAL'],['kacDeparture','KAC','DEPARTURE']]) {
    if(!tasks.includes(name))continue;
    const sourceId=provider==='IIAC'?`IIAC_PASSENGER_${direction}`:`KAC_FLIGHT_${direction}`;
    const attemptedAt=now();
    try {
      const data=await fetchFlightRows({provider,direction,serviceDate,serviceKey:env.DATA_GO_KR_SERVICE_KEY||env.DATAKEY},{fetchImpl,capture,maxPages});
      const observedAt=observationTime||now();
      if(serviceDateKst(observedAt)!==serviceDate)throw new Error('CAPTURE_CROSSED_KST_MIDNIGHT');
      const ingested=await ingestFlightRows(env.DB,data.rows,{provider,direction,serviceDate,observedAt});
      await recordSourceHealth(env.DB,{sourceId,readiness:ingested.rejectedRows?'PARTIAL':'LIVE_CAPTURED',attemptedAt,succeededAt:observedAt});
      result[name]={ok:true,complete:ingested.rejectedRows===0,...ingested,pages:data.pages};
    }catch(error){
      const code=safeError(error);
      try {await recordSourceHealth(env.DB,{sourceId,readiness:'ERROR',attemptedAt,errorAt:now(),errorCode:code,consecutiveFailures:1});}catch{}
      result[name]={ok:false,error:code};
    }
    onProgress({source:name,ok:result[name].ok,error:result[name].error,operatingFlights:result[name].operatingFlights});
  }
  if(!tasks.includes('metar'))return result;
  result.metar={ok:true,freshCoverageComplete:true,airports:{}};
  for(const {icao} of airports) {
    const attemptedAt=now();
    try {
      const key=env.KMA_API_HUB_KEY||env.KMAKEY;
      if(!key)throw new Error('KMA_KEY_NOT_IN_EXECUTION_ENV');
      let response;
      try {response=await fetchImpl(buildKmaMetarUrl({icao,authKey:key}),{signal:AbortSignal.timeout(25000)});}catch(error){throw new Error(/^PROVIDER_TRANSPORT_\d+$/.test(error.message)?error.message:'METAR_FETCH_FAILED');}
      const body=await response.text();
      if(body.length>2_000_000)throw new Error('METAR_RESPONSE_TOO_LARGE');
      await capture({provider:'KMA',icao,capturedAt:now(),httpStatus:response.status,body});
      if(!response.ok)throw new Error(`METAR_HTTP_${response.status}`);
      const outcome=await ingestKmaMetarPayload(env.DB,body,{observedAt:now(),expectedIcao:icao,recordHealth:airports.length===AIRPORTS.length});
      const current=outcome.records>0&&outcome.staleSkipped===0;
      result.metar.airports[icao]={ok:true,current,...outcome};
      if(!current)result.metar.freshCoverageComplete=false;
      await recordSourceHealth(env.DB,{sourceId:`KMA_METAR_SPECI:${icao}`,readiness:current?'LIVE_CAPTURED':'STALE',attemptedAt,succeededAt:now()});
    }catch(error){
      const code=safeError(error);result.metar.ok=false;
      result.metar.freshCoverageComplete=false;
      result.metar.airports[icao]={ok:false,error:code};
      try {await recordSourceHealth(env.DB,{sourceId:`KMA_METAR_SPECI:${icao}`,readiness:'ERROR',attemptedAt,errorAt:now(),errorCode:code,consecutiveFailures:1});}catch{}
    }
    onProgress({source:'metar',icao,ok:result.metar.airports[icao].ok,current:result.metar.airports[icao].current,error:result.metar.airports[icao].error});
  }
  const metarOk=result.metar.ok&&result.metar.freshCoverageComplete;
  if(airports.length===AIRPORTS.length)await recordSourceHealth(env.DB,{sourceId:'KMA_METAR_SPECI',readiness:metarOk?'LIVE_CAPTURED':'PARTIAL',attemptedAt:now(),...(metarOk?{succeededAt:now()}:{errorAt:now(),errorCode:'PARTIAL_COVERAGE',consecutiveFailures:1})});
  return result;
}

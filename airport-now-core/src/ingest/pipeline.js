import { ingestIiacArrivalPayload } from './iiac-arrivals.js';
import { ingestIiacDeparturePayload,ingestKacDeparturePayload,ingestKacArrivalPayload } from './flight-status.js';
import { ingestKmaMetarPayload } from './kma-metar.js';

export const INGEST_SOURCE_IDS=Object.freeze(['IIAC_PASSENGER_ARRIVAL','IIAC_PASSENGER_DEPARTURE','KAC_FLIGHT_STATUS_DEPARTURE','KAC_FLIGHT_STATUS_ARRIVAL','KMA_METAR_SPECI']);

export async function ingestProviderPayload(db,{sourceId,payload,serviceDate=null,observedAt,maxObservationAgeMinutes=90}={}){
  if(!INGEST_SOURCE_IDS.includes(sourceId)) throw new Error('UNSUPPORTED_INGEST_SOURCE');
  if(!observedAt) throw new Error('observedAt required');
  if(sourceId==='KMA_METAR_SPECI') return ingestKmaMetarPayload(db,payload,{observedAt,maxAgeMinutes:maxObservationAgeMinutes});
  if(!serviceDate) throw new Error('serviceDate required for flight ingest');
  const ctx={serviceDate,observedAt};
  if(sourceId==='IIAC_PASSENGER_ARRIVAL') return ingestIiacArrivalPayload(db,payload,ctx);
  if(sourceId==='IIAC_PASSENGER_DEPARTURE') return ingestIiacDeparturePayload(db,payload,ctx);
  if(sourceId==='KAC_FLIGHT_STATUS_DEPARTURE') return ingestKacDeparturePayload(db,payload,ctx);
  if(sourceId==='KAC_FLIGHT_STATUS_ARRIVAL') return ingestKacArrivalPayload(db,payload,ctx);
  throw new Error('UNSUPPORTED_INGEST_SOURCE');
}

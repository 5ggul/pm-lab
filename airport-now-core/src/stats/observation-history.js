import {AIRPORTS} from '../airports.js';
import {METRIC_VERSION} from './observations.js';
export async function observationHistory(db,iata,asOf=Date.now()){
 iata=iata.toUpperCase();if(!AIRPORTS.some(a=>a.iata===iata))throw Error('INVALID_AIRPORT');
 const since=new Date(asOf-86400000).toISOString(),until=new Date(asOf).toISOString(),results=[];
 for(const direction of ['DEPARTURE','ARRIVAL']){
  const sourceId=(iata==='ICN'?'IIAC_PASSENGER_':'KAC_FLIGHT_')+direction;
  const rows=(await db.prepare('SELECT service_date,hour_kst,minute_bucket,observed_at,observation_bucket,known_count,unknown_count,delayed_count,cancelled_count FROM airport_observations WHERE airport_iata=?1 AND direction=?2 AND source_id=?3 AND metric_version=?4 AND observed_at>=?5 AND observed_at<=?6 ORDER BY observed_at DESC LIMIT 6').bind(iata,direction,sourceId,METRIC_VERSION,since,until).all()).results||[];
  results.push({direction,sourceId,observations:rows});
 }
 return{airport:iata,asOf:until,windowStart:since,metricVersion:METRIC_VERSION,limitPerDirection:6,results};
}

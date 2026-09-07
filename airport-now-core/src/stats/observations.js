import {AIRPORTS,serviceDateKst} from '../airports.js';
export const METRIC_VERSION='status-share-v1';
export function observationContext(sourceId,at){
 const time=Date.parse(at);if(!Number.isFinite(time))throw Error('INVALID_OBSERVATION_TIME');
 const direction=sourceId.endsWith('_ARRIVAL')?'ARRIVAL':sourceId.endsWith('_DEPARTURE')?'DEPARTURE':null;
 if(!direction||!['IIAC_PASSENGER_ARRIVAL','IIAC_PASSENGER_DEPARTURE','KAC_FLIGHT_ARRIVAL','KAC_FLIGHT_DEPARTURE'].includes(sourceId))throw Error('INVALID_OBSERVATION_SOURCE');
 const kst=new Date(time+9*3600000),minute=kst.getUTCMinutes();
 return {serviceDate:serviceDateKst(at),hour:kst.getUTCHours(),minute:Math.floor(minute/10)*10,bucket:new Date(Math.floor(time/600000)*600000).toISOString(),direction,airports:AIRPORTS.filter(a=>sourceId.startsWith('IIAC')?a.iata==='ICN':a.iata!=='ICN').map(a=>a.iata)};
}
export async function recordObservation(db,{sourceId,at,runId}){
 const c=observationContext(sourceId,at);
 if(Date.parse(at)-Date.parse(c.bucket)>120000)throw Error('OBSERVATION_WINDOW_MISSED');
 // One completed source snapshot, same scheduled KST hour and observation bucket. First successful publication wins.
 return db.prepare(`INSERT INTO airport_observations (metric_version,source_id,run_id,service_date,hour_kst,minute_bucket,observed_at,observation_bucket,airport_iata,direction,known_count,unknown_count,delayed_count,cancelled_count)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,a.value,?9,SUM(CASE WHEN f.status<>'UNKNOWN' THEN 1 ELSE 0 END),SUM(CASE WHEN f.status='UNKNOWN' THEN 1 ELSE 0 END),SUM(CASE WHEN f.status='DELAYED' THEN 1 ELSE 0 END),SUM(CASE WHEN f.status='CANCELLED' THEN 1 ELSE 0 END)
 FROM json_each(?10) a LEFT JOIN flight_current f ON f.source_id=?2 AND f.service_date=?4 AND f.direction=?9 AND (CASE WHEN ?9='DEPARTURE' THEN f.origin ELSE f.destination END)=a.value AND CAST(strftime('%H',COALESCE(f.scheduled_departure,f.scheduled_arrival),'+9 hours') AS INTEGER)=?5
 WHERE EXISTS (SELECT 1 FROM source_health h WHERE h.source_id=?2 AND h.readiness='LIVE_CAPTURED' AND datetime(h.last_success_at)>=datetime(?8) AND datetime(h.last_success_at)<=datetime(?7))
 GROUP BY a.value ON CONFLICT(metric_version,source_id,observation_bucket,airport_iata,direction) DO NOTHING`).bind(METRIC_VERSION,sourceId,runId,c.serviceDate,c.hour,c.minute,at,c.bucket,c.direction,JSON.stringify(c.airports)).run();
}

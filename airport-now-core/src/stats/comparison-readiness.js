import {AIRPORTS} from '../airports.js';
import {METRIC_VERSION,observationContext} from './observations.js';
export async function comparisonReadiness(db,iata,asOf=Date.now()){
 iata=iata.toUpperCase();if(!AIRPORTS.some(a=>a.iata===iata))throw Error('INVALID_AIRPORT');
 const bucket=Math.floor((asOf-120000)/600000)*600000;
 const results=[];
 for(const direction of ['DEPARTURE','ARRIVAL']){
  const sourceId=(iata==='ICN'?'IIAC_PASSENGER_':'KAC_FLIGHT_')+direction;
  const c=observationContext(sourceId,new Date(bucket).toISOString());
  const dates=[7,14,21,28].map(days=>new Date(Date.parse(c.serviceDate+'T00:00:00Z')-days*86400000).toISOString().slice(0,10));
  const rows=(await db.prepare('SELECT service_date,observation_bucket,observed_at,known_count,unknown_count FROM airport_observations WHERE airport_iata=?1 AND direction=?2 AND metric_version=?3 AND source_id=?4 AND hour_kst=?5 AND minute_bucket=?6 AND (observation_bucket=?7 OR service_date IN (SELECT value FROM json_each(?8)))').bind(iata,direction,METRIC_VERSION,sourceId,c.hour,c.minute,new Date(bucket).toISOString(),JSON.stringify(dates)).all()).results||[];
  const valid=r=>Number.isFinite(Date.parse(r.observed_at))&&Date.parse(r.observed_at)>=Date.parse(r.observation_bucket)&&Date.parse(r.observed_at)-Date.parse(r.observation_bucket)<=120000;
  const current=rows.find(r=>r.observation_bucket===new Date(bucket).toISOString()&&valid(r));
  const history=dates.map(date=>{const r=rows.find(r=>r.service_date===date&&valid(r));return {date,recorded:Boolean(r),knownCount:r?.known_count??null,unknownCount:r?.unknown_count??null,qualifies:Boolean(r&&r.known_count>=20&&r.unknown_count===0)};});
  const qualifyingWeeks=history.filter(r=>r.qualifies).length;
  const reason=!current?'CURRENT_OBSERVATION_MISSING':current.known_count<20?'CURRENT_SAMPLE_SMALL':current.unknown_count>0?'CURRENT_UNKNOWN_STATUS':qualifyingWeeks<4?'HISTORY_INSUFFICIENT':'REVIEW_REQUIRED';
  results.push({direction,scheduledHourKst:c.hour,minuteBucket:c.minute,observationBucket:new Date(bucket).toISOString(),current:current?{observedAt:current.observed_at,knownCount:current.known_count,unknownCount:current.unknown_count}:null,history,qualifyingWeeks,requiredWeeks:4,minimumKnownCount:20,reason,comparisonAvailable:false});
 }
 return {airport:iata,asOf:new Date(asOf).toISOString(),metricVersion:METRIC_VERSION,results};
}

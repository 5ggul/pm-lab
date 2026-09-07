import {METRIC_VERSION} from './observations.js';
const STEP=600000,GRACE=120000;
const SCOPE={IIAC_PASSENGER_ARRIVAL:1,IIAC_PASSENGER_DEPARTURE:1,KAC_FLIGHT_ARRIVAL:14,KAC_FLIGHT_DEPARTURE:14};
export function observationQuality(rows,startedAt,asOf=Date.now()){
 const first=Date.parse(startedAt||'');
 const end=Math.floor((asOf-GRACE)/STEP)*STEP;
 const start=Number.isFinite(first)?Math.max(first,end-143*STEP):null;
 const buckets=new Map();
 for(const r of rows){const t=Date.parse(r.observation_bucket);if(start===null||t<start||t>end)continue;const sources=buckets.get(t)||new Map();sources.set(r.source_id,Number(r.airport_directions));buckets.set(t,sources);}
 let complete=0,latest=null;const missingBySource=Object.fromEntries(Object.keys(SCOPE).map(s=>[s,0]));
 const expected=start!==null&&start<=end?Math.floor((end-start)/STEP)+1:0;
 for(let t=start;expected&&t<=end;t+=STEP){const sources=buckets.get(t);let ok=true;for(const [s,n] of Object.entries(SCOPE)){if(sources?.get(s)!==n){missingBySource[s]++;ok=false;}}if(ok){complete++;latest=t;}}
 return {metricVersion:METRIC_VERSION,monitoringSince:Number.isFinite(first)?new Date(first).toISOString():null,windowStart:expected?new Date(start).toISOString():null,windowEnd:expected?new Date(end).toISOString():null,expectedBuckets:expected,completeBuckets:complete,missingBuckets:expected-complete,coveragePercent:expected?100*complete/expected:null,lastCompleteBucket:latest===null?null:new Date(latest).toISOString(),state:latest!==null&&asOf-latest<=30*60000?'COLLECTING':expected?'DELAYED':'WAITING',missingBySource,comparisonAvailable:false};
}
export async function readObservationQuality(db,asOf=Date.now()){
 const first=await db.prepare('SELECT MIN(observation_bucket) AS started_at FROM airport_observations WHERE metric_version=?1').bind(METRIC_VERSION).first();
 const rows=(await db.prepare('SELECT observation_bucket,source_id,COUNT(*) AS airport_directions FROM airport_observations WHERE metric_version=?1 AND observation_bucket>=?2 GROUP BY observation_bucket,source_id').bind(METRIC_VERSION,new Date(asOf-86400000-STEP).toISOString()).all()).results||[];
 return observationQuality(rows,first?.started_at,asOf);
}

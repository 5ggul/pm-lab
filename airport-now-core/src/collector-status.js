import {serviceDateKst} from './airports.js';
export const FLIGHT_SOURCES=['IIAC_PASSENGER_ARRIVAL','IIAC_PASSENGER_DEPARTURE','KAC_FLIGHT_ARRIVAL','KAC_FLIGHT_DEPARTURE'];
export function collectionState(health,asOf=Date.now(),serviceDate=null){
  const age=asOf-Date.parse(health?.last_success_at||'');
  const current=['LIVE_CAPTURED','PARTIAL','ERROR'].includes(health?.readiness)&&Number.isFinite(age)&&age>=0&&age<=30*60000&&(!serviceDate||serviceDateKst(health.last_success_at)===serviceDate);
  const updateDelayed=health?.readiness==='ERROR';
  return {readiness:health?.readiness||'UNAVAILABLE',lastSuccessAt:health?.last_success_at||null,lastAttemptAt:health?.last_attempt_at||null,current,updateDelayed,state:current?(updateDelayed?'DEGRADED':'LIVE'):(Number.isFinite(age)?'STALE':'UNAVAILABLE')};
}
function merge(intervals){const out=[];for(const interval of intervals.sort((a,b)=>a[0]-b[0])){const previous=out.at(-1);if(previous&&interval[0]<=previous[1])previous[1]=Math.max(previous[1],interval[1]);else out.push([...interval]);}return out;}
function intersection(a,b){const out=[];let i=0,j=0;while(i<a.length&&j<b.length){const start=Math.max(a[i][0],b[j][0]),end=Math.min(a[i][1],b[j][1]);if(start<end)out.push([start,end]);if(a[i][1]<b[j][1])i++;else j++;}return out;}
export function coverageReport(records,{start,end,sourceIds=FLIGHT_SOURCES}={}){
  const duration=Math.max(0,end-start),sources={};let common=[[start,end]];
  for(const sourceId of sourceIds){const intervals=merge(records.filter(r=>r.source_id===sourceId&&r.success).map(r=>{const at=Date.parse(r.success_at),published=Date.parse(r.completed_at||r.success_at);return[Math.max(start,at,published),Math.min(end,at+30*60000)];}).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&a<b));
    const covered=intervals.reduce((sum,[a,b])=>sum+b-a,0);sources[sourceId]={coveredMinutes:covered/60000,staleMinutes:(duration-covered)/60000,availabilityPercent:duration?100*covered/duration:null};common=intersection(common,intervals);
  }
  return {observedMinutes:duration/60000,allSourcesAvailabilityPercent:duration?100*common.reduce((sum,[a,b])=>sum+b-a,0)/duration:null,sources};
}
export async function collectorStatus(db,asOf=Date.now()){
  const health=(await db.prepare('SELECT source_id,readiness,last_attempt_at,last_success_at,last_error_code FROM source_health').all()).results||[];
  const first=await db.prepare('SELECT MIN(started_at) AS started_at FROM collection_runs').first();
  const monitorStart=Date.parse(first?.started_at||''),start=Number.isFinite(monitorStart)?Math.max(asOf-86400000,monitorStart):asOf;
  const records=(await db.prepare('SELECT source_id,success,success_at,completed_at FROM collection_runs WHERE completed_at>=?1').bind(new Date(start-30*60000).toISOString()).all()).results||[];
  return {asOf:new Date(asOf).toISOString(),monitoringSince:first?.started_at||null,coverage:coverageReport(records,{start,end:asOf}),sources:health.map(h=>({sourceId:h.source_id,...collectionState(h,asOf),lastErrorCode:h.last_error_code}))};
}

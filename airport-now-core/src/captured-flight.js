import {parseFlightEnvelope} from './flight-client.js';
import {serviceDateKst} from './airports.js';

export function validateCapturedFlight(task,capture,asOf=Date.now()){
  if(!['iiacArrival','iiacDeparture','kacArrival','kacDeparture'].includes(task)||!capture||!Array.isArray(capture.pages)||!capture.pages.length||capture.pages.length>20)throw new Error('INVALID_CAPTURE');
  const started=Date.parse(capture.startedAt),completed=Date.parse(capture.completedAt);
  if(!Number.isFinite(started)||!Number.isFinite(completed)||completed<started||completed-started>180000||completed>asOf+60000||asOf-completed>300000)throw new Error('INVALID_CAPTURE_TIME');
  if(capture.serviceDate!==serviceDateKst(new Date(asOf).toISOString())||serviceDateKst(capture.startedAt)!==capture.serviceDate||serviceDateKst(capture.completedAt)!==capture.serviceDate)throw new Error('INVALID_CAPTURE_DATE');
  if(capture.pages.some(p=>typeof p!=='string'||p.length>2_000_000))throw new Error('INVALID_CAPTURE_PAGE');
  let total=null,count=0;const signatures=new Set();
  capture.pages.forEach((payload,index)=>{const page=parseFlightEnvelope(payload);if(page.page!==index+1)throw new Error('INVALID_CAPTURE_PAGE');if(total!==null&&page.total!==total)throw new Error('TOTAL_CHANGED_DURING_CAPTURE');total=page.total;count+=page.rows.length;const signature=JSON.stringify(page.rows);if(page.rows.length&&signatures.has(signature))throw new Error('REPEATED_PAGE');signatures.add(signature);});
  if(count!==total)throw new Error('PAGINATION_INCOMPLETE');
  let nextPage=1;
  return {observationTime:capture.completedAt,fetchImpl:async url=>{
    const page=Number(new URL(url).searchParams.get('pageNo'));
    if(page!==nextPage++||page>capture.pages.length)throw new Error('INVALID_CAPTURE_PAGE');
    return new Response(capture.pages[page-1],{headers:{'content-type':'application/json'}});
  }};
}
export function sourceForTask(task,icao){
  if(task==='metar')return 'KMA_METAR_SPECI:'+icao;
  return (task.startsWith('iiac')?'IIAC_PASSENGER_':'KAC_FLIGHT_')+(task.endsWith('Arrival')?'ARRIVAL':'DEPARTURE');
}

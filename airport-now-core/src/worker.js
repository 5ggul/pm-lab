import { SOURCES, productionReadySources } from '../core.js';
import { CAPABILITIES, productionEnabledCapabilities } from './capability-registry.js';
import { searchFlights, airportBoard, irregularBoard, flightNumberHistory } from './read-model.js';
import { readWeather,readWarnings,readParking,readCongestion,readProcessTime,moduleAvailability } from './capability-read-model.js';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function kstDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function safeSource(s){return{id:s.id,provider:s.provider,state:s.state,readiness:s.readiness,productionEnabled:s.productionEnabled,scope:s.scope}}
function safeCapability(s){return{id:s.id,provider:s.provider,state:s.state,productionEnabled:s.productionEnabled,scope:s.scope}}
function moduleResult(results,opts){return{...moduleAvailability(results,opts),results}}

export async function handleRequest(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health') return json({ok:true,app:'airport-now-core',productionIngestEnabled:false});
  if(path==='/api/readiness') return json({productionReadyCount:productionReadySources().length,productionEnabledCapabilityCount:productionEnabledCapabilities().length,sources:Object.values(SOURCES).map(safeSource),capabilities:Object.values(CAPABILITIES).map(safeCapability)});
  if(!path.startsWith('/api/')) return new Response('Not found',{status:404});
  if(!env.DB) return json({error:'D1_NOT_BOUND',message:'Preview read API has no D1 binding.'},503);
  const date=url.searchParams.get('date')||kstDate();
  try{
    if(path==='/api/search/flights'){const q=url.searchParams.get('q');if(!q)return json({error:'QUERY_REQUIRED'},400);return json({date,results:await searchFlights(env.DB,{query:q,serviceDate:date,limit:20})})}
    const airport=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/flights$/);
    if(airport){const direction=(url.searchParams.get('direction')||'DEPARTURE').toUpperCase(),status=url.searchParams.get('status')?.toUpperCase()||null;return json({date,airport:airport[1].toUpperCase(),direction,status,results:await airportBoard(env.DB,{iata:airport[1],serviceDate:date,direction,status,limit:url.searchParams.get('limit')||100})})}
    if(path==='/api/now/delays')return json({date,status:'DELAYED',results:await irregularBoard(env.DB,{serviceDate:date,status:'DELAYED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    if(path==='/api/now/cancellations')return json({date,status:'CANCELLED',results:await irregularBoard(env.DB,{serviceDate:date,status:'CANCELLED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    const history=path.match(/^\/api\/flights\/([A-Za-z0-9 ]+)\/history$/);if(history)return json({flightNumber:history[1].replace(/\s+/g,'').toUpperCase(),results:await flightNumberHistory(env.DB,{flightNumber:history[1],limit:url.searchParams.get('limit')||30})});
    const weather=path.match(/^\/api\/weather\/([A-Za-z0-9]{4})$/);if(weather){const r=await readWeather(env.DB,weather[1]);return json(moduleResult(r,{maxAgeMinutes:20}))}
    const warnings=path.match(/^\/api\/warnings\/([A-Za-z0-9]{4})$/);if(warnings){const now=new Date().toISOString(),r=await readWarnings(env.DB,warnings[1],now);return json(moduleResult(r,{nowIso:now,maxAgeMinutes:180}))}
    const parking=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/parking$/);if(parking){const r=await readParking(env.DB,parking[1]);return json(moduleResult(r,{maxAgeMinutes:15}))}
    const congestion=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/congestion$/);if(congestion){const r=await readCongestion(env.DB,congestion[1]);return json(moduleResult(r,{maxAgeMinutes:10}))}
    const process=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/process-time$/);if(process){const r=await readProcessTime(env.DB,process[1]);return json(moduleResult(r,{maxAgeMinutes:15}))}
    return json({error:'NOT_FOUND'},404);
  }catch(error){const known=/^(INVALID_|IRREGULAR_)/.test(error?.message||'');return json({error:known?error.message:'READ_API_ERROR'},known?400:500)}
}
export default{fetch(request,env){return handleRequest(request,env)},scheduled(){throw new Error('SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL')}};

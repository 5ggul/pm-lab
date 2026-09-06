import { SOURCES, productionReadySources } from './source-registry.js';
import {handleInternalIngest} from './internal-ingest.js';
import { searchFlights, airportBoard, irregularBoard, flightNumberHistory, currentWeather, currentWeatherMany } from './read-model.js';

const PUBLIC_API_HEADERS=Object.freeze({
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET, OPTIONS',
  'access-control-allow-headers':'content-type',
  'x-content-type-options':'nosniff',
  'x-robots-tag':'noindex'
});
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:PUBLIC_API_HEADERS})}
function kstDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function safeSource(s){return{id:s.id,provider:s.provider,state:s.state,readiness:s.readiness,productionEnabled:s.productionEnabled,scope:s.scope}}

export async function handleRequest(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/internal/ingest/once')return handleInternalIngest(request,env);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:PUBLIC_API_HEADERS});
  if(request.method!=='GET') return json({error:'METHOD_NOT_ALLOWED'},405);
  if(path==='/api/health') return json({ok:true,app:'airport-now-core',productionIngestEnabled:false});
  if(path==='/api/readiness') return json({productionReadyCount:productionReadySources().length,sources:Object.values(SOURCES).map(safeSource)});
  if(!path.startsWith('/api/')) return new Response('Not found',{status:404});
  if(!env.DB) return json({error:'D1_NOT_BOUND',message:'Preview read API has no D1 binding.'},503);
  const date=url.searchParams.get('date')||kstDate();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return json({error:'INVALID_DATE'},400);
  try{
    if(path==='/api/search/flights'){
      const q=url.searchParams.get('q');if(!q)return json({error:'QUERY_REQUIRED'},400);
      return json({date,results:await searchFlights(env.DB,{query:q,serviceDate:date,limit:20})});
    }
    const airport=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/flights$/);
    if(airport){
      const direction=(url.searchParams.get('direction')||'DEPARTURE').toUpperCase();
      const status=url.searchParams.get('status')?.toUpperCase()||null;
      const results=await airportBoard(env.DB,{iata:airport[1],serviceDate:date,direction,status,limit:url.searchParams.get('limit')||100,offset:url.searchParams.get('offset')??0});
      const sourceId=airport[1].toUpperCase()==='ICN'?'IIAC_PASSENGER_'+direction:'KAC_FLIGHT_'+direction;
      const health=await env.DB.prepare('SELECT readiness,last_success_at FROM source_health WHERE source_id=?1').bind(sourceId).first();
      const age=Date.now()-Date.parse(health?.last_success_at||'');
      const collection={sourceId,readiness:health?.readiness||'UNAVAILABLE',lastSuccessAt:health?.last_success_at||null,current:Number.isFinite(age)&&age>=0&&age<=30*60*1000&&['LIVE_CAPTURED','PARTIAL'].includes(health?.readiness)};
      return json({date,airport:airport[1].toUpperCase(),direction,status,collection,results});
    }
    if(path==='/api/weather'){
      const raw=url.searchParams.get('icaos');if(!raw)return json({error:'ICAOS_REQUIRED'},400);
      const icaos=raw.split(',').map(x=>x.trim()).filter(Boolean);
      const asOf=new Date().toISOString();
      const results=await currentWeatherMany(env.DB,{icaos,asOf,maxAgeMinutes:90});
      return json({icaos,asOf,maxAgeMinutes:90,results});
    }
    const weather=path.match(/^\/api\/weather\/([A-Za-z0-9]{4})$/);
    if(weather){
      const icao=weather[1].toUpperCase();
      const asOf=new Date().toISOString();
      const row=await currentWeather(env.DB,{icao,asOf,maxAgeMinutes:90});
      return json({icao,asOf,maxAgeMinutes:90,current:Boolean(row),weather:row||null});
    }
    if(path==='/api/now/delays') return json({date,status:'DELAYED',results:await irregularBoard(env.DB,{serviceDate:date,status:'DELAYED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    if(path==='/api/now/cancellations') return json({date,status:'CANCELLED',results:await irregularBoard(env.DB,{serviceDate:date,status:'CANCELLED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    const history=path.match(/^\/api\/flights\/([A-Za-z0-9 ]+)\/history$/);
    if(history) return json({flightNumber:history[1].replace(/\s+/g,'').toUpperCase(),results:await flightNumberHistory(env.DB,{flightNumber:history[1],limit:url.searchParams.get('limit')||30})});
    return json({error:'NOT_FOUND'},404);
  }catch(error){
    const known=/^(INVALID_|IRREGULAR_)/.test(error?.message||'');
    return json({error:known?error.message:'READ_API_ERROR'},known?400:500);
  }
}

export default {
  fetch(request,env){return handleRequest(request,env)},
  scheduled(){throw new Error('SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL')}
};
